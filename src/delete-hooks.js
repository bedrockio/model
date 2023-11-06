import mongoose from 'mongoose';

export function applyDeleteHooks(schema, definition) {
  const { delete: deleteHooks } = definition.hooks || {};

  if (!deleteHooks) {
    return;
  }

  for (let [modelName, arg] of Object.entries(deleteHooks)) {
    if (typeof arg === 'object') {
      const { $and, $or } = arg;
      if ($and && $or) {
        throw new Error(
          `Cannot define both $or and $and in a delete hook for model ${modelName}.`
        );
      }
    }
  }

  schema.pre('save', async function () {
    const modified = this.modifiedPaths().includes('deleted');
    if (this.deleted && modified) {
      const { id } = this;
      if (!id) {
        throw new Error(
          `Refusing to apply delete hook to document without id.`
        );
      }
      for (let [modelName, arg] of Object.entries(deleteHooks)) {
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
  });
}

function mapArrayQuery(arr, id) {
  return arr.map((refName) => {
    return {
      [refName]: id,
    };
  });
}
