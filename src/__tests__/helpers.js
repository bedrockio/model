import { dirname } from 'path';
import { fileURLToPath } from 'url';

import mongoose from 'mongoose';

import { createSchema } from '../schema';

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

export async function setupDb() {
  // ENVs are set by jest-mongodb:
  // global.__MONGO_URI__;
  // global.__MONGO_DB_NAME__;
  // Take the URI path from MONGO_URI with the default db name,
  // and replace with per test unique db name: MONGO_DB_NAME
  const mongoURL =
    'mongodb://' +
    global.__MONGO_URI__.split('/')[2] +
    '/' +
    global.__MONGO_DB_NAME__;

  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(mongoURL);
  } catch (err) {
    // eslint-disable-next-line
    console.error(err);
    process.exit(1);
  }
}

export async function teardownDb() {
  await mongoose.disconnect();
}

export function getDirname(url) {
  return dirname(fileURLToPath(url));
}

beforeAll(async () => {
  await setupDb();
});

afterAll(async () => {
  await teardownDb();
});
