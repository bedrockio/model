import mongoose from 'mongoose';
import yd from '@bedrockio/yada';

import { get, omit, lowerFirst } from 'lodash';

import { hasAccess } from './access';
import { searchValidation, exportValidation } from './search';
import { assertUnique } from './soft-delete';
import { PermissionsError, ImplementationError } from './errors';
import { isMongooseSchema, isSchemaTypedef } from './utils';
import { INCLUDE_FIELD_SCHEMA } from './include';
import {
  DATE_SCHEMA,
  REFERENCE_SCHEMA,
  OBJECT_ID_SCHEMA,
  NUMBER_RANGE_SCHEMA,
  STRING_RANGE_SCHEMA,
  DATE_RANGE_SCHEMA,
} from './validation-schemas';

const NAMED_SCHEMAS = {
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
  'phone:US': yd.string().phone('US'),
  'phone:NANP': yd.string().phone('NANP'),
  postalCode: yd.string().postalCode(),
  zipcode: yd.string().zipcode(),
  sha1: yd.string().sha1(),
  slug: yd.string().slug(),
  swift: yd.string().swift(),
  url: yd.string().url(),
  uuid: yd.string().uuid(),
};

export function addValidators(schemas) {
  Object.assign(NAMED_SCHEMAS, schemas);
}

export function applyValidation(schema, definition) {
  schema.static('getCreateValidation', function getCreateValidation(options) {
    return getSchemaFromMongoose(schema, {
      model: this,
      stripEmpty: true,
      stripDeleted: true,
      allowInclude: false,
      stripTimestamps: true,
      allowDefaultTags: true,
      allowExpandedRefs: true,
      requireWriteAccess: true,
      ...options,
    });
  });

  schema.static('getUpdateValidation', function getUpdateValidation(options) {
    return getSchemaFromMongoose(schema, {
      model: this,
      allowNull: true,
      skipRequired: true,
      stripUnknown: true,
      stripDeleted: true,
      allowInclude: false,
      stripTimestamps: true,
      allowExpandedRefs: true,
      requireWriteAccess: true,
      updateAccess: definition.access?.update,
      ...options,
    });
  });

  schema.static(
    'getSearchValidation',
    function getSearchValidation(options = {}) {
      const { allowExport, defaults, formats, ...rest } = options;

      let validation = getSchemaFromMongoose(schema, {
        model: this,
        allowNull: true,
        stripEmpty: true,
        allowSearch: true,
        skipRequired: true,
        allowInclude: true,
        stripDeleted: true,
        expandDotSyntax: true,
        unwindArrayFields: true,
        requireReadAccess: true,
        ...rest,
      });

      validation = validation.append(
        searchValidation({
          defaults,
          definition,
        }),
      );

      if (allowExport) {
        validation = validation.append(
          exportValidation({
            formats,
            defaults,
          }),
        );
      }

      return validation;
    },
  );

  schema.static('getDeleteValidation', function getDeleteValidation() {
    const allowed = definition.access?.delete || 'all';
    return validateAccess('delete', yd, allowed, {
      model: this,
      message: 'You do not have permissions to delete this document.',
    });
  });

  schema.static('getIncludeValidation', function getIncludeValidation() {
    return INCLUDE_FIELD_SCHEMA;
  });

  schema.static('getBaseSchema', function getBaseSchema() {
    return getSchemaFromMongoose(schema, {
      model: this,
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
  const { allowInclude, updateAccess } = options;

  let schema = getObjectSchema(attributes, options);

  if (allowInclude) {
    schema = schema.append(INCLUDE_FIELD_SCHEMA);
  }

  if (updateAccess) {
    return validateAccess('update', schema, updateAccess, {
      ...options,
      message: 'You do not have permissions to update this document.',
    });
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
    const { stripUnknown, stripEmpty, expandDotSyntax } = options;
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

    if (stripEmpty) {
      schema = schema.options({
        stripEmpty: true,
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

    // Null may be allowed to unset non-required fields
    // in an update operation or to search for non-existent
    // fields in a search operation.
    if (allowNull(typedef, options)) {
      schema = schema.nullable();
    }

    // Empty strings are allowed to unset non-required fields
    // in an update operation. Technically this should be null,
    // however empty strings are allowed here as well as they
    // generally play nicer with front-end components. For
    // ObjectId fields the empty string must be appended here.
    if (disallowEmpty(typedef, options)) {
      schema = schema.options({
        allowEmpty: false,
      });
    } else if (appendEmpty(typedef, options)) {
      schema = yd.allow(schema, '');
    }
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
    schema = validateAccess('read', schema, typedef.readAccess, options);
  }
  if (typedef.writeAccess && options.requireWriteAccess) {
    schema = validateAccess('write', schema, typedef.writeAccess, options);
  }

  if (typedef.softUnique) {
    schema = schema.custom(async (value, { path, originalRoot }) => {
      const { id } = originalRoot;
      await assertUnique({
        ...options,
        value,
        path,
        id,
      });
    });
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
      return DATE_SCHEMA;
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
  if (type === 'String') {
    return yd
      .allow(schema, yd.array(schema), STRING_RANGE_SCHEMA)
      .description(
        'Allows searching by a string, array of strings, or a range.',
      );
  } else if (type === 'Number') {
    return yd
      .allow(schema, yd.array(schema), NUMBER_RANGE_SCHEMA)
      .description(
        'Allows searching by a value, array of values, or a  range.',
      );
  } else if (type === 'Date') {
    return yd
      .allow(schema, yd.array(schema), DATE_RANGE_SCHEMA)
      .description('Allows searching by a date, array of dates, or a range.');
  } else if (type === 'ObjectId') {
    return yd.allow(schema, yd.array(schema));
  } else {
    return schema;
  }
}

function isRequired(typedef, options) {
  return typedef.required && !typedef.default && !options.skipRequired;
}

function allowNull(typedef, options) {
  if (!options.allowNull) {
    return false;
  }
  const { required, type } = typedef;
  return !required && type !== 'Boolean';
}

function disallowEmpty(typedef, options) {
  if (!options.allowNull) {
    return false;
  }
  const { type } = typedef;
  if (type === 'String' || type === 'ObjectId') {
    return typedef.required;
  } else {
    return false;
  }
}

function appendEmpty(typedef, options) {
  if (!options.allowNull) {
    return false;
  }
  const { required, type } = typedef;
  return !required && type === 'ObjectId';
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

function validateAccess(type, schema, allowed, options) {
  let { message } = options;
  const { modelName } = options.model;
  return schema.custom((val, options) => {
    const document = options[lowerFirst(modelName)] || options['document'];

    let isAllowed;
    try {
      isAllowed = hasAccess(allowed, {
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
        } else {
          throw new Error(
            `Access validation "${error.name}" requires passing { document, authUser } to the validator.`,
          );
        }
      } else {
        throw error;
      }
    }

    if (!isAllowed) {
      const { path } = options;
      if (path) {
        if (get(document, path) === val) {
          // If there is a path being accessed and the current
          // value is the same as what is being set then do not
          // throw the error.
          return;
        }

        // Default to not exposing the existence of this field.
        message ||= `Unknown field "${path.join('.')}".`;
      }
      throw new PermissionsError(message);
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
  const schema = NAMED_SCHEMAS[name];
  if (!schema) {
    throw new Error(`Cannot find schema for "${name}".`);
  }
  return schema;
}
