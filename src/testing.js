import mongoose from 'mongoose';

import { createSchema } from './schema';

let counter = 0;

export function createTestModel(arg, modelName) {
  const schema = isSchema(arg) ? arg : createSchemaFromAttributes(arg);
  modelName ||= getTestModelName();
  return mongoose.model(modelName, schema);
}

export function getTestModelName() {
  return `SchemaTestModel${counter++}`;
}

export function createSchemaFromAttributes(attributes) {
  return createSchema({ attributes });
}

function isSchema(obj) {
  return obj instanceof mongoose.Schema;
}
