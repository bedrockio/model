import mongoose from 'mongoose';

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
  if (field instanceof mongoose.Schema) {
    field = field.obj;
  }
  return field;
}
