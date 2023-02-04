import mongoose from 'mongoose';
import { get } from 'lodash-es';

const {
  Date: SchemaDate,
  Number: SchemaNumber,
  ObjectId: SchemaObjectId,
} = mongoose.Schema.Types;

export function isMongooseSchema(obj) {
  return obj instanceof mongoose.Schema;
}

export function isReferenceField(schema, key) {
  return resolveFieldSchema(schema, key) === SchemaObjectId;
}

export function isDateField(schema, key) {
  return resolveFieldSchema(schema, key) === SchemaDate;
}

export function isNumberField(schema, key) {
  return resolveFieldSchema(schema, key) === SchemaNumber;
}

export function resolveFieldSchema(schema, key) {
  const field = resolveField(schema, key);
  return field?.type || field;
}

// Note: Resolved field may be an object or a function
// from mongoose.Schema.Types that is resolved from the
// shorthand: field: 'String'.
export function resolveField(schema, key) {
  let field = get(schema, key);
  if (Array.isArray(field)) {
    field = field[0];
  }
  // A literal "type" field may be defined as:
  //  "type": {
  //    "type": "String",
  //    "required": true,
  //  }
  const type = field?.type;
  if (typeof type === 'object' && !type.type) {
    field = field.type;
  }
  return field;
}
