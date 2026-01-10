import fs from 'fs';
import path from 'path';

import { parse as parseWithComments } from 'jsonc-parser';
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
 * @param {string} dir
 */
export function loadModelDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const ext = path.extname(file);

    if (!SCHEMA_EXTENSIONS.includes(ext)) {
      continue;
    }

    const filepath = path.join(dir, file);
    const definition = loadDefinition(filepath);
    const modelName = getModelName(definition, filepath);

    if (!mongoose.models[modelName]) {
      loadModel(definition, modelName);
    }
  }
  return mongoose.models;
}

export function loadSchema(input) {
  const definition = loadDefinition(input);
  return createSchema(definition);
}

const SCHEMA_EXTENSIONS = ['.json', '.jsonc'];

function loadDefinition(input) {
  const { filepath, ext } = resolvePath(input);
  const content = fs.readFileSync(filepath, 'utf-8');
  return ext === '.jsonc' ? parseWithComments(content) : JSON.parse(content);
}

function resolvePath(filepath) {
  let ext = path.extname(filepath);

  if (!ext) {
    ext = resolveSchemaExtension(filepath);
    filepath += ext;
  }

  if (!ext) {
    throw new Error(`No .json or .jsonc file found for: ${filepath}`);
  } else if (!SCHEMA_EXTENSIONS.includes(ext)) {
    throw new Error(`Schema files must be .json or .jsonc`);
  }

  return {
    ext,
    filepath: filepath,
  };
}

function resolveSchemaExtension(input) {
  for (const ext of SCHEMA_EXTENSIONS) {
    const filepath = input + ext;
    if (fs.existsSync(filepath)) {
      return ext;
    }
  }
}

function getModelName(definition, filepath) {
  const { name: filename } = path.parse(filepath);
  return definition.modelName || startCase(filename).replace(/\s/g, '');
}
