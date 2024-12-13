import mongoose from 'mongoose';

const { SchemaTypes } = mongoose;

// Mongoose provides an "equals" method on both documents and
// ObjectIds, however it does not provide a static method to
// compare two unknown values that may be either, so provide
// it here.
export function isEqual(a, b) {
  if (a === b) {
    return true;
  } else if (a instanceof mongoose.Document) {
    return a.equals(b);
  } else if (b instanceof mongoose.Document) {
    return b.equals(a);
  } else if (a instanceof mongoose.Types.ObjectId) {
    return a.equals(b);
  } else if (b instanceof mongoose.Types.ObjectId) {
    return b.equals(a);
  } else {
    return false;
  }
}

export function isMongooseSchema(obj) {
  return obj instanceof mongoose.Schema;
}

export function isReferenceField(obj, path) {
  return isType(obj, path, 'ObjectId');
}

export function isDateField(obj, path) {
  return isType(obj, path, 'Date');
}

export function isNumberField(obj, path) {
  return isType(obj, path, 'Number');
}

export function isArrayField(obj, path) {
  const field = getField(obj, path);
  return Array.isArray(field?.type);
}

function isType(obj, path, test) {
  const { type } = getInnerField(obj, path);
  return type === test || type === mongoose.Schema.Types[test];
}

export function isSchemaTypedef(arg) {
  // Has a type defined and is not a literal type field.
  return !!arg?.type && !arg.type?.type;
}

// Gets the schema "field". For a structure like below:
// {
//   products: {
//     type: [
//       {
//         inventory: {
//           type: [
//             {
//               type: 'Number',
//             },
//           ],
//           writeAccess: 'none',
//         },
//       },
//     ],
//   },
// }
//
// Given a path "products.inventory" it will return the inner
// "inventory" field. It must traverse into arrays and other mongoose
// schemas along the way except for the final field.
export function getField(obj, path) {
  let field = obj;
  if (typeof path === 'string') {
    path = path.split('.');
  }
  path.forEach((key, i) => {
    field = field[key];
    if (i < path.length - 1) {
      field = resolveInnerField(field);
    }
  });
  return field || {};
}

// Finds a reference field in a schema and splits
// the provided path into the local and foreign
// components of the full path.
export function resolveRefPath(schema, path) {
  const split = path.split('.');
  for (let i = 1; i < split.length; i++) {
    const base = split.slice(0, i);
    const rest = split.slice(i);

    let type = schema.path(base.join('.'));
    if (type instanceof SchemaTypes.Array) {
      type = type.caster;
    }

    if (type instanceof SchemaTypes.ObjectId) {
      const { ref } = type.options;
      return {
        ref,
        local: base.join('.'),
        foreign: rest.join('.'),
      };
    }
  }
}

// The same as getField but traverses into the final field
// as well. In the above example this will return:
// { type: 'Number' }, given "product.inventory"
export function getInnerField(obj, path) {
  return resolveInnerField(getField(obj, path));
}

function resolveInnerField(field) {
  if (Array.isArray(field?.type)) {
    field = field.type[0];
  }
  if (field?.type instanceof mongoose.Schema) {
    field = field.type.obj;
  } else if (field instanceof mongoose.Schema) {
    field = field.obj;
  }
  return field;
}
