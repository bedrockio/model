import yd from '@bedrockio/yada';
import logger from '@bedrockio/logger';
import mongoose from 'mongoose';
import {
  get,
  pick,
  isEmpty,
  camelCase,
  upperFirst,
  escapeRegExp,
  isPlainObject,
} from 'lodash';

import { isDateField, isNumberField, getField } from './utils';
import { SEARCH_DEFAULTS } from './const';
import { OBJECT_ID_SCHEMA } from './validation';
import { debug } from './env';
import { wrapQuery } from './query';

import warn from './warn';

const { SchemaTypes } = mongoose;
const { ObjectId } = mongoose.Types;

export function applySearch(schema, definition) {
  validateDefinition(definition);
  applySearchCache(schema, definition);

  schema.static('search', function search(body = {}) {
    const options = {
      ...SEARCH_DEFAULTS,
      ...definition.search?.query,
      ...body,
    };

    const { ids, keyword, skip = 0, limit, sort, ...rest } = options;

    const query = {};

    if (ids?.length) {
      query._id = { $in: ids };
    }

    if (keyword) {
      Object.assign(
        query,
        buildKeywordQuery(schema, keyword, definition.search?.fields)
      );
    }

    Object.assign(query, normalizeQuery(rest, schema.obj));

    if (debug) {
      logger.info(
        `Search query for ${this.modelName}:\n`,
        JSON.stringify(query, null, 2)
      );
    }

    const mQuery = this.find(query)
      .sort(resolveSort(sort, schema))
      .skip(skip)
      .limit(limit);

    return wrapQuery(mQuery, async (promise) => {
      const [data, total] = await Promise.all([
        promise,
        this.countDocuments(query),
      ]);
      return {
        data,
        meta: {
          total,
          skip,
          limit,
        },
      };
    });
  });
}

export function searchValidation(options = {}) {
  const { defaults, definition, appendSchema } = options;

  const searchOptions = {
    ...SEARCH_DEFAULTS,
    ...pick(definition.search, 'limit', 'sort'),
    ...defaults,
  };

  const { limit, sort } = searchOptions;

  return yd.object({
    ids: yd.array(OBJECT_ID_SCHEMA),
    keyword: yd
      .string()
      .description('A keyword to perform a text search against.'),
    skip: yd.number().default(0).description('Number of records to skip.'),
    sort: getSortSchema(sort),
    limit: yd
      .number()
      .positive()
      .default(limit)
      .description('Limits the number of results.'),
    ...appendSchema,
  });
}

function getSortSchema(sort) {
  const schema = yd
    .object({
      field: yd.string().required(),
      order: yd.string().allow('desc', 'asc').required(),
    })
    .description('An object describing the sort order of results.');
  return yd.allow(schema, yd.array(schema)).default(sort);
}

function validateDefinition(definition) {
  if (Array.isArray(definition.search)) {
    warn(
      [
        '"search" field on model definition must not be an array.',
        'Use "search.fields" to define fields for keyword queries.',
      ].join('\n')
    );
    throw new Error('Invalid model definition.');
  }
}

function resolveSort(sort, schema) {
  if (!sort) {
    sort = [];
  } else if (!Array.isArray(sort)) {
    sort = [sort];
  }
  for (let { field } of sort) {
    if (!field || !schema.path(field)) {
      throw new Error(`Unknown sort field "${field}".`);
    }
  }
  return sort.map(({ field, order }) => {
    return [field, order === 'desc' ? -1 : 1];
  });
}

// Keyword queries
//
// Mongo supports text indexes, however search operations do not support partial
// word matches except for stemming rules (eg: "taste", "tastes", and "tasteful").
//
// Text indexes are preferred for performance, diacritic handling and more, however
// for smaller collections partial matches can be manually enabled by specifying an
// array of "search" fields on the definition:
//
// {
//   "attributes": {
//     "name": {
//       "type": "String",
//       "required": true,
//       "trim": true
//     },
//   },
//   "search": [
//     "name",
//     "description"
//   ]
// },
//
// Be aware that this may impact performance in which case moving to a text index
// may be preferable, however partial word matches will stop working. Support for
// ngram based text search appears to be coming but has no landing date yet.
//
// References:
// https://stackoverflow.com/questions/44833817/mongodb-full-and-partial-text-search
// https://jira.mongodb.org/browse/SERVER-15090

