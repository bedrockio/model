import fs from 'fs';
import path from 'path';

import { parse as parseWithComments } from 'jsonc-parser';
import { kebabCase } from 'lodash';
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

    const { name: basename } = path.parse(file);
    const definition = loadDefinition(basename, dir);
    const modelName = getModelName(definition, basename);

    if (!mongoose.models[modelName]) {
      loadModel(definition, modelName);
    }
  }
  return mongoose.models;
}

/**
 * Loads the schema from a .json or .jsonc file.
 * @param {string} name - The model or schema name.
 * @param {string} [dir] - The schema directory (defaults to `src/models/definitions`)
 */
export function loadSchema(name, dir) {
  const definition = loadDefinition(name, dir);
  return createSchema(definition);
}

const DEFINITION_DIR = 'src/models/definitions';
const SCHEMA_EXTENSIONS = ['.json', '.jsonc'];

export function loadDefinition(name, dir) {
  const { filepath, ext } = resolvePath(name, dir);
  const content = fs.readFileSync(filepath, 'utf-8');
  return ext === '.jsonc' ? parseWithComments(content) : JSON.parse(content);
}

function resolvePath(name, dir = DEFINITION_DIR) {
  if (name.includes('.')) {
    throw new Error('Name should not include extension');
  }

  let filename = kebabCase(name);
  let ext = path.extname(name);

  if (!ext) {
    ext = resolveExtension(filename, dir);

    if (ext) {
      filename += ext;
    } else {
      throw new Error(`No .json or .jsonc file found for: ${name}`);
    }
  }

  if (!SCHEMA_EXTENSIONS.includes(ext)) {
    throw new Error(`Schema files must be .json or .jsonc`);
  }

  const filepath = path.resolve(dir, filename);

  return {
    ext,
    filepath,
  };
}

function resolveExtension(filename, dir) {
  for (const ext of SCHEMA_EXTENSIONS) {
    const filepath = path.resolve(dir, filename + ext);
    if (fs.existsSync(filepath)) {
      return ext;
    }
  }
}

function getModelName(definition, basename) {
  return definition.modelName || startCase(basename).replace(/\s/g, '');
}
