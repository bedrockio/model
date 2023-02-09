import mongoose from 'mongoose';
import { isPlainObject } from 'lodash';

import { camelUpper, isMongooseSchema } from './utils';

import { serializeOptions } from './serialization';
import { applySlug } from './slug';
import { applySearch } from './search';
import { applyAssign } from './assign';
import { applyInclude } from './include';
import { applyReferences } from './references';
import { applySoftDelete } from './soft-delete';
import {
  applyValidation,
  getNamedValidator,
  getTupleValidator,
} from './validation';

const { ObjectId: SchemaObjectId } = mongoose.Schema.Types;

export function createSchema(definition, options = {}) {
  const schema = new mongoose.Schema(
    attributesToMongoose({
      ...definition.attributes,

      // Although timestamps are being set below, we still need to add
      // them to the schema so that validation can be generated for them,
      // namely in getSearchValidation.
      createdAt: 'Date',
      updatedAt: 'Date',
      deletedAt: 'Date',
      deleted: { type: 'Boolean', default: false },
    }),
    {
      // Include timestamps by default.
      timestamps: true,
      toJSON: serializeOptions,
      toObject: serializeOptions,
      ...options,
    }
  );

  applySoftDelete(schema, definition);
  applyValidation(schema, definition);
  applyReferences(schema, definition);
  applyInclude(schema, definition);
  applySearch(schema, definition);
  applyAssign(schema, definition);
  applySlug(schema, definition);

  return schema;
}

function attributesToMongoose(attributes, path = []) {
  const definition = {};
  const { type } = attributes;

  // Is this a Mongoose descriptor like
  // { type: String, required: true }
  // or nested fields of Mixed type.
  const isSchemaType = !!type && typeof type !== 'object';

  for (let [key, val] of Object.entries(attributes)) {
    const type = typeof val;
    if (isSchemaType) {
      if (key === 'type') {
        val = getMongooseType(val, path, attributes);
      } else if (key === 'match' && type === 'string') {
        // Convert match field to RegExp that cannot be expressed in JSON.
        val = RegExp(val);
      } else if (key === 'validate' && type === 'string') {
        // Allow custom mongoose validation function that derives from the schema.
        val = getNamedValidator(val);
      }
    } else if (Array.isArray(val)) {
      val = val.map((el, i) => {
        if (typeof el !== 'string') {
          el = attributesToMongoose(el, [...path, i]);
        }
        return el;
      });
      if (val.length > 1) {
        // Note that validators will not run with:
        // { type: 'Array' }
        // [{ type: 'Mixed' }]
        val = {
          type: ['Mixed'],
          validate: getTupleValidator(val),
        };
      }
    } else if (isPlainObject(val)) {
      val = attributesToMongoose(val, [...path, key]);
    } else if (!isMongooseSchema(val)) {
      val = getMongooseType(val, path);
    }
    definition[key] = val;
  }

  return definition;
}

function getMongooseType(arg, path, typedef = {}) {
  // Handle strings or functions.
  const str = arg.name || arg;
  const type = mongoose.Schema.Types[str];
  if (!type) {
    if (camelUpper(str) in mongoose.Schema.Types) {
      throw new Error(`Type "${str}" should be in capitalized camel case.`);
    } else {
      throw new Error(`Unknown Mongoose type "${str}".`);
    }
  } else if (type === SchemaObjectId && !typedef.ref && !typedef.refPath) {
    throw new Error(`Ref must be passed for ${path.join('.')}`);
  } else if (typedef.ref && type !== SchemaObjectId) {
    throw new Error(`Schema with a ref must be of type ObjectId.`);
  }
  return type;
}
