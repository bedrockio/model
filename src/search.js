import yd from '@bedrockio/yada';
import logger from '@bedrockio/logger';
import mongoose from 'mongoose';
import { pick, isEmpty, isPlainObject } from 'lodash';

import { isDateField, isNumberField, getField } from './utils';
import { SEARCH_DEFAULTS } from './const';
import { OBJECT_ID_SCHEMA } from './validation';
import { debug } from './env';

import warn from './warn';

const { ObjectId } = mongoose.Types;

export function applySearch(schema, definition) {
  validateDefinition(definition);

  schema.static('search', function search(body = {}) {
    const options = {
      ...SEARCH_DEFAULTS,
      ...definition.search,
      ...body,
    };

    const { ids, keyword, skip = 0, limit, sort, fields, ...rest } = options;

    const query = {};

    if (ids?.length) {
      query._id = { $in: ids };
    }

    if (keyword) {
      Object.assign(query, buildKeywordQuery(schema, keyword, fields));
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

    // The following construct is awkward but it allows the mongoose query
    // object to be returned while still ultimately resolving with metadata
    // so that this method can behave like other find methods and importantly
    // allow custom population with the same API.

    const runQuery = mQuery.then.bind(mQuery);

    mQuery.then = async (resolve, reject) => {
      try {
        const [data, total] = await Promise.all([
          runQuery(),
          this.countDocuments(query),
        ]);
        resolve({
          data,
          meta: {
            total,
            skip,
            limit,
          },
        });
      } catch (err) {
        reject(err);
      }
    };

    return mQuery;
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
    queries = [];
  }

  if (ObjectId.isValid(keyword)) {
    queries.push({ _id: keyword });
  }

  return { $or: queries };
}

function buildRegexQuery(keyword, fields) {
  return fields.map((field) => {
    const regexKeyword = keyword.replace(/\+/g, '\\+');
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
