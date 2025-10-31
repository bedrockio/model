import mongoose from 'mongoose';

import { getSchemaPaths } from './utils';
import { isReferenceField } from './utils';

export function applyReload(schema) {
  schema.method('reload', async function reload() {
    const paths = getPopulatedPaths(this);

    const doc = await this.constructor.findById(this.id).include(paths);

    if (!doc) {
      throw new Error('Document does not exist');
    }

    this.overwrite(doc.export());

    // Include on the query above will not work
    // for virtuals so handle separately here.
    for (const path of getVirtualReferencePaths(doc)) {
      await doc.include(path);
      this.set(path, doc[path]);
    }

    // All data reloaded so mark as unmodified.
    for (const path of this.modifiedPaths()) {
      this.unmarkModified(path);
    }
  });
}

function getPopulatedPaths(doc, base = []) {
  const schema = doc.constructor.schema;
  return getReferencePaths(schema)
    .filter((name) => {
      return doc.populated(name);
    })
    .flatMap((name) => {
      const path = [...base, name];

      const value = doc.get(name);
      const inner = Array.isArray(value) ? value[0] : value;

      return [path.join('.'), ...getPopulatedPaths(inner, path)];
    });
}

function getReferencePaths(schema) {
  return [
    ...getRealReferencePaths(schema),
    ...getVirtualReferencePaths(schema),
  ];
}

function getRealReferencePaths(schema) {
  return getSchemaPaths(schema).filter((path) => {
    return isReferenceField(schema, path);
  });
}

function getVirtualReferencePaths(arg) {
  const schema = resolveSchema(arg);
  return Object.keys(schema.virtuals).filter((key) => {
    return schema.virtuals[key].options?.ref;
  });
}

function resolveSchema(arg) {
  if (arg instanceof mongoose.Document) {
    // @ts-ignore
    return arg.constructor.schema;
  } else if (arg instanceof mongoose.Schema) {
    return arg;
  }
}
