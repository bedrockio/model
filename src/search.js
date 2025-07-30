import yd from '@bedrockio/yada';
import logger from '@bedrockio/logger';
import mongoose from 'mongoose';
import { pick, isEmpty, memoize, escapeRegExp, isPlainObject } from 'lodash';

import {
  getField,
  isArrayField,
  isDateField,
  isNumberField,
  isStringField,
  resolveRefPath,
} from './utils';

import { SEARCH_DEFAULTS } from './const';
import { OBJECT_ID_SCHEMA } from './validation-schemas';
import { debug } from './env';
import { mergeQuery, wrapQuery } from './query';

import warn from './warn';

const { ObjectId } = mongoose.Types;

export function applySearch(schema, definition) {
  validateDefinition(definition);
  validateSearchFields(schema, definition);

  const { search: config = {} } = definition;

  schema.static('search', function search(...args) {
    if (Array.isArray(args[0])) {
      return searchPipeline(this, args[0], args[1]);
    } else {
      return searchQuery(this, args[0], config);
    }
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

export function exportValidation(options = {}) {
  const { defaults, formats = ['csv'] } = options;
  const { filename = 'export.csv' } = defaults || {};
  return {
    filename: yd
      .string()
      .default(filename)
      .description('Filename when search is exported.'),
    format: yd
      .string()
      .allow('json', ...formats)
      .default('json'),
  };
}

function searchQuery(Model, options, config) {
  const { schema } = Model;

  options = mergeOptions(SEARCH_DEFAULTS, options);
  let { ids, keyword, skip, limit, sort, ...rest } = options;

  sort = resolveSort(sort, schema);

  let query = normalizeQuery(rest, schema.obj);

  if (ids?.length) {
    query = mergeQuery(query, {
      _id: { $in: ids },
    });
  }

  if (keyword) {
    const keywordQuery = buildKeywordQuery(schema, keyword, config);
    query = mergeQuery(query, keywordQuery);
  }

  if (debug) {
    logger.info(
      `Search query for ${Model.modelName}:\n`,
      JSON.stringify(query, null, 2),
    );
  }

  const mQuery = Model.find(query).sort(sort).skip(skip).limit(limit);

  return wrapQuery(mQuery, async (promise) => {
    const [data, total] = await Promise.all([
      promise,
      Model.countDocuments(query),
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
}

function searchPipeline(Model, pipeline, options) {
  const { schema } = Model;
  options = mergeOptions(SEARCH_DEFAULTS, options);

  let { skip, limit, sort } = options;
  sort = resolveSort(sort, schema);

  if (debug) {
    logger.info(
      `Search pipeline for ${Model.modelName}:\n`,
      JSON.stringify(pipeline, null, 2),
    );
  }

  const aggregate = Model.aggregate([
    ...pipeline,
    {
      $facet: {
        data: [
          {
            $sort: sort,
          },
          {
            $skip: skip,
          },
          {
            $limit: limit,
          },
        ],
        meta: [
          {
            $count: 'total',
          },
        ],
      },
    },
  ]);

  return wrapQuery(aggregate, async (promise) => {
    const result = await promise;
    const data = result[0].data;
    const total = result[0].meta[0]?.total ?? 0;
    return {
      data,
      meta: {
        skip,
        limit,
        total,
      },
    };
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
      ].join('\n'),
    );
    throw new Error('Invalid model definition.');
  }
}

function resolveSort(sort, schema) {
  if (!sort) {
    return { _id: 1 };
  }

  const result = {};

  if (!Array.isArray(sort)) {
    sort = [sort];
  }

  for (let { name, field, order } of sort) {
    if (name) {
      throw new Error(
        'Sort property "name" is not allowed. Use "field" instead.',
      );
    }
    if (!field.startsWith('$') && !schema.path(field)) {
      throw new Error(`Unknown sort field "${field}".`);
    }

    result[field] = order === 'desc' ? -1 : 1;
  }
  return result;
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

function buildKeywordQuery(schema, keyword, config) {
  if (hasTextIndex(schema)) {
    logger.debug('Using text index for keyword search.');
    return getTextIndexQuery(keyword);
  }

  keyword = escapeRegExp(keyword);

  const queries = [
    ...getDecomposedQueries(keyword, config),
    ...getFieldQueries(keyword, config),
  ];

  // Note: Mongo will error on empty $or/$and array.
  if (queries.length > 1) {
    return {
      $or: queries,
    };
  } else if (queries.length) {
    return queries[0];
  } else {
    logger.debug('Could not find search fields on the model.');
    throw new Error('Could not compose keyword query.');
  }
}

function getTextIndexQuery(keyword) {
  return {
    $text: {
      $search: keyword,
    },
  };
}

function getDecomposedQueries(keyword, config) {
  const { decompose } = config;
  if (!decompose) {
    return [];
  }

  const decomposers = compileDecomposers(decompose);

  return decomposers
    .map((decomposer) => {
      return decomposer(keyword);
    })
    .filter(Boolean);
}

function compileDecomposers(arg) {
  const arr = Array.isArray(arg) ? arg : [arg];
  return arr.map(compileDecomposer);
}

const DECOMPOSE_TEMPLATE_REG = /{(\w+)(\.\.\.)?}/g;

const compileDecomposer = memoize((template) => {
  if (!template.match(DECOMPOSE_TEMPLATE_REG)) {
    throw new Error(`Could not compile decompose template ${template}.`);
  }

  const fields = [];

  let src = template;
  src = src.replace(DECOMPOSE_TEMPLATE_REG, (_, field, rest) => {
    fields.push(field);
    return rest ? '(.+)' : '(\\S+)';
  });
  src = src.replace(/\s+/, '\\s+');
  const reg = RegExp(src);

  return (keyword) => {
    const match = keyword.match(reg);
    if (match) {
      const query = {};
      fields.forEach((field, i) => {
        query[field] = {
          $regex: match[i + 1],
          $options: 'i',
        };
      });
      return query;
    }
  };
});

function getFieldQueries(keyword, config) {
  const { fields } = config;

  if (!fields) {
    return [];
  }

  const queries = fields.map((field) => {
    return {
      [field]: {
        $regex: keyword,
        $options: 'i',
      },
    };
  });

  if (ObjectId.isValid(keyword)) {
    queries.push({ _id: keyword });
  }

  return queries;
}

function hasTextIndex(schema) {
  return schema.indexes().some(([spec]) => {
    return Object.values(spec).some((type) => {
      return type === 'text';
    });
  });
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
    } else if (isEmptyArrayQuery(schema, key, value)) {
      root[path.join('.')] = [];
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

function isEmptyArrayQuery(schema, key, value) {
  return !isMongoOperator(key) && isArrayField(schema, key) && value === null;
}

function isRangeQuery(schema, key, value) {
  if (!isPlainObject(value)) {
    return false;
  }

  // Range queries allowed on Date, Number, and String fields.
  return (
    isDateField(schema, key) ||
    isNumberField(schema, key) ||
    isStringField(schema, key)
  );
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

function validateSearchFields(schema, definition) {
  const { fields } = definition.search || {};

  if (!fields) {
    return;
  }

  for (let path of fields) {
    if (isForeignField(schema, path)) {
      throw new Error(`Foreign field "${path}" not allowed in search.`);
    }
  }
}

// Utils

function isForeignField(schema, path) {
  if (!path.includes('.')) {
    return false;
  }
  return !!resolveRefPath(schema, path);
}

// Merge options together. Do not perform deep merge
// however the sort options do need to also be merged.
function mergeOptions(...sources) {
  let result = {};
  for (let source of sources) {
    result = {
      ...result,
      ...source,
      sort: mergeSort(result.sort, source?.sort),
    };
  }

  return result;
}

function mergeSort(sort1, sort2) {
  if (Array.isArray(sort2)) {
    return sort2;
  }
  return { ...sort1, ...sort2 };
}
