import mongoose from 'mongoose';

import { isReferenceField, getInnerField } from './utils';
import { ReferenceError } from './errors';

const { ObjectId: SchemaObjectId } = mongoose.Schema.Types;

export function applyDeleteHooks(schema, definition) {
  const { delete: deleteHooks = {} } = definition;

  const localHook = validateLocal(deleteHooks, schema);
  const foreignHook = validateForeign(deleteHooks);
  const errorHook = validateError(deleteHooks);

  let references;

  schema.pre('save', async function () {
    const modified = this.modifiedPaths().includes('deleted');
    if (this.deleted && modified) {
      if (errorHook) {
        references ||= getAllReferences(this);
        await errorOnForeignReferences(this, {
          errorHook,
          foreignHook,
          references,
        });
      }
      await deleteLocalReferences(this, localHook);
      await deleteForeignReferences(this, foreignHook);
    }
  });
}

// Validation

function validateLocal(deleteHooks, schema) {
  const { local } = deleteHooks;
  if (!local) {
    return;
  }
  if (!Array.isArray(local)) {
    throw new Error('Local delete hook must be an array.');
  }
  for (let name of local) {
    const pathType = schema.pathType(name);
    if (pathType !== 'real') {
      throw new Error(`Delete hook has invalid local reference "${name}".`);
    }
  }
  return local;
}

function validateForeign(deleteHooks) {
  const { foreign } = deleteHooks;
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
  const { errorHook, foreignHook, references } = options;
  if (!errorHook) {
    return;
  }
  const { except = [] } = errorHook;

  assertExceptions(except);

  const results = [];

  for (let { model, paths } of references) {
    const isAllowed = except.some((modelName) => {
      return modelName === model.modelName;
    });

    if (isAllowed) {
      continue;
    }

    const $or = paths
      .filter((path) => {
        if (foreignHook) {
          return foreignHook[model.modelName] !== path;
        }
        return true;
      })
      .map((path) => {
        return {
          [path]: doc.id,
        };
      });

    if (!$or.length) {
      continue;
    }

    const docs = await model.find({ $or }, { _id: 1 }).lean();

    if (docs.length > 0) {
      const ids = docs.map((doc) => {
        return String(doc._id);
      });
      results.push({
        ids,
        model,
        count: ids.length,
      });
    }
  }

  if (results.length) {
    throw new ReferenceError('Refusing to delete.', results);
  }
}

function assertExceptions(except) {
  for (let val of except) {
    if (typeof val === 'string' && !mongoose.models[val]) {
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
    const value = doc.get(name);
    const arr = Array.isArray(value) ? value : [value];

    const ids = arr.map((el) => {
      const id = el._id || el;
      if (!mongoose.isObjectIdOrHexString(id)) {
        throw new Error(`Invalid id of "${el}" for "${name}".`);
      }
      return id;
    });

    const Model = getModelForDocumentReference(doc, name);

    if (!Model) {
      throw new Error(`Model could not be derived for ${name}.`);
    }
    await Model.deleteMany({
      _id: {
        $in: ids,
      },
    });
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
      await Model.deleteMany({
        [arg]: id,
      });
    } else {
      const { $and, $or } = arg;
      if ($and) {
        await Model.deleteMany({
          $and: mapArrayQuery($and, id),
        });
      } else if ($or) {
        await Model.deleteMany({
          $or: mapArrayQuery($or, id),
        });
      }
    }
  }
}

function mapArrayQuery(arr, id) {
  return arr.map((refName) => {
    return {
      [refName]: id,
    };
  });
}

function getModelForDocumentReference(doc, name) {
  const { schema } = doc.constructor;
  if (!isReferenceField(schema.obj, name)) {
    return;
  }
  const { ref } = getInnerField(schema.obj, name);
  return mongoose.models[ref];
}
