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

  const cleanLocal = validateCleanLocal(deleteHooks, schema);
  const cleanForeign = validateCleanForeign(deleteHooks);
  const errorHook = validateError(deleteHooks);

  let references;

  const deleteFn = schema.methods.delete;
  const restoreFn = schema.methods.restore;

  schema.method('delete', async function () {
    if (errorHook) {
      references ||= getAllReferences(this);
      await errorOnForeignReferences(this, {
        errorHook,
        cleanForeign,
        references,
      });
    }
    try {
      await deleteLocalReferences(this, cleanLocal);
      await deleteForeignReferences(this, cleanForeign);
    } catch (error) {
      await restoreLocalReferences(this, cleanLocal);
      await restoreForeignReferences(this);
      throw error;
    }
    await deleteFn.apply(this, arguments);
  });

  schema.method('restore', async function () {
    await restoreLocalReferences(this, cleanLocal);
    await restoreForeignReferences(this);
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

function validateCleanLocal(deleteHooks, schema) {
  let { local } = deleteHooks.clean || {};
  if (!local) {
    return;
  }
  if (typeof local !== 'string' && !Array.isArray(local)) {
    throw new Error('Local delete hook must be an array.');
  }
  if (typeof local === 'string') {
    local = [local];
  }
  for (let name of local) {
    const pathType = schema.pathType(name);
    if (pathType !== 'real') {
      throw new Error(`Delete hook has invalid local reference "${name}".`);
    }
  }
  return local;
}

function validateCleanForeign(deleteHooks) {
  const { foreign } = deleteHooks.clean || {};
  if (!foreign) {
    return;
  }
  if (typeof foreign !== 'object') {
    throw new Error('Foreign delete hook must be an object.');
  }
  for (let [modelName, arg] of Object.entries(foreign)) {
    if (typeof arg === 'object') {
      const { $and, $or } = arg;
      if ($and && $or) {
        throw new Error(
          `Cannot define both $or and $and in a delete hook for model ${modelName}.`
        );
      }
    }
  }
  return foreign;
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
  const { cleanForeign = {} } = options;
  const { only, except } = options?.errorHook || {};
  if (model.modelName in cleanForeign) {
    return true;
  }
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

// Deletion

async function deleteLocalReferences(doc, arr) {
  if (!arr) {
    return;
  }
  for (let name of arr) {
    await doc.populate(name);
    const value = doc.get(name);
    const arr = Array.isArray(value) ? value : [value];

    for (let sub of arr) {
      await sub.delete();
    }
  }
}

async function deleteForeignReferences(doc, refs) {
  if (!refs) {
    return;
  }
  const { id } = doc;
  if (!id) {
    throw new Error(`Refusing to apply delete hook to document without id.`);
  }
  for (let [modelName, arg] of Object.entries(refs)) {
    const Model = mongoose.models[modelName];
    if (typeof arg === 'string') {
      await runDeletes(Model, doc, {
        [arg]: id,
      });
    } else if (Array.isArray(arg)) {
      await runDeletes(Model, doc, {
        $or: mapArrayQuery(arg, id),
      });
    } else {
      const { $and, $or } = arg;
      if ($and) {
        await runDeletes(Model, doc, {
          $and: mapArrayQuery($and, id),
        });
      } else if ($or) {
        await runDeletes(Model, doc, {
          $or: mapArrayQuery($or, id),
        });
      }
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

function mapArrayQuery(arr, id) {
  return arr.map((refName) => {
    return {
      [refName]: id,
    };
  });
}

// Restore

async function restoreLocalReferences(refDoc, arr) {
  if (!arr) {
    return;
  }
  for (let name of arr) {
    const { ref } = getInnerField(refDoc.constructor.schema.obj, name);
    const value = refDoc.get(name);
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
