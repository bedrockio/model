import { isPlainObject } from 'lodash';
import mongoose from 'mongoose';

import { isReferenceField, getField } from './utils';

export function applyAssign(schema) {
  schema.method('assign', function assign(fields) {
    unsetReferenceFields(fields, schema.obj);
    for (let [path, value] of Object.entries(flattenObject(fields))) {
      if (value === null || value === '') {
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
    } else if (hasEnumerableFields(value)) {
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
    if (hasEnumerableFields(val)) {
      flattenObject(val, root, path);
    } else {
      root[path.join('.')] = val;
    }
  }
  return root;
}

// Only plain objects and arrays with fields should
// be enumerated to allow setting of their inner fields.
// Note that mongoose documents etc should NOT be enumerated
// over as their value should be set directly for the field.
// Additionally if an array is empty it should not have its
// fields enumerated but instead directly set the empty array
// for the field.
function hasEnumerableFields(arg) {
  if (isPlainObject(arg) || Array.isArray(arg)) {
    return Object.keys(arg).length > 0;
  }
  return false;
}
