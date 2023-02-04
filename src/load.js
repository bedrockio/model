import fs from 'fs';
import path from 'path';

import mongoose from 'mongoose';
import { startCase } from 'lodash-es';

import { createSchema } from './schema';

export function loadModel(definition, name) {
  if (!definition.attributes) {
    throw new Error(`Invalid model definition for ${name}, need attributes`);
  }
  try {
    const schema = createSchema(definition);
    return mongoose.model(name, schema);
  } catch (err) {
    throw new Error(`${err.message} (loading ${name})`);
  }
}

export function loadModelDir(dirPath) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const basename = path.basename(file, '.json');
    if (file.match(/\.json$/)) {
      const filePath = path.join(dirPath, file);
      const data = fs.readFileSync(filePath);
      const definition = JSON.parse(data);
      const modelName =
        definition.modelName || startCase(basename).replace(/\s/g, '');
      if (!mongoose.models[modelName]) {
        loadModel(definition, modelName);
      }
    }
  }
  return mongoose.models;
}
