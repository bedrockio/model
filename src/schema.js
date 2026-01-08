import { camelCase, capitalize, isPlainObject, last, pick } from 'lodash';
import mongoose from 'mongoose';

import { applyAssign } from './assign';
import { addCacheFields, applyCache } from './cache';
import { applyClone } from './clone';
import { addDeletedFields, applyDeleteHooks } from './delete-hooks';
import { applyDisallowed } from './disallowed';
import { applyExport } from './export';
import { applyHydrate } from './hydrate';
import { applyInclude } from './include';
import { applyReload } from './reload';
import { applySearch } from './search';
import { serializeOptions } from './serialization';
import { applySlug } from './slug';
import { applySoftDelete } from './soft-delete';
import { applyUpsert } from './upsert';
import { isSchemaTypedef } from './utils';

import {
  applyValidation,
  getNamedValidator,
  getTupleValidator,
} from './validation';

/**
 * Creates a new Mongoose schema with Bedrock extensions
 * applied. For more about syntax and functionality see
 * [the documentation](https://github.com/bedrockio/model#schemas).
 * @param {object} definition
 * @param {mongoose.SchemaOptions} [options]
 * @returns {mongoose.Schema}
 */
export function createSchema(definition, options = {}) {
  addCacheFields(definition);
  addDeletedFields(definition);

  const attributes = normalizeAttributes({
    ...definition.attributes,

    // Although timestamps are being set below, we still need to add
    // them to the schema so that validation can be generated for them,
    // namely in getSearchValidation.
    createdAt: 'Date',
    updatedAt: 'Date',
    deletedAt: 'Date',
    deleted: {
      type: 'Boolean',
      default: false,
    },
  });

  applyExtensions(attributes);

  const schema = new mongoose.Schema(attributes, {
    timestamps: true,
    toJSON: serializeOptions,
    toObject: serializeOptions,
    ...options,
  });

  // Soft Delete needs to be applied
  // first for hooks to work correctly.
  applySoftDelete(schema);
  applyValidation(schema, definition);
  applyDeleteHooks(schema, definition);
  applySearch(schema, definition);
  applyCache(schema, definition);
  applyClone(schema);
  applyReload(schema);
  applyExport(schema);
  applyDisallowed(schema);
  applyInclude(schema);
  applyHydrate(schema);
  applyAssign(schema);
  applyUpsert(schema);
  applySlug(schema);

  return schema;
}

export function normalizeAttributes(arg, path = []) {
  if (arg instanceof mongoose.Schema) {
    return arg;
  } else if (typeof arg === 'function') {
    throw new Error('Native functions are not allowed as types.');
  } else if (isTypedefInput(arg)) {
    return normalizeTypedef(arg, path);
  } else if (typeof arg === 'object') {
    const attributes = {};
    for (let [key, val] of Object.entries(arg)) {
      if (key === '_id' && val === false) {
        // This is a special case in Mongoose that allows disabling
        // the _id field for array objects so perserve it here.
        attributes[key] = val;
      } else {
        attributes[key] = normalizeAttributes(val, [...path, key]);
      }
    }
    return attributes;
  }
}

function normalizeArrayAttributes(arr, path) {
  return arr.map((el, i) => {
    return normalizeAttributes(el, [...path, i]);
  });
}

function normalizeTypedef(arg, path) {
  const typedef = arg.type ? arg : { type: arg };

  if (Array.isArray(typedef.type)) {
    // Normalize all inner fields.
    typedef.type = normalizeArrayAttributes(typedef.type, path);
  } else if (typeof typedef.type === 'object') {
    // Normalize literal "type" field.
    typedef.type = normalizeAttributes(typedef.type, path);
  } else if (isExtendedSyntax(typedef)) {
    // Normalize extended syntax: type "Object" or "Array".
    typedef.attributes = normalizeAttributes(typedef.attributes, path);
  }

  if (typedef.type === 'String') {
    // Auto-apply trim to string fields.
    typedef.trim ??= true;

    if (typeof typedef.match === 'string') {
      // Convert string RegExp so that
      // it can be expressed in JSON.
      typedef.match = parseRegExp(typedef.match);
    }
  }

  assertSchemaType(typedef, path);
  assertObjectRefs(typedef, path);

  return typedef;
}

function isTypedefInput(arg) {
  if (typeof arg === 'string') {
    // "Number" as shorthand for a typedef.
    return true;
  } else if (Array.isArray(arg)) {
    // Array signals an array field with inner schema.
    return true;
  } else if (hasLiteralTypeField(arg)) {
    // An object with a literal "type" field.
    return false;
  }
  return isSchemaTypedef(arg);
}

// Detects input like:
// {
//   "type": "String",
//   "name": "String",
// }
// Which is not intended to be a typedef.
function hasLiteralTypeField(arg) {
  const { type, ...rest } = arg || {};

  if (!isMongooseType(type)) {
    return false;
  }

  return Object.values(rest).some((key) => {
    return isMongooseType(key);
  });
}

function assertSchemaType(typedef, path) {
  const { type } = typedef;
  if (typeof type === 'string') {
    if (!isMongooseType(type)) {
      const p = path.join('.');
      const upper = camelUpper(type);
      if (isMongooseType(upper)) {
        throw new Error(`Type "${type}" in "${p}" should be "${upper}".`);
      } else if (type !== 'Scope') {
        throw new Error(`Invalid type "${type}" for "${p}".`);
      }
    }
  }
}

