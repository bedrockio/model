import { isPlainObject } from 'lodash';
import mongoose from 'mongoose';

import { isReferenceField, getField } from './utils';

export function applyAssign(schema) {
  schema.method('assign', function assign(fields) {
    unsetReferenceFields(fields, schema.obj);
    for (let [path, value] of Object.entries(flattenObject(fields))) {
      if (value === null) {
        this.set(path, undefined);
      } else {
        this.set(path, value);
      }
    }
  });
}

// Sets falsy reference fields to undefined to signal
// removal. Passing attributes through this function
// normalizes falsy values so they are not saved to the db.
function unsetReferenceFields(fields, schema = {}) {
  for (let [key, value] of Object.entries(fields)) {
    if (!value && isReferenceField(schema, key)) {
      fields[key] = undefined;
    } else if (value instanceof mongoose.Document) {
      fields[key] = value;
    } else if (value && typeof value === 'object') {
      unsetReferenceFields(value, getField(schema, key));
    }
  }
}

// Flattens nested objects to a dot syntax.
// Effectively the inverse of lodash get:
// { foo: { bar: 3 } } -> { 'foo.bar': 3 }
function flattenObject(obj, root = {}, rootPath = []) {
  for (let [key, val] of Object.entries(obj)) {
    const path = [...rootPath, key];
    if (isPlainObject(val)) {
      flattenObject(val, root, path);
    } else {
      root[path.join('.')] = val;
    }
  }
  return root;
}