function buildKeywordQuery(schema, keyword, fields) {
  let queries;

  // Prefer defined search fields over
  // text indexes to perform keyword search.
  if (fields) {
    queries = buildRegexQuery(keyword, fields);
  } else if (hasTextIndex(schema)) {
    queries = [getTextQuery(keyword)];
  } else {
    throw new Error('No keyword fields defined.');
  }

  if (ObjectId.isValid(keyword)) {
    queries.push({ _id: keyword });
  }

  // Note: Mongo will error on empty $or/$and array.
  return queries.length ? { $or: queries } : {};
}

function buildRegexQuery(keyword, fields) {
  return fields.map((field) => {
    const regexKeyword = escapeRegExp(keyword);
    return {
      [field]: {
        $regex: `${regexKeyword}`,
        $options: 'i',
      },
    };
  });
}

function hasTextIndex(schema) {
  return schema.indexes().some(([spec]) => {
    return Object.values(spec).some((type) => {
      return type === 'text';
    });
  });
}

function getTextQuery(keyword) {
  return {
    $text: {
      $search: keyword,
    },
  };
}

// Normalizes mongo queries. Flattens plain nested paths
// to dot syntax while preserving mongo operators and
// handling specialed query syntax:
// ranges:
//  path: { min: n, max n }
// regex:
//  path: "/reg/"
// array:
//  path; [1,2,3]
function normalizeQuery(query, schema, root = {}, rootPath = []) {
  for (let [key, value] of Object.entries(query)) {
    const path = [...rootPath, key];
    if (isRangeQuery(schema, key, value)) {
      if (!isEmpty(value)) {
        root[path.join('.')] = mapOperatorQuery(value);
      }
    } else if (isNestedQuery(key, value)) {
      normalizeQuery(value, getField(schema, key), root, path);
    } else if (isRegexQuery(key, value)) {
      root[path.join('.')] = parseRegexQuery(value);
    } else if (isArrayQuery(key, value)) {
      root[path.join('.')] = { $in: value };
    } else {
      root[path.join('.')] = value;
    }
  }
  return root;
}

function isNestedQuery(key, value) {
  if (isMongoOperator(key) || !isPlainObject(value)) {
    return false;
  }
  return Object.keys(value).every((key) => {
    return !isMongoOperator(key);
  });
}

// Exclude "include" here as a special case.
function isArrayQuery(key, value) {
  return !isMongoOperator(key) && !isInclude(key) && Array.isArray(value);
}

function isRangeQuery(schema, key, value) {
  // Range queries only allowed on Date and Number fields.
  if (!isDateField(schema, key) && !isNumberField(schema, key)) {
    return false;
  }
  return typeof value === 'object';
}

function mapOperatorQuery(obj) {
  const query = {};
  for (let [key, val] of Object.entries(obj)) {
    if (isMongoOperator(key)) {
      query[key] = val;
    } else {
      query[`$${key}`] = val;
    }
  }
  return query;
}

function isMongoOperator(str) {
  return str.startsWith('$');
}

function isInclude(str) {
  return str === 'include';
}

// Regex queries

const REGEX_QUERY = /^\/(.+)\/(\w*)$/;

function isRegexQuery(key, value) {
  return REGEX_QUERY.test(value);
}

function parseRegexQuery(str) {
  // Note that using the $options syntax allows for PCRE features
  // that aren't supported in Javascript as compared to RegExp(...):
  // https://docs.mongodb.com/manual/reference/operator/query/regex/#pcre-vs-javascript
  const [, $regex, $options] = str.match(REGEX_QUERY);
  return {
    $regex,
    $options,
  };
}

// Search field caching