function assertObjectRefs(typedef, path) {
  const { type, ref } = typedef;
  const p = path.join('.');

  if (requiresRef(typedef, path)) {
    throw new Error(`Ref must be passed for "${p}".`);
    // TODO: what is the middle part doing here??
  } else if (ref && !isMongooseType(ref) && !isObjectIdType(type)) {
    throw new Error(`Ref field "${p}" must be type "ObjectId".`);
  }
}

function requiresRef(typedef, path) {
  const { type, ref, refPath } = typedef;

  // Allow "_id" to not have a ref for the
  // delete hooks module to function.
  if (last(path) === '_id') {
    return false;
  }

  return isObjectIdType(type) && !ref && !refPath;
}

// Extensions

function applyExtensions(arg) {
  if (isSchemaTypedef(arg)) {
    applySyntaxExtensions(arg);
    applyValidateExtension(arg);
    applyUniqueExtension(arg);
    applyTupleExtension(arg);
    applyDateExtension(arg);

    if (Array.isArray(arg.type)) {
      for (let field of arg.type) {
        applyExtensions(field);
      }
      applyArrayValidators(arg);
      applyOptionHoisting(arg);
    }
  } else if (isPlainObject(arg)) {
    for (let [key, value] of Object.entries(arg)) {
      if (isScopeExtension(value)) {
        applyScopeExtension(value, arg, key);
      } else {
        applyExtensions(value);
      }
    }
  }
}

function applySyntaxExtensions(typedef) {
  const { type, attributes } = typedef;
  if (isExtendedSyntax(typedef)) {
    applyExtensions(attributes);
    if (type === 'Array') {
      typedef.type = [attributes];
    } else if (type === 'Object') {
      typedef.type = new mongoose.Schema(attributes);
    }
    delete typedef['attributes'];
  }
}

// Hoist read/write scopes from a nested element.
// See the readme for more.
function applyOptionHoisting(typedef) {
  Object.assign(typedef, pick(typedef.type[0], 'readAccess', 'writeAccess'));
}

function isExtendedSyntax(typedef) {
  const { type, attributes } = typedef;
  if (!attributes) {
    return false;
  }
  return type === 'Object' || type === 'Array' || type === 'Scope';
}

function isScopeExtension(arg) {
  return isSchemaTypedef(arg) && arg.type === 'Scope';
}

function applyScopeExtension(typedef, parent, name) {
  const { type, attributes, ...rest } = typedef;

  for (let [key, value] of Object.entries(attributes)) {
    if (isSchemaTypedef(value)) {
      // If the child is a typedef then apply
      // options directly to the field.
      applyExtensions(value);
      parent[key] = {
        ...value,
        ...rest,
      };
    } else {
      // If the child is a nested object then
      // need to use extended object syntax.
      const typedef = {
        type: 'Object',
        attributes: value,
        ...rest,
      };
      applyExtensions(typedef);
      parent[key] = typedef;
    }
  }

  delete parent[name];
}

// Extended tuple syntax. Return mixed type and set validator.
function applyTupleExtension(typedef) {
  const { type } = typedef;
  if (Array.isArray(type) && type.length > 1) {
    // Note that mongoose appears to have a bug where passing
    // "Array" as a string will become a double nested array.
    // Compare to Array (native function) which will not result
    // in this nesting. Using an empty array instead to signal
    // mixed types. https://mongoosejs.com/docs/schematypes.html#arrays
    typedef.type = [];
    typedef.validate = getTupleValidator(type);
  }
}

function applyDateExtension(typedef) {
  const { type, default: defaultValue } = typedef;
  if (type === 'Date' && defaultValue === 'now') {
    // Allow mocking which would modify the global
    // Date after the schema has been set up.
    typedef.default = () => {
      return Date.now();
    };
  }
}

// Apply custom mongoose validation by name.
function applyValidateExtension(typedef) {
  const { validate } = typedef;

  if (typeof validate === 'string') {
    typedef.validate = getNamedValidator(typedef.validate);
  }
}

// Intercepts "unique" options and changes to "softUnique".
function applyUniqueExtension(typedef) {
  if (typedef.unique === true) {
    typedef.softUnique = true;
    delete typedef.unique;
  }
}

function applyArrayValidators(typedef) {
  let { minLength, maxLength, validate } = typedef;
  if (minLength) {
    validate = chain(validate, validateMinLength(minLength));
  }
  if (maxLength) {
    validate = chain(validate, validateMaxLength(maxLength));
  }
  if (validate) {
    typedef.validate = validate;
  }
}

function validateMinLength(min) {
  const s = min === 1 ? '' : 's';
  return (arr) => {
    if (arr.length < min) {
      throw new Error(`Must have at least ${min} element${s}.`);
    }
  };
}

function validateMaxLength(max) {
  const s = max === 1 ? '' : 's';
  return (arr) => {
    if (arr.length > max) {
      throw new Error(`Cannot have more than ${max} element${s}.`);
    }
  };
}

// Regex Parsing

const REG_MATCH = /^\/(.+)\/(\w+)$/;

function parseRegExp(str) {
  const match = str.match(REG_MATCH);
  if (!match) {
    throw new Error('Could not parse regex.');
  }
  const [, source, flags] = match;
  return RegExp(source, flags);
}

// Utils

function camelUpper(str) {
  return capitalize(camelCase(str));
}

function isObjectIdType(type) {
  return type === 'ObjectId' || type === mongoose.Schema.Types.ObjectId;
}

function isMongooseType(type) {
  return !!mongoose.Schema.Types[type];
}

function chain(fn1, fn2) {
  return (...args) => {
    fn1?.(...args);
    fn2?.(...args);
  };
}
