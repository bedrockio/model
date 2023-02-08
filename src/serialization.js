import { isPlainObject } from 'lodash';

import { checkSelects } from './include';
import { resolveField } from './utils';

export const serializeOptions = {
  getters: true,
  versionKey: false,
  transform: (doc, ret, options) => {
    options.doc = doc;
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
  let { readScopes = 'all' } = resolveField(schema, key) || {};
  if (readScopes === 'all') {
    return true;
  } else if (readScopes === 'none') {
    return false;
  } else {
    const { doc, authUser } = options;
    if (!Array.isArray(readScopes)) {
      readScopes = [readScopes];
    }
    const scopes = resolveScopes(options);
    return readScopes.some((scope) => {
      if (scope === 'self') {
        assertAuthUser(scope, options);
        return doc.id == authUser.id;
      } else if (scope === 'user') {
        assertAuthUser(scope, options);
        return doc.user?.id == authUser.id;
      } else if (scope === 'owner') {
        assertAuthUser(scope, options);
        return doc.owner?.id == authUser.id;
      } else {
        return scopes.includes(scope);
      }
    });
  }
}

function resolveScopes(options) {
  const { scope, scopes = [] } = options;
  return scope ? [scope] : scopes;
}

function assertAuthUser(scope, options) {
  if (!options.authUser) {
    throw new Error(`Read scope "${scope}" requires .toObject({ authUser }).`);
  }
}
