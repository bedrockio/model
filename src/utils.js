import mongoose from 'mongoose';

export function isMongooseSchema(obj) {
  return obj instanceof mongoose.Schema;
}

export function isReferenceField(obj, path) {
  return isType(obj, path, 'ObjectId');
}

export function isDateField(obj, path) {
  return isType(obj, path, 'Date');
}

export function isNumberField(obj, path) {
  return isType(obj, path, 'Number');
}

function isType(obj, path, test) {
  const { type } = resolveInnerField(obj, path);
  return type === test || type === mongoose.Schema.Types[test];
}

export function isSchemaTypedef(arg) {
  // Has a type defined and is not a literal type field.
  return arg?.type && !arg.type?.type;
}

// Note: Resolved field may be an object or a function
// from mongoose.Schema.Types that is resolved from the
// shorthand: field: 'String'.
export function resolveField(obj, path) {
  let typedef = obj;
  for (let key of path.split('.')) {
    typedef = resolveFieldForKey(typedef, key);
  }
  return typedef;
}

// The same as resolveField but gets the element
// typedef in the case of arrays.
export function resolveInnerField(obj, path) {
  let typedef = resolveField(obj, path);
  if (Array.isArray(typedef.type)) {
    typedef = typedef.type[0];
  }
  return typedef;
}

function resolveFieldForKey(obj, key) {
  let typedef;
  if (isSchemaTypedef(obj)) {
    const { type } = obj;
    if (Array.isArray(type)) {
      typedef = type[0][key];
    } else {
      typedef = type[key];
    }
  } else {
    typedef = obj[key];
  }
  return typedef || {};
}
