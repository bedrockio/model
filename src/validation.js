import mongoose from 'mongoose';
import yd from '@bedrockio/yada';

import { omit, lowerFirst } from 'lodash';

import { hasWriteAccess } from './access';
import { searchValidation } from './search';
import { PermissionsError } from './errors';
import { isMongooseSchema, isSchemaTypedef } from './utils';
import { RESERVED_FIELDS } from './schema';

const namedSchemas = {
  // Email is special as we are assuming that in
  // all cases lowercase should be allowed but coerced.
  email: yd.string().lowercase().email(),
  // Force "ObjectId" to have parity with refs.
  // "mongo" is notably excluded here for this reason.
  ObjectId: yd.string().mongo(),

  ascii: yd.string().ascii(),
  base64: yd.string().base64(),
  btc: yd.string().btc(),
  country: yd.string().country(),
  creditCard: yd.string().creditCard(),
  domain: yd.string().domain(),
  eth: yd.string().eth(),
  hex: yd.string().hex(),
  ip: yd.string().ip(),
  jwt: yd.string().jwt(),
  latlng: yd.string().latlng(),
  locale: yd.string().locale(),
  md5: yd.string().md5(),
  phone: yd.string().phone(),
  postalCode: yd.string().postalCode(),
  sha1: yd.string().sha1(),
  slug: yd.string().slug(),
  swift: yd.string().swift(),
  url: yd.string().url(),
  uuid: yd.string().uuid(),
};

export function addValidators(schemas) {
  Object.assign(namedSchemas, schemas);
}

export function applyValidation(schema, definition) {
  schema.static(
    'getCreateValidation',
    function getCreateValidation(appendSchema) {
      return getSchemaFromMongoose(schema, {
        appendSchema,
        stripReserved: true,
        requireWriteAccess: true,
        modelName: this.modelName,
      });
    }
  );

  schema.static(
    'getUpdateValidation',
    function getUpdateValidation(appendSchema) {
      return getSchemaFromMongoose(schema, {
        appendSchema,
        skipRequired: true,
        stripReserved: true,
        stripUnknown: true,
        requireWriteAccess: true,
        modelName: this.modelName,
      });
    }
  );

  schema.static(
    'getSearchValidation',
    function getSearchValidation(searchOptions) {
      return getSchemaFromMongoose(schema, {
        allowRanges: true,
        skipRequired: true,
        allowMultiple: true,
        unwindArrayFields: true,
        appendSchema: searchValidation(definition, searchOptions),
        modelName: this.modelName,
      });
    }
  );
}

// Yada schemas

function getSchemaFromMongoose(schema, options) {
  let { obj } = schema;
  if (options.stripReserved) {
    obj = omit(obj, RESERVED_FIELDS);
  }
  return getValidationSchema(obj, options);
}

// Exported for testing
export function getValidationSchema(attributes, options = {}) {
  const { appendSchema } = options;
  let schema = getObjectSchema(attributes, options);
  if (appendSchema) {
    schema = schema.append(appendSchema);
  }
  return schema;
}

function getObjectSchema(arg, options) {
  const { stripUnknown } = options;
  if (isSchemaTypedef(arg)) {
    return getSchemaForTypedef(arg, options);
  } else if (arg instanceof mongoose.Schema) {
    return getObjectSchema(arg.obj, options);
  } else if (Array.isArray(arg)) {
    return getArraySchema(arg, options);
  } else if (typeof arg === 'object') {
    const map = {};
    for (let [key, field] of Object.entries(arg)) {
      map[key] = getObjectSchema(field, options);
    }

    let schema = yd.object(map);

    if (stripUnknown) {
      schema = schema.options({
        stripUnknown: true,
      });
    }

    return schema;
  } else {
    return getSchemaForType(arg);
  }
}

function getArraySchema(obj, options) {
  // Nested array fields may not skip required
  // validations as they are a new context.
  let schema = getObjectSchema(obj[0], {
    ...options,
    skipRequired: false,
  });
  if (!options.unwindArrayFields) {
    schema = yd.array(schema);
  }
  return schema;
}