function applySearchCache(schema, definition) {
  normalizeCacheFields(schema, definition);

  if (!definition.search?.cache) {
    return;
  }

  createCacheFields(schema, definition);
  applyCacheHook(schema, definition);

  schema.static(
    'syncSearchFields',
    async function syncSearchFields(options = {}) {
      assertIncludeModule(this);

      const { force } = options;
      const { cache = {} } = definition.search || {};

      const paths = getCachePaths(definition);

      const cachedFields = Object.keys(cache);

      if (!cachedFields.length) {
        throw new Error('No search fields to sync.');
      }

      const query = {};

      if (!force) {
        const $or = Object.entries(cache).map((entry) => {
          const [cachedField, def] = entry;
          const { base } = def;
          return {
            [base]: {
              $exists: true,
            },
            [cachedField]: {
              $exists: false,
            },
          };
        });
        query.$or = $or;
      }

      const docs = await this.find(query).include(paths);

      const ops = docs.map((doc) => {
        return {
          updateOne: {
            filter: {
              _id: doc._id,
            },
            update: {
              $set: getUpdates(doc, paths, definition),
            },
          },
        };
      });

      return await this.bulkWrite(ops);
    }
  );
}

function normalizeCacheFields(schema, definition) {
  const { fields, cache = {} } = definition.search || {};
  if (!fields) {
    return;
  }

  const normalized = [];

  for (let path of fields) {
    if (isForeignField(schema, path)) {
      const cacheName = generateCacheFieldName(path);
      const type = resolveSchemaType(schema, path);
      const base = getRefBase(schema, path);
      cache[cacheName] = {
        type,
        base,
        path: path,
      };
      normalized.push(cacheName);
    } else {
      normalized.push(path);
    }
  }

  definition.search.cache = cache;
  definition.search.fields = normalized;
}

function createCacheFields(schema, definition) {
  for (let [cachedField, def] of Object.entries(definition.search.cache)) {
    // Fall back to string type for virtuals or not defined.
    const { type = 'String' } = def;
    schema.add({
      [cachedField]: type,
    });
    schema.obj[cachedField] = {
      type,
      readAccess: 'none',
    };
  }
}

function applyCacheHook(schema, definition) {
  schema.pre('save', async function () {
    assertIncludeModule(this.constructor);
    assertAssignModule(this.constructor);

    const doc = this;
    const paths = getCachePaths(definition, (cachedField, def) => {
      if (def.lazy) {
        return !get(doc, cachedField);
      } else {
        return true;
      }
    });

    await this.include(paths);
    this.assign(getUpdates(this, paths, definition));
  });
}

function resolveSchemaType(schema, path) {
  if (!path.includes('.')) {
    return get(schema.obj, path)?.type;
  }
  const field = getRefField(schema, path);
  if (field) {
    const { type, rest } = field;
    const Model = mongoose.models[type.options.ref];
    return resolveSchemaType(Model.schema, rest.join('.'));
  }
}

function isForeignField(schema, path) {
  if (!path.includes('.')) {
    return false;
  }
  return !!getRefField(schema, path);
}

function getRefBase(schema, path) {
  const field = getRefField(schema, path);
  if (field) {
    return field.base.join('.');
  }
}

function getRefField(schema, path) {
  const split = path.split('.');
  for (let i = 1; i < split.length; i++) {
    const base = split.slice(0, i);
    const rest = split.slice(i);
    const type = schema.path(base);
    if (type instanceof SchemaTypes.ObjectId) {
      return {
        type,
        base,
        rest,
      };
    }
  }
}

function getUpdates(doc, paths, definition) {
  const updates = {};

  const entries = Object.entries(definition.search.cache).filter((entry) => {
    return paths.includes(entry[1].path);
  });
  for (let [cachedField, def] of entries) {
    // doc.get will not return virtuals (even with specified options),
    // so use lodash to ensure they are included here.
    // https://mongoosejs.com/docs/api/document.html#Document.prototype.get()
    updates[cachedField] = get(doc, def.path);
  }
  return updates;
}

function getCachePaths(definition, filter) {
  filter ||= () => true;
  const { cache } = definition.search || {};
  return Object.entries(cache)
    .filter((entry) => {
      return filter(...entry);
    })
    .map((entry) => {
      return entry[1].path;
    });
}

function generateCacheFieldName(field) {
  return `cached${upperFirst(camelCase(field))}`;
}

// Assertions

function assertIncludeModule(Model) {
  if (!Model.schema.methods.include) {
    throw new Error('Include module is required for cached search fields.');
  }
}

function assertAssignModule(Model) {
  if (!Model.schema.methods.assign) {
    throw new Error('Assign module is required for cached search fields.');
  }
}
