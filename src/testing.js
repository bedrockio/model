import mongoose from 'mongoose';

import { createSchema } from './schema';
import { isMongooseSchema } from './utils';

let counter = 0;

/**
 * Helper to quickly create models for testing.
 * Accepts a definition's `attributes` object and
 * an optional model name as the first argument.
 * [Link](https://github.com/bedrockio/model#testing)
 * @returns mongoose.Model
 */
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
