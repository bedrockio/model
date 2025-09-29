import { isPlainObject } from 'lodash';

export function applyAssign(schema) {
  schema.method('assign', function assign(fields) {
    fields = unsetFalsyValues(fields);
    this.set(fields);
  });
}

// Force falsy fields to undefined to unset then instead of
// saving to the db (null, empty string, etc).
// Note that as of version 8.18.2 Mongoose will still happily
// set `null` or empty string directly in the db. However note
// that in mongodb querying on `null` will match both `null` and
// unset fields.
function unsetFalsyValues(arg) {
  if (isPlainObject(arg)) {
    const result = {};
    for (let [key, value] of Object.entries(arg)) {
      result[key] = unsetFalsyValues(value);
    }
    return result;
  } else if (Array.isArray(arg)) {
    return arg.map(unsetFalsyValues);
  } else if (arg === '' || arg === null) {
    return undefined;
  } else {
    return arg;
  }
}
