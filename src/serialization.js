import { isPlainObject } from 'lodash';

import { checkSelects } from './include';
import { resolveField } from './utils';

export const serializeOptions = {
  getters: true,
  versionKey: false,
  transform: (doc, ret, options) => {
    checkSelects(doc, ret);
    transformField(ret, doc.schema.obj, options);
  },
};

function transformField(obj, schema, options) {
  if (Array.isArray(obj)) {
    for (let el of obj) {
      transformField(el, schema, options);
    }
  } else if (isPlainObject(obj)) {
    // Export "id" virtual instead of "_id"
    if (!obj.id && obj._id) {
      obj.id = obj._id;
    }
    for (let [key, val] of Object.entries(obj)) {
      // Omit any key with a private prefix "_" or marked
      // with "readScopes" in the schema.
      if (!isAllowedField(schema, key, options)) {
        delete obj[key];
      } else if (schema[key]) {
        transformField(val, resolveField(schema, key), options);
      }
    }
  }
}

function isAllowedField(schema, key, options) {
  if (key[0] === '_') {
    // Strip internal _id and __v fields
    return false;
  } else if (key === 'deleted') {
    // Strip "deleted" field which defaults
    // to false and should not be exposed.
    return false;
  } else if (!schema[key]) {
    // No schema defined may be virtuals.
    return true;
  }
  const { readScopes = 'all' } = resolveField(schema, key) || {};
  if (readScopes === 'all') {
    return true;
  } else if (Array.isArray(readScopes)) {
    const scopes = resolveScopes(options);
    return readScopes.some((scope) => {
      return scopes.includes(scope);
    });
  } else {
    return false;
  }
}

function resolveScopes(options) {
  const { scope, scopes = [] } = options;
  return scope ? [scope] : scopes;
}
