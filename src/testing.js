import mongoose from 'mongoose';

import { createSchema } from './schema';
import { isMongooseSchema } from './utils';

let counter = 0;

export function createTestModel(...args) {
  let modelName, attributes, schema;
  if (typeof args[0] === 'string') {
    modelName = args[0];
    attributes = args[1];
  } else {
    attributes = args[0];
  }
  if (isMongooseSchema(attributes)) {
    schema = attributes;
  } else {
    schema = createSchema({
      attributes,
    });
  }
  modelName ||= getTestModelName();
  return mongoose.model(modelName, schema);
}

export function getTestModelName() {
  return `TestModel${counter++}`;
}
