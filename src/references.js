import mongoose from 'mongoose';

import { ReferenceError } from './errors';

const { ObjectId: SchemaObjectId } = mongoose.Schema.Types;

export function applyReferences(schema) {
  schema.method(
    'assertNoReferences',
    async function assertNoReferences(options = {}) {
      const { except = [] } = options;
      const { modelName } = this.constructor;

      assertExceptions(except);

      const references = getAllReferences(modelName);
      const results = [];

      for (let { model, paths } of references) {
        const isAllowed = except.some((e) => {
          return e === model || e === model.modelName;
        });
        if (isAllowed) {
          continue;
        }

        const query = {
          $or: paths.map((path) => {
            return { [path]: this.id };
          }),
        };

        const docs = await model.find(
          query,
          {
            _id: 1,
          },
          {
            lean: true,
          }
        );
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
  );
}

function assertExceptions(except) {
  for (let val of except) {
    if (typeof val === 'string' && !mongoose.models[val]) {
      throw new Error(`Unknown model "${val}".`);
    }
  }
}

function getAllReferences(targetName) {
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
