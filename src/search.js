import yd from '@bedrockio/yada';
import mongoose from 'mongoose';
import { isEmpty, isPlainObject } from 'lodash-es';

import { isDateField, isNumberField, resolveField } from './utils';

const { ObjectId } = mongoose.Types;

const DEFAULT_LIMIT = 50;
// TODO: default limit/sort on attributes, allow arrays
const DEFAULT_SORT = { field: 'createdAt', order: 'desc' };

export function applySearch(schema, definition) {
  schema.static('search', function search(body = {}) {
    const {
      ids,
      keyword,
      skip = 0,
      limit = DEFAULT_LIMIT,
      sort = DEFAULT_SORT,
      ...rest
    } = body;
    const query = {};

    if (ids?.length) {
      query._id = { $in: ids };
    }

    if (keyword) {
      Object.assign(query, buildKeywordQuery(keyword, definition));
    }

    Object.assign(query, normalizeQuery(rest, schema.obj));

    const mQuery = this.find(query)
      .sort(sort && { [sort.field]: sort.order === 'desc' ? -1 : 1 })
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
  const { sort = DEFAULT_SORT, limit = DEFAULT_LIMIT, ...rest } = options;
  return {
    ids: yd.array(yd.string()),
    keyword: yd.string(),
    include: yd.string(),
    skip: yd.number().default(0),
    sort: yd
      .object({
        field: yd.string().required(),
        order: yd.string().allow('desc', 'asc').required(),
      })
      .default(sort),
    limit: yd.number().positive().default(limit),
    ...rest,
  };
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

function buildKeywordQuery(keyword, definition) {
  if (definition.search) {
    return buildRegexQuery(keyword, definition);
  } else {
    return buildTextIndexQuery(keyword);
  }
}

function buildRegexQuery(keyword, definition) {
  const queries = definition.search.map((field) => {
    const regexKeyword = keyword.replace(/\+/g, '\\+');
    return {
      [field]: {
        $regex: `${regexKeyword}`,
        $options: 'i',
      },
    };
  });
  if (ObjectId.isValid(keyword)) {
    queries.push({ _id: keyword });
  }
  return { $or: queries };
}

function buildTextIndexQuery(keyword) {
  if (ObjectId.isValid(keyword)) {
    return {
      $or: [{ $text: { $search: keyword } }, { _id: keyword }],
    };
  } else {
    return {
      $text: {
        $search: keyword,
      },
    };
  }
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
      normalizeQuery(value, resolveField(schema, key), root, path);
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

function isArrayQuery(key, value) {
  return !isMongoOperator(key) && Array.isArray(value);
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
    query[`$${key}`] = val;
  }
  return query;
}

function isMongoOperator(str) {
  return str.startsWith('$');
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
