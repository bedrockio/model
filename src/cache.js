import { get, groupBy, once } from 'lodash';
import mongoose from 'mongoose';

import { resolveRefPath } from './utils';

const definitionMap = new Map();

mongoose.plugin(cacheSyncPlugin);

export function addCacheFields(definition) {
  const { cache } = definition;

  if (!cache) {
    return;
  }

  for (let [cachedField, def] of Object.entries(cache)) {
    const { type, path, ...rest } = def;
    definition.attributes[cachedField] = {
      type,
      ...rest,
      writeAccess: 'none',
    };
  }
}

export function applyCache(schema, definition) {
  definitionMap.set(schema, definition);

  if (!definition.cache) {
    return;
  }

  applyStaticMethods(schema, definition);
  applyCacheHook(schema, definition);
}

function applyStaticMethods(schema, definition) {
  schema.static('syncCacheFields', async function syncCacheFields() {
    assertIncludeModule(this);

    const fields = resolveCachedFields(schema, definition);

    const hasSynced = fields.some((entry) => {
      return entry.sync;
    });

    const query = {};

    if (!hasSynced) {
      const $or = fields.map((field) => {
        return {
          [field.name]: null,
        };
      });
      query.$or = $or;
    }

    const includes = getIncludes(fields);
    const docs = await this.find(query).include(includes);

    const ops = docs.flatMap((doc) => {
      return fields.map((field) => {
        const { name, sync } = field;
        const updates = getUpdates(doc, [field]);
        const filter = {
          _id: doc._id,
        };
        if (!sync) {
          filter[name] = null;
        }
        return {
          updateOne: {
            filter,
            update: {
              $set: updates,
            },
          },
        };
      });
    });

    return await this.bulkWrite(ops);
  });
}

function applyCacheHook(schema, definition) {
  const fields = resolveCachedFields(schema, definition);
  schema.pre('save', async function () {
    assertIncludeModule(this.constructor);
    assertAssignModule(this.constructor);

    const doc = this;

    const changes = fields.filter((field) => {
      const { sync, local, name } = field;
      if (sync || doc.isModified(local)) {
        // Always update if we are actively syncing
        // or if the field has been changed.
        return true;
      } else {
        // Otherwise only update if the value does
        // not exist yet.
        const value = get(doc, name);
        return Array.isArray(value) ? !value.length : !value;
      }
    });

    await this.include(getIncludes(changes));
    this.assign(getUpdates(doc, changes));
  });
}

// Syncing

const syncOperations = {};
const compiledModels = new Set();

function cacheSyncPlugin(schema) {
  // Compile sync fields each time a new schema
  // is registered but only do it one time for.
  const initialize = once(compileSyncOperations);

  schema.pre('save', async function () {
    this.$locals.modifiedPaths = this.modifiedPaths();
  });

  schema.post('save', async function () {
    initialize();

    // @ts-ignore
    const { modelName } = this.constructor;

    const ops = syncOperations[modelName] || [];
    for (let op of ops) {
      await op(this);
    }
  });
}
function compileSyncOperations() {
  for (let Model of Object.values(mongoose.models)) {
    const { schema } = Model;

    if (compiledModels.has(Model)) {
      // Model has already been compiled so skip.
      continue;
    }

    const definition = definitionMap.get(schema);

    if (!definition) {
      continue;
    }

    const fields = resolveCachedFields(schema, definition);

    for (let [ref, group] of Object.entries(groupBy(fields, 'ref'))) {
      const hasSynced = group.some((entry) => {
        return entry.sync;
      });

      if (!hasSynced) {
        continue;
      }

      const fn = async (doc) => {
        const { modifiedPaths } = doc.$locals;
        const changes = group.filter((entry) => {
          return entry.sync && modifiedPaths.includes(entry.foreign);
        });

        if (changes.length) {
          const $or = changes.map((change) => {
            const { local } = change;
            return {
              [local]: doc.id,
            };
          });

          const docs = await Model.find({
            $or,
          });

          await Promise.all(docs.map((doc) => doc.save()));
        }
      };
      syncOperations[ref] ||= [];
      syncOperations[ref].push(fn);
    }

    compiledModels.add(Model);
  }
}

// Utils

function resolveCachedFields(schema, definition) {
  const { cache = {} } = definition;
  return Object.entries(cache).map(([name, def]) => {
    const { path, sync = false } = def;
    const resolved = resolveRefPath(schema, path);
    if (!resolved) {
      throw new Error(`Could not resolve path ${path}.`);
    }

    return {
      ...resolved,
      name,
      path,
      sync,
    };
  });
}

function getUpdates(doc, fields) {
  const updates = {};

  for (let field of fields) {
    const { name, path } = field;

    // doc.get will not return virtuals (even with specified options),
    // so fall back to lodash to ensure they are included here.
    // https://mongoosejs.com/docs/api/document.html#Document.prototype.get()
    const value = doc.get(path) ?? get(doc, path);

    updates[name] = value;
  }

  return updates;
}

function getIncludes(fields) {
  const includes = new Set();
  for (let field of fields) {
    includes.add(getPathBase(field.path));
  }
  return includes;
}

function getPathBase(path) {
  return path.split('.').slice(0, -1).join('.');
}

// Assertions

function assertIncludeModule(Model) {
  if (!Model.schema.methods.include) {
    throw new Error('Include module is required for cached fields.');
  }
}

function assertAssignModule(Model) {
  if (!Model.schema.methods.assign) {
    throw new Error('Assign module is required for cached fields.');
  }
}
