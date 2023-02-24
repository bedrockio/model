import mongoose from 'mongoose';
import yd from '@bedrockio/yada';

import { get, omit, lowerFirst } from 'lodash';

import { hasAccess } from './access';
import { searchValidation } from './search';
import { PermissionsError } from './errors';
import { hasUniqueConstraints, assertUnique } from './soft-delete';
import { isMongooseSchema, isSchemaTypedef } from './utils';
import { RESERVED_FIELDS } from './schema';

const DATE_SCHEMA = yd.date().iso().tag({
  'x-schema': 'DateTime',
  'x-description':
    'A `string` in [ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html) format.',
});

const OBJECT_ID_DESCRIPTION = `
A 24 character hexadecimal string representing a Mongo [ObjectId](https://bit.ly/3YPtGlU).
An object with an \`id\` field may also be passed, which will be converted into a string.
`;

export const OBJECT_ID_SCHEMA = yd
  .custom(async (val) => {
    const id = String(val.id || val);
    await namedSchemas.objectId.validate(id);
    return id;
  })
  .tag({
    type: 'ObjectId',
    'x-schema': 'ObjectId',
    'x-description': OBJECT_ID_DESCRIPTION.trim(),
  });

const namedSchemas = {
  // Email is special as we are assuming that in
  // all cases lowercase should be allowed but coerced.
  email: yd.string().lowercase().email(),
  // Force "objectId" to have parity with refs.
  // "mongo" is notably excluded here for this reason.
  objectId: yd.string().mongo(),

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
  const hasUnique = hasUniqueConstraints(schema);

  schema.static(
    'getCreateValidation',
    function getCreateValidation(appendSchema) {
      return getSchemaFromMongoose(schema, {
        model: this,
        appendSchema,
        stripReserved: true,
        requireWriteAccess: true,
        ...(hasUnique && {
          assertUniqueOptions: {
            schema,
            operation: 'create',
          },
        }),
      });
    }
  );

  schema.static(
    'getUpdateValidation',
    function getUpdateValidation(appendSchema) {
      return getSchemaFromMongoose(schema, {
        model: this,
        appendSchema,
        skipRequired: true,
        stripReserved: true,
        stripUnknown: true,
        requireWriteAccess: true,
        ...(hasUnique && {
          assertUniqueOptions: {
            schema,
            operation: 'update',
          },
        }),
      });
    }
  );

  schema.static(
    'getSearchValidation',
    function getSearchValidation(searchOptions) {
      return getSchemaFromMongoose(schema, {
        allowSearch: true,
        skipRequired: true,
        unwindArrayFields: true,
        requireReadAccess: true,
        appendSchema: searchValidation(definition, searchOptions),
        model: this,
      });
    }
  );

  schema.static('getBaseSchema', function getBaseSchema() {
    return getSchemaFromMongoose(schema);
  });
}

// Yada schemas

function getSchemaFromMongoose(schema, options = {}) {
  let { obj } = schema;
  if (options.stripReserved) {
    obj = omit(obj, RESERVED_FIELDS);
  }
  return getValidationSchema(obj, options);
}

