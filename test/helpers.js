import mongoose from 'mongoose';

import { createSchema } from '../src/schema';

let counter = 0;

export function createTestModel(schema, modelName) {
  modelName ||= getTestModelName();
  schema ||= createSchemaFromAttributes();
  return mongoose.model(modelName, schema);
}

export function getTestModelName() {
  return `SchemaTestModel${counter++}`;
}

export function createSchemaFromAttributes(attributes = {}) {
  return createSchema({ attributes });
}
