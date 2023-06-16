import mongoose from 'mongoose';
import { pick, isPlainObject, capitalize, camelCase } from 'lodash';

import { isSchemaTypedef } from './utils';

import { serializeOptions } from './serialization';
import { applySlug } from './slug';
import { applySearch } from './search';
import { applyAssign } from './assign';
import { applyInclude } from './include';
import { applyReferences } from './references';
import { applySoftDelete } from './soft-delete';
import { applyDisallowed } from './disallowed';

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
 * @param {mongoose.SchemaOptions} options
 * @returns mongoose.Schema
 */
export function createSchema(definition, options = {}) {
  const schema = new mongoose.Schema(
    attributesToMongoose(
      normalizeAttributes({
        ...definition.attributes,

        // Although timestamps are being set below, we still need to add
        // them to the schema so that validation can be generated for them,
        // namely in getSearchValidation.
        createdAt: 'Date',
        updatedAt: 'Date',
        deletedAt: 'Date',
        deleted: { type: 'Boolean', default: false },
      })
    ),
    {
      timestamps: true,
      toJSON: serializeOptions,
      toObject: serializeOptions,
      ...options,
    }
  );

  applyValidation(schema, definition);
  applySearch(schema, definition);
  applySoftDelete(schema);
  applyReferences(schema);
  applyDisallowed(schema);
  applyInclude(schema);
  applyAssign(schema);
  applySlug(schema);

  return schema;
}

export function normalizeAttributes(arg, path = []) {
  if (arg instanceof mongoose.Schema) {
    return arg;
  } else if (typeof arg === 'function') {
    throw new Error('Native functions are not allowed as types.');
  } else if (typeof arg === 'string') {
    return normalizeSchemaTypedef({ type: arg }, path);
  } else if (Array.isArray(arg)) {
    const type = normalizeArrayAttributes(arg, path);
    return normalizeSchemaTypedef({ type }, path);
  } else if (typeof arg === 'object') {
    assertRefs(arg, path);

    if (isSchemaTypedef(arg)) {
      return normalizeSchemaTypedef(arg, path);
    }

    const attributes = {};
    for (let [key, val] of Object.entries(arg)) {
      attributes[key] = normalizeAttributes(val, [...path, key]);
    }
    return attributes;
  }
}

function normalizeSchemaTypedef(typedef, path) {
  const { type } = typedef;

  if (Array.isArray(type)) {
    typedef.type = normalizeArrayAttributes(type, path);
  } else if (typeof type === 'object') {
    typedef.type = normalizeAttributes(type, path);
  } else {
    assertSchemaType(type, path);
  }

  return typedef;
}

function normalizeArrayAttributes(arr, path) {
  return arr.map((el, i) => {
    return normalizeAttributes(el, [...path, i]);
  });
}

function attributesToMongoose(attributes) {
  if (typeof attributes === 'string') {
    return attributes;
  } else if (Array.isArray(attributes)) {
    return attributes.map(attributesToMongoose);
  }

  let definition = {};

  const isTypedef = isSchemaTypedef(attributes);

  for (let [key, val] of Object.entries(attributes)) {
    const type = typeof val;
    if (isTypedef) {
      if (key === 'type' && type !== 'function') {
        val = attributesToMongoose(val);
      } else if (key === 'match' && type === 'string') {
        // Convert match field to RegExp that cannot be expressed in JSON.
        val = parseRegExp(val);
      } else if (key === 'validate' && type === 'string') {
        // Allow custom mongoose validation function that derives from the schema.
        val = getNamedValidator(val);
      }
    } else if (isPlainObject(val)) {
      if (isScopeExtension(val)) {
        applyScopeExtension(val, definition);
        continue;
      } else {
        val = attributesToMongoose(val);
      }
    }
    definition[key] = val;
  }

  if (isTypedef) {
    applyExtensions(definition);
  }

  return definition;
}

function assertSchemaType(type, path) {
  if (type === 'Mixed') {
    throw new Error('Type "Mixed" is not allowed. Use "Object" instead.');
  }

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

function assertRefs(field, path) {
  const { type, ref, refPath } = field;
  const p = path.join('.');
  if (isObjectIdType(type) && !ref && !refPath) {
    throw new Error(`Ref must be passed for "${p}".`);
  } else if (ref && !isMongooseType(ref) && !isObjectIdType(type)) {
    throw new Error(`Ref field "${p}" must be type "ObjectId".`);
  }
}

function camelUpper(str) {
  return capitalize(camelCase(str));
}

function isObjectIdType(type) {
  return type === 'ObjectId' || type === mongoose.Schema.Types.ObjectId;
}

function isMongooseType(type) {
  return !!mongoose.Schema.Types[type];
}

function applyExtensions(typedef) {
  applySyntaxExtensions(typedef);
  applyUniqueExtension(typedef);
  applyTupleExtension(typedef);
}

function applySyntaxExtensions(typedef) {
  const { type, attributes } = typedef;
  if (isExtendedSyntax(typedef)) {
    typedef.type = new mongoose.Schema(attributes);
    if (type === 'Array') {
      typedef.type = [typedef.type];
    }
  }
  if (Array.isArray(typedef.type)) {
    applyArrayValidators(typedef);
    applyOptionHoisting(typedef);
  }
}

// Hoist read/write scopes from a nested element.
// See the readme for more.
function applyOptionHoisting(typedef) {
  Object.assign(typedef, pick(typedef.type[0], 'readAccess', 'writeAccess'));
}

function isExtendedSyntax(typedef) {
  const { type, attributes } = typedef;
  return attributes && (type === 'Object' || type === 'Array');
}

function isScopeExtension(obj) {
  return isSchemaTypedef(obj) && obj.type === 'Scope';
}

function applyScopeExtension(scope, definition) {
  const { type, attributes, ...options } = scope;
  for (let [key, val] of Object.entries(normalizeAttributes(attributes))) {
    definition[key] = {
      ...val,
      ...options,
    };
  }
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

function chain(fn1, fn2) {
  return (...args) => {
    fn1?.(...args);
    fn2?.(...args);
  };
}

const REG_MATCH = /^\/(.+)\/(\w+)$/;

function parseRegExp(str) {
  const match = str.match(REG_MATCH);
  if (!match) {
    throw new Error('Could not parse regex.');
  }
  const [, source, flags] = match;
  return RegExp(source, flags);
}
