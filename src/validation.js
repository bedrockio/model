import mongoose from 'mongoose';
import yd from '@bedrockio/yada';

import { get, omit, lowerFirst } from 'lodash';

import { hasAccess } from './access';
import { searchValidation } from './search';
import { PermissionsError, ImplementationError } from './errors';
import { hasUniqueConstraints, assertUnique } from './soft-delete';
import { isMongooseSchema, isSchemaTypedef } from './utils';
import { INCLUDE_FIELD_SCHEMA } from './include';

const DATE_TAGS = {
  'x-schema': 'DateTime',
  'x-description':
    'A `string` in [ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html) format.',
};

export const OBJECT_ID_SCHEMA = yd
  .string()
  .mongo()
  .message('Must be an ObjectId.')
  .tag({
    'x-schema': 'ObjectId',
    'x-description':
      'A 24 character hexadecimal string representing a Mongo [ObjectId](https://bit.ly/3YPtGlU).',
  });

const REFERENCE_SCHEMA = yd
  .allow(
    OBJECT_ID_SCHEMA,
    yd
      .object({
        id: OBJECT_ID_SCHEMA.required(),
      })
      .options({
        stripUnknown: true,
      })
      .custom((obj) => {
        return obj.id;
      })
  )
  .message('Must be an ObjectId or object containing "id" field.')
  .tag({
    'x-schema': 'Reference',
    'x-description': `
A 24 character hexadecimal string representing a Mongo [ObjectId](https://bit.ly/3YPtGlU).
An object with an \`id\` field may also be passed, which will be converted into a string.
    `.trim(),
  });

const namedSchemas = {
  // Email is special as we are assuming that in
  // all cases lowercase should be allowed but coerced.
  email: yd.string().lowercase().email(),
  // Force "objectId" to have parity with refs.
  // "mongo" is notably excluded here for this reason.
  objectId: OBJECT_ID_SCHEMA,

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
    function getCreateValidation(options = {}) {
      const { allowInclude, ...appendSchema } = options;
      return getSchemaFromMongoose(schema, {
        model: this,
        appendSchema,
        allowInclude,
        stripDeleted: true,
        stripTimestamps: true,
        allowDefaultTags: true,
        allowExpandedRefs: true,
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
    function getUpdateValidation(options = {}) {
      const { allowInclude, ...appendSchema } = options;
      return getSchemaFromMongoose(schema, {
        model: this,
        appendSchema,
        allowInclude,
        skipRequired: true,
        stripUnknown: true,
        stripDeleted: true,
        stripTimestamps: true,
        allowExpandedRefs: true,
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
    function getSearchValidation(options = {}) {
      const { defaults, includeDeleted, ...appendSchema } = options;

      return getSchemaFromMongoose(schema, {
        model: this,
        allowSearch: true,
        skipRequired: true,
        allowInclude: true,
        expandDotSyntax: true,
        unwindArrayFields: true,
        requireReadAccess: true,
        stripDeleted: !includeDeleted,
        appendSchema: searchValidation({
          defaults,
          definition,
          appendSchema,
        }),
      });
    }
  );

  schema.static('getIncludeValidation', function getIncludeValidation() {
    return INCLUDE_FIELD_SCHEMA;
  });

  schema.static('getBaseSchema', function getBaseSchema() {
    return getSchemaFromMongoose(schema, {
      stripDeleted: true,
      requireReadAccess: true,
    });
  });
}

// Yada schemas

function getSchemaFromMongoose(schema, options = {}) {
  const fields = getMongooseFields(schema, options);
  return getValidationSchema(fields, options);
}

function getMongooseFields(schema, options) {
  const { stripTimestamps, stripDeleted } = options;
  let fields = schema.obj;
  if (stripTimestamps) {
    fields = omit(fields, ['createdAt', 'updatedAt']);
  }
  if (stripDeleted) {
    fields = omit(fields, ['deleted', 'deletedAt']);
  }
  return fields;
}

// Exported for testing
export function getValidationSchema(attributes, options = {}) {
  const { appendSchema, assertUniqueOptions, allowInclude } = options;
  let schema = getObjectSchema(attributes, options);
  if (assertUniqueOptions) {
    schema = schema.custom(async (obj, { root }) => {
      await assertUnique(root, {
        model: options.model,
        ...assertUniqueOptions,
      });
    });
  }
  if (appendSchema) {
    schema = schema.append(appendSchema);
  }
  if (allowInclude) {
    schema = schema.append(INCLUDE_FIELD_SCHEMA);
  }
  return schema;
}

function getObjectSchema(arg, options) {
  if (isSchemaTypedef(arg)) {
    return getSchemaForTypedef(arg, options);
  } else if (arg instanceof mongoose.Schema) {
    return getObjectSchema(arg.obj, options);
  } else if (Array.isArray(arg)) {
    return getArraySchema(arg, options);
  } else if (typeof arg === 'object') {
    const { stripUnknown, expandDotSyntax } = options;
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
    if (expandDotSyntax) {
      schema = schema.options({
        expandDotSyntax: true,
      });
    }

    return schema;
  } else {
    return getSchemaForType(arg, options);
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
    schema = getSchemaForType(type, options);
  }

  if (isRequired(typedef, options)) {
    schema = schema.required();
  }

  if (typedef.default && options.allowDefaultTags) {
    // Tag the default value to allow OpenAPI description
    // of the field but do not actually set the default as it will
    // be handled on the schema level. The tags are being appended
    // for the create validation only as a convenience to describe
    // the default value on creation in OpenApi.
    schema = schema.tag({
      default: typedef.default,
    });
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

function getSchemaForType(type, options) {
  switch (type) {
    case 'String':
      return yd.string();
    case 'Number':
      return yd.number();
    case 'Boolean':
      return yd.boolean();
    case 'Date':
      return yd.date().iso().tag(DATE_TAGS);
    case 'Object':
      return yd.object();
    case 'Array':
      return yd.array();
    case 'Mixed':
      return yd.any();
    case 'ObjectId':
      if (options.allowExpandedRefs) {
        return REFERENCE_SCHEMA;
      } else {
        return OBJECT_ID_SCHEMA;
      }
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
            lt: yd
              .date()
              .iso()
              .tag({
                ...DATE_TAGS,
                description: 'Select dates occurring before.',
              }),
            gt: yd
              .date()
              .iso()
              .tag({
                ...DATE_TAGS,
                description: 'Select dates occurring after.',
              }),
            lte: yd
              .date()
              .iso()
              .tag({
                ...DATE_TAGS,
                description: 'Select dates occurring on or before.',
              }),
            gte: yd
              .date()
              .iso()
              .tag({
                ...DATE_TAGS,
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
    if (options.requireWriteAccess) {
      return field.writeAccess === 'none';
    } else if (options.requireReadAccess) {
      return field.readAccess === 'none' || field.readAccess === 'self';
    }
  }
  return false;
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

    let isAllowed;
    try {
      isAllowed = hasAccess(type, allowed, {
        ...options,
        document,
      });
    } catch (error) {
      if (error instanceof ImplementationError) {
        if (type === 'read') {
          // Read access validation for search means that "self" access
          // cannot be fulfilled as there is no single document to test
          // against, so continue on to throw a normal permissions error
          // here instead of raising a problem with the implementation.
          isAllowed = false;
        } else if (type === 'write') {
          throw new Error(
            `Write access "${error.name}" requires passing { document, authUser } to the validator.`
          );
        }
      } else {
        throw error;
      }
    }

    if (!isAllowed) {
      const currentValue = get(document, options.path);
      if (val !== currentValue) {
        throw new PermissionsError(`requires ${type} permissions.`);
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
