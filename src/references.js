import mongoose from 'mongoose';
import { startCase } from 'lodash-es';

const { ObjectId: SchemaObjectId } = mongoose.Schema.Types;

export function applyReferences(schema) {
  schema.method('assertNoReferences', async function (options = {}) {
    const { except = [] } = options;
    const { modelName } = this.constructor;
    await Promise.all(
      getAllReferences(modelName).map(async ({ model, paths }) => {
        const hasException = except.some((e) => {
          return e === model || e === model.modelName;
        });
        if (hasException) {
          return;
        }
        const count = await model.countDocuments({
          $or: paths.map((path) => {
            return { [path]: this.id };
          }),
        });
        if (count > 0) {
          throw new Error(
            `Refusing to delete ${startCase(modelName).toLowerCase()} ${
              this.id
            } referenced by ${model.modelName}.`
          );
        }
      })
    );
  });
}

// Reference helpers derive ObjectId references between models.

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
