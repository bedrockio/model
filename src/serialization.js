import { isPlainObject } from 'lodash';

import { checkSelects } from './include';
import { hasReadAccess } from './access';
import { getField, getInnerField } from './utils';

export const serializeOptions = {
  getters: true,
  versionKey: false,
  transform: (doc, ret, options) => {
    options.document = doc;
    checkSelects(doc, ret);
    transformField(ret, doc.schema.obj, options);
  },
};

function transformField(obj, field, options) {
  if (Array.isArray(obj)) {
    for (let el of obj) {
      transformField(el, field, options);
    }
  } else if (isPlainObject(obj)) {
    for (let [key, val] of Object.entries(obj)) {
      if (!isAllowedField(key, field, options)) {
        delete obj[key];
      } else {
        transformField(val, getInnerField(field, key), options);
      }
    }
  }
}

function isAllowedField(key, field, options) {
  if (key[0] === '_') {
    // Strip internal keys like _id and __v
    return false;
  } else if (key === 'deleted') {
    // Strip "deleted" field which defaults
    // to false and should not be exposed.
    return false;
  } else {
    const { readAccess } = getField(field, key);
    try {
      return hasReadAccess(readAccess, options);
    } catch {
      return false;
    }
  }
}
