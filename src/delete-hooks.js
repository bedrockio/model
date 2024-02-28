import mongoose from 'mongoose';
import { groupBy } from 'lodash';

import { ReferenceError } from './errors';
import { getInnerField } from './utils';

const { ObjectId: SchemaObjectId } = mongoose.Schema.Types;

export function applyDeleteHooks(schema, definition) {
  let { onDelete: deleteHooks } = definition;

  if (!deleteHooks) {
    return;
  }

  const errorHook = validateError(deleteHooks);
  const cleanHooks = validateCleanHooks(deleteHooks, schema);

  let references;

  const deleteFn = schema.methods.delete;
  const restoreFn = schema.methods.restore;

  schema.method('delete', async function () {
    if (errorHook) {
      references ||= getAllReferences(this);
      await errorOnForeignReferences(this, {
        errorHook,
        cleanHooks,
        references,
      });
    }
    try {
      await deleteReferences(this, cleanHooks);
    } catch (error) {
      await restoreReferences(this, cleanHooks);
      throw error;
    }
    await deleteFn.apply(this, arguments);
  });

  schema.method('restore', async function () {
    await restoreReferences(this, cleanHooks);
    await restoreFn.apply(this, arguments);
  });

  schema.add({
    deletedRefs: [
      {
        _id: 'ObjectId',
        ref: 'String',
      },
    ],
  });
}

// Clean Hook

function validateCleanHooks(deleteHooks, schema) {
  const { clean } = deleteHooks;
  if (!clean) {
    return [];
  }
  if (!Array.isArray(clean)) {
    throw new Error('Delete clean hook must be an array.');
  }

  for (let hook of clean) {
    const { ref, path, paths } = hook;
    if (path && typeof path !== 'string') {
      throw new Error('Clean hook path must be a string.');
    } else if (paths && !Array.isArray(paths)) {
      throw new Error('Clean hook paths must be an array.');
    } else if (!path && !paths) {
      throw new Error('Clean hook must define either "path" or "paths".');
    } else if (path && paths) {
      throw new Error('Clean hook may not define both "path" or "paths".');
    } else if (ref && typeof ref !== 'string') {
      throw new Error('Clean hook ref must be a string.');
    } else if (!ref) {
      validateLocalCleanHook(hook, schema);
    }
  }

  return clean;
}

function validateLocalCleanHook(hook, schema) {
  const paths = getHookPaths(hook);
  for (let path of paths) {
    if (schema.pathType(path) !== 'real') {
      throw new Error(`Invalid reference in local delete hook: "${path}".`);
    }
  }
}

function getHookPaths(hook) {
  const { path, paths } = hook;
  if (path) {
    return [path];
  } else if (paths) {
    return paths;
  } else {
    return [];
  }
}

function validateError(deleteHooks) {
  let { errorOnReferenced } = deleteHooks;
  if (!errorOnReferenced) {
    return;
  }

  if (errorOnReferenced === true) {
    errorOnReferenced = {};
  }

  return errorOnReferenced;
}

// Error on references

async function errorOnForeignReferences(doc, options) {
  const { errorHook, references } = options;

  if (!errorHook) {
    return;
  }

  const { only, except } = errorHook;

  assertModelNames(only);
  assertModelNames(except);

  const results = [];

  for (let { model, paths } of references) {
    if (referenceIsAllowed(model, options)) {
      continue;
    }

    const { modelName } = model;

    for (let path of paths) {
      const docs = await model
        .find(
          {
            [path]: doc.id,
          },
          { _id: 1 }
        )
        .lean();

      if (docs.length > 0) {
        const ids = docs.map((doc) => {
          return String(doc._id);
        });
        const strId = ids.join(', ');
        const message = `Referenced as "${path}" by ${modelName}: ${strId}.`;
        results.push({
          ids,
          path,
          message,
          model: modelName,
        });
      }
    }
  }

  if (results.length) {
    const { modelName } = doc.constructor;
    throw new ReferenceError(`Refusing to delete ${modelName}.`, results);
  }
}