function getSchemaForTypedef(typedef, options = {}) {
  let { type } = typedef;

  let schema;

  if (isMongooseSchema(type)) {
    schema = getSchemaFromMongoose(type, options);
  } else if (Array.isArray(type)) {
    schema = getArraySchema(type, options);
  } else if (typeof type === 'object') {
    schema = getObjectSchema(type, options);
  } else {
    schema = getSchemaForType(type);
  }

  if (isRequired(typedef, options)) {
    schema = schema.required();
  }
  if (typedef.validate?.schema) {
    schema = schema.append(typedef.validate.schema);
  }
  if (typedef.enum) {
    schema = schema.allow(...typedef.enum);
  }
  if (typedef.match) {
    schema = schema.match(RegExp(typedef.match));
  }
  if (typedef.min != null || typedef.minLength != null) {
    schema = schema.min(typedef.min ?? typedef.minLength);
  }
  if (typedef.max != null || typedef.maxLength != null) {
    schema = schema.max(typedef.max ?? typedef.maxLength);
  }
  if (options.allowRanges) {
    schema = getRangeSchema(schema, type);
  }
  if (options.allowMultiple) {
    schema = yd.allow(schema, yd.array(schema));
  }
  if (typedef.writeAccess && options.requireWriteAccess) {
    schema = validateWriteScopes(schema, typedef.writeAccess, options);
  }
  return schema;
}

function getSchemaForType(type) {
  switch (type) {
    case 'String':
      return yd.string();
    case 'Number':
      return yd.number();
    case 'Boolean':
      return yd.boolean();
    case 'Date':
      return yd.date().iso();
    case 'Mixed':
    case 'Object':
      return yd.object();
    case 'ObjectId':
      return yd.custom(async (val) => {
        const id = String(val.id || val);
        await namedSchemas['ObjectId'].validate(id);
        return id;
      });
    default:
      throw new TypeError(`Unknown schema type ${type}`);
  }
}

function getRangeSchema(schema, type) {
  if (type === 'Number') {
    schema = yd.allow(
      schema,
      yd.object({
        lt: yd.number(),
        gt: yd.number(),
        lte: yd.number(),
        gte: yd.number(),
      })
    );
  } else if (type === 'Date') {
    return yd.allow(
      schema,
      yd.object({
        lt: yd.date().iso(),
        gt: yd.date().iso(),
        lte: yd.date().iso(),
        gte: yd.date().iso(),
      })
    );
  }
  return schema;
}

function isRequired(typedef, options) {
  return typedef.required && !typedef.default && !options.skipRequired;
}

function validateWriteScopes(schema, allowedScopes, options) {
  const { stripUnknown, modelName } = options;
  if (stripUnknown) {
    return schema.strip((val, options) => {
      return !resolveAccess(allowedScopes, modelName, options);
    });
  } else {
    return schema.custom((val, options) => {
      if (!resolveAccess(allowedScopes, modelName, options)) {
        throw new PermissionsError('requires write permissions');
      }
    });
  }
}

function resolveAccess(allowedScopes, modelName, options) {
  const document = options[lowerFirst(modelName)] || options['document'];
  return hasWriteAccess(allowedScopes, {
    ...options,
    document,
  });
}

// Mongoose Validators

export function getNamedValidator(name) {
  return wrapMongooseValidator(getNamedSchema(name));
}

export function getTupleValidator(types) {
  types = types.map((type) => {
    return getSchemaForTypedef(type);
  });
  return wrapMongooseValidator(yd.array(types).length(types.length));
}

// Returns an async function that will error on failure.
//
// Note that mongoose validator functions will not be called
// if the field is optional and not set or unset with undefined.
// If the field is not optional the "required" field will also
// perform valdation so no additional checks are necessary.
//
// Also note that throwing an error inside a validator and passing
// the "message" field result in an identical error message. In this
// case we want the schema error messages to trickle down so using
// the first style here.
//
// https://mongoosejs.com/docs/api/schematype.html#schematype_SchemaType-validate
function wrapMongooseValidator(schema) {
  const validator = async (val) => {
    await schema.validate(val);
  };
  validator.schema = schema;
  return validator;
}

function getNamedSchema(name) {
  const schema = namedSchemas[name];
  if (!schema) {
    throw new Error(`Cannot find schema for "${name}".`);
  }
  return schema;
}
