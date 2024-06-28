import { Model } from 'mongoose';

// Patching mongoose hydrate method to be less useless
// as it sets all input fields on the resulting document.
// Compare this to creating a new model which will only
// set the fields known to the schema. This results in:
//
// 1. Sending too much data down the wire
// 2. Potentially leaking sensitive data in aggregations.

export function applyHydrate(schema) {
  schema.static('hydrate', function hydrate(obj) {
    return Model.hydrate.call(this, obj, getProjection(schema));
  });
}

// Note that the mongoose docs imply that an array of
// strings will work for the projection, however this
// does not seem to work.
// https://mongoosejs.com/docs/7.x/docs/api/model.html
function getProjection(schema) {
  const keys = Object.keys(schema.paths);
  const result = {};
  for (let key of keys) {
    result[key] = true;
  }
  return result;
}