function referenceIsAllowed(model, options) {
  const { modelName } = model;
  const { cleanHooks } = options;

  const hasCleanHook = cleanHooks.some((hook) => {
    return hook.ref === modelName;
  });
  if (hasCleanHook) {
    return true;
  }

  const { only, except } = options?.errorHook || {};
  if (only) {
    return !only.includes(model.modelName);
  } else if (except) {
    return except.includes(model.modelName);
  } else {
    return false;
  }
}

function assertModelNames(arr = []) {
  for (let val of arr) {
    if (!mongoose.models[val]) {
      throw new Error(`Unknown model "${val}".`);
    }
  }
}

function getAllReferences(doc) {
  const targetName = doc.constructor.modelName;
  return Object.values(mongoose.models)
    .map((model) => {
      const paths = getModelReferences(model, targetName);
      return { model, paths };
    })
    .filter(({ paths }) => {
      return paths.length > 0;
    });
}

function getModelReferences(model, targetName) {
  const paths = [];
  model.schema.eachPath((schemaPath, schemaType) => {
    if (schemaType instanceof SchemaObjectId && schemaPath[0] !== '_') {
      const { ref, refPath } = schemaType.options;
      let refs;
      if (ref) {
        refs = [ref];
      } else if (refPath) {
        refs = model.schema.path(refPath).options.enum;
      } else {
        throw new Error(
          `Cannot derive refs for ${model.modelName}#${schemaPath}.`
        );
      }
      if (refs.includes(targetName)) {
        paths.push(schemaPath);
      }
    }
  });
  return paths;
}

// Delete

async function deleteReferences(doc, hooks) {
  for (let hook of hooks) {
    if (hook.ref) {
      await deleteForeignReferences(doc, hook);
    } else {
      await deleteLocalReferences(doc, hook);
    }
  }
}

async function deleteForeignReferences(doc, hook) {
  const { ref, path, paths, query } = hook;

  const { id } = doc;
  if (!id) {
    throw new Error(`Refusing to apply delete hook to document without id.`);
  }

  const Model = mongoose.models[ref];
  if (!Model) {
    throw new Error(`Unknown model: "${ref}".`);
  }

  if (path) {
    await runDeletes(Model, doc, {
      ...query,
      [path]: id,
    });
  } else if (paths) {
    await runDeletes(Model, doc, {
      $or: paths.map((refName) => {
        return {
          ...query,
          [refName]: id,
        };
      }),
    });
  }
}

async function deleteLocalReferences(doc, hook) {
  const paths = getHookPaths(hook);
  await doc.populate(paths);
  for (let path of paths) {
    const value = doc.get(path);

    if (!value) {
      continue;
    }

    const arr = Array.isArray(value) ? value : [value];
    for (let sub of arr) {
      await sub.delete();
    }
  }
}

async function runDeletes(Model, refDoc, query) {
  const docs = await Model.find(query);
  for (let doc of docs) {
    await doc.delete();
    refDoc.deletedRefs.push({
      _id: doc.id,
      ref: doc.constructor.modelName,
    });
  }
}

// Restore

async function restoreReferences(doc, hooks) {
  for (let hook of hooks) {
    if (hook.ref) {
      await restoreForeignReferences(doc);
    } else {
      await restoreLocalReferences(doc, hook);
    }
  }
}

async function restoreForeignReferences(refDoc) {
  const grouped = groupBy(refDoc.deletedRefs, 'ref');

  for (let [modelName, refs] of Object.entries(grouped)) {
    const ids = refs.map((ref) => {
      return ref._id;
    });
    const Model = mongoose.models[modelName];

    // @ts-ignore
    const docs = await Model.findDeleted({
      _id: { $in: ids },
    });

    for (let doc of docs) {
      await doc.restore();
    }
  }

  refDoc.deletedRefs = [];
}

async function restoreLocalReferences(refDoc, hook) {
  const paths = getHookPaths(hook);

  for (let path of paths) {
    const { ref } = getInnerField(refDoc.constructor.schema.obj, path);
    const value = refDoc.get(path);
    const ids = Array.isArray(value) ? value : [value];
    const Model = mongoose.models[ref];

    // @ts-ignore
    const docs = await Model.findDeleted({
      _id: { $in: ids },
    });

    for (let doc of docs) {
      await doc.restore();
    }
  }
}
