import mongoose from 'mongoose';

import { getSchemaPaths } from './utils';
import { isReferenceField } from './utils';

export function applyReload(schema) {
  schema.method('reload', async function reload() {
    const paths = getPopulatedPaths(this);
    const doc = await this.constructor.findById(this.id).include(paths);

    if (!doc) {
      throw new Error('Document deleted');
    }

    this.overwrite(doc);
  });
}

function getPopulatedPaths(doc) {
  return getReferencePaths(doc.constructor.schema).filter((path) => {
    const value = doc.get(path);
    return value && !mongoose.isObjectIdOrHexString(value);
  });
}

function getReferencePaths(schema) {
  return getSchemaPaths(schema).filter((path) => {
    return isReferenceField(schema, path);
  });
}
