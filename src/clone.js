// This module attempts to fix Mongoose $clone
// which has a number of issues including:
// - Keeps the same _id making it impossible to use
//   the clone separate to the original document.
// - Fails on circular references.
// - Clones other internals like __v.
// - Cannot deal with unique fields.
//
export function applyClone(schema) {
  schema.method('clone', async function clone() {
    return await cloneDocument(this);
  });
}

async function cloneDocument(doc) {
  const Model = doc.constructor;
  const clone = new Model();

  for (let [key, typedef] of Object.entries(Model.schema.obj)) {
    let value = doc.get(key);
    const { unique, softUnique } = typedef;
    if (value && (unique || softUnique)) {
      value = getUniqueValue(value);
    }

    clone.set(key, value);
  }

  await clone.save();

  return clone;
}

let counter = 1;

function getUniqueValue(value) {
  const type = typeof value;
  if (type === 'string') {
    return getUniqueString(value);
  } else if (type === 'number') {
    return value + getCounter();
  } else {
    throw new Error(`Unique behavior not defined for ${type}.`);
  }
}

function getUniqueString(str) {
  const split = str.split('@');
  split[0] += getCounter();
  return split.join('@');
}

function getCounter() {
  return counter++;
}
