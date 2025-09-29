import fs from 'fs';
import path from 'path';

import { startCase } from 'lodash';
import mongoose from 'mongoose';

import { createSchema } from './schema';

/**
 * Loads a single model by definition and name.
 * @param {object} definition
 * @param {string} name
 * @returns mongoose.Model
 */
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

/**
 * Loads all model definitions in the given directory.
 * Returns the full loaded model set.
 * @param {string} dirPath
 */
export function loadModelDir(dirPath) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const basename = path.basename(file, '.json');
    if (file.match(/\.json$/)) {
      const filePath = path.join(dirPath, file);
      const data = fs.readFileSync(filePath, 'utf-8');
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
