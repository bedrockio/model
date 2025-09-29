import { isPlainObject } from 'lodash';

import { hasAccess } from './access';
import { checkSelects } from './include';
import { getField, getInnerField } from './utils';

const DISALLOWED_FIELDS = ['deleted', 'deletedRefs'];

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
        // Although the "id" field is automatically added for most
        // documents, this doesn't appear to be the case for mongoose
        // schemas with a "type" field that is an array. For example:
        //
        // "type": [
        //   {
        //     "name": "String"
        //   }
        // ]
        //
        // This may be a mongoose bug.
        // The "type": "Array" extended syntax wraps this behavior, so
        // to keep consistency with other array field declaration types,
        // force the "id" field to be set here.
        if (key === '_id') {
          obj.id = val.toString();
        }
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
  } else if (DISALLOWED_FIELDS.includes(key)) {
    // Strip "deleted" field which defaults
    // to false and should not be exposed.
    return false;
  } else {
    const { readAccess } = getField(field, key);
    try {
      return hasAccess(readAccess, options);
    } catch {
      return false;
    }
  }
}