// Exported for testing
export function getValidationSchema(attributes, options = {}) {
  const { appendSchema, assertUniqueOptions } = options;
  let schema = getObjectSchema(attributes, options);
  if (assertUniqueOptions) {
    schema = yd.custom(async (obj) => {
      await assertUnique(obj, {
        model: options.model,
        ...assertUniqueOptions,
      });
    });
  }
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
      if (!isExcludedField(field, options)) {
        map[key] = getObjectSchema(field, options);
      }
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

function getArraySchema(arr, options) {
  let schema;
  if (arr.length === 0) {
    schema = yd.array();
  } else if (arr.length === 1) {
    // Nested array fields may not skip required
    // validations as they are a new context.
    schema = getObjectSchema(arr[0], {
      ...options,
      skipRequired: false,
    });
    if (!options.unwindArrayFields) {
      schema = yd.array(schema);
    }
  } else {
    throw new Error('Array schema may not have more than 1 element.');
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
  } else if (typeof typedef.validate === 'function') {
    schema = schema.custom(wrapMongooseValidator(typedef.validate));
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
  if (options.allowSearch) {
    schema = getSearchSchema(schema, type);
  }
  if (typedef.readAccess && options.requireReadAccess) {
    schema = validateReadAccess(schema, typedef.readAccess, options);
  }
  if (typedef.writeAccess && options.requireWriteAccess) {
    schema = validateWriteAccess(schema, typedef.writeAccess, options);
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
      return DATE_SCHEMA;
    case 'Mixed':
    case 'Object':
      return yd.object();
    case 'Array':
      return yd.array();
    case 'ObjectId':
      return OBJECT_ID_SCHEMA;
    default:
      throw new TypeError(`Unknown schema type ${type}`);
  }
}

function getSearchSchema(schema, type) {
  if (type === 'Number') {
    return yd
      .allow(
        schema,
        yd.array(schema),
        yd
          .object({
            lt: yd.number().description('Select values less than.'),
            gt: yd.number().description('Select values greater than.'),
            lte: yd.number().description('Select values less than or equal.'),
            gte: yd
              .number()
              .description('Select values greater than or equal.'),
          })
          .tag({
            'x-schema': 'NumberRange',
            'x-description':
              'An object representing numbers falling within a range.',
          })
      )
      .description(
        'Allows searching by a value, array of values, or a numeric range.'
      );
  } else if (type === 'Date') {
    return yd
      .allow(
        schema,
        yd.array(schema),
        yd
          .object({
            lt: yd.date().iso().tag({
              'x-ref': 'DateTime',
              description: 'Select dates occurring before.',
            }),
            gt: yd.date().iso().tag({
              'x-ref': 'DateTime',
              description: 'Select dates occurring after.',
            }),
            lte: yd.date().iso().tag({
              'x-ref': 'DateTime',
              description: 'Select dates occurring on or before.',
            }),
            gte: yd.date().iso().tag({
              'x-ref': 'DateTime',
              description: 'Select dates occurring on or after.',
            }),
          })
          .tag({
            'x-schema': 'DateRange',
            'x-description':
              'An object representing dates falling within a range.',
          })
      )
      .description('Allows searching by a date, array of dates, or a range.');
  } else if (type === 'String' || type === 'ObjectId') {
    return yd.allow(schema, yd.array(schema));
  } else {
    return schema;
  }
}

function isRequired(typedef, options) {
  return typedef.required && !typedef.default && !options.skipRequired;
}

function isExcludedField(field, options) {
  if (isSchemaTypedef(field)) {
    const { requireWriteAccess } = options;
    return requireWriteAccess && field.writeAccess === 'none';
  } else {
    return false;
  }
}

function validateReadAccess(schema, allowed, options) {
  return validateAccess('read', schema, allowed, options);
}

function validateWriteAccess(schema, allowed, options) {
  return validateAccess('write', schema, allowed, options);
}

function validateAccess(type, schema, allowed, options) {
  const { modelName } = options.model;
  return schema.custom((val, options) => {
    const document = options[lowerFirst(modelName)] || options['document'];
    const isAllowed = hasAccess(type, allowed, {
      ...options,
      document,
    });
    if (!isAllowed) {
      const currentValue = get(document, options.path);
      if (val !== currentValue) {
        throw new PermissionsError('requires write permissions.');
      }
    }
  });
}

// Mongoose Validators

export function getNamedValidator(name) {
  return wrapSchemaAsValidator(getNamedSchema(name));
}

export function getTupleValidator(types) {
  types = types.map((type) => {
    return getSchemaForTypedef(type);
  });
  // Using "loose" here to allow empty arrays through,
  // which mongoose defaults to for array fields.
  return wrapSchemaAsValidator(yd.tuple(types).loose());
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
function wrapSchemaAsValidator(schema) {
  const validator = async (val) => {
    await schema.validate(val);
  };
  validator.schema = schema;
  return validator;
}

function wrapMongooseValidator(validator) {
  return async (val) => {
    const result = await validator(val);
    if (!result && result !== undefined) {
      throw new Error('Validation failed.');
    }
  };
}

function getNamedSchema(name) {
  const schema = namedSchemas[name];
  if (!schema) {
    throw new Error(`Cannot find schema for "${name}".`);
  }
  return schema;
}
