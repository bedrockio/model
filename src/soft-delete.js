import mongoose from 'mongoose';
import { isEqual } from 'lodash';

import { wrapQuery } from './query';

export function applySoftDelete(schema) {
  applyQueries(schema);
  applyUniqueConstraints(schema);
  applyHookPatch(schema);
}

// Soft Delete Querying

function applyQueries(schema) {
  // Implementation

  schema.pre(/^find|count|exists/, function (next) {
    const filter = this.getFilter();
    if (filter.deleted === undefined) {
      // Search non-deleted docs by default
      filter.deleted = false;
    }
    return next();
  });

  // Instance Methods

  schema.method('delete', function () {
    this.deleted = true;
    this.deletedAt = new Date();
    // @ts-ignore
    return this.save();
  });

  schema.method('restore', function restore() {
    this.deleted = false;
    this.deletedAt = undefined;
    // @ts-ignore
    return this.save();
  });

  schema.method('destroy', function destroy(...args) {
    const filter = { _id: this._id };
    return this.constructor.destroyOne(filter, ...args);
  });

  // Static Methods

  schema.static('deleteOne', function deleteOne(filter, ...rest) {
    const update = getDelete();
    const query = this.updateOne(filter, update, ...omitCallback(rest));
    return wrapQuery(query, async (promise) => {
      const res = await promise;
      return {
        acknowledged: res.acknowledged,
        deletedCount: res.modifiedCount,
      };
    });
  });

  schema.static('deleteMany', function deleteMany(filter, ...rest) {
    const update = getDelete();
    const query = this.updateMany(filter, update, ...omitCallback(rest));
    return wrapQuery(query, async (promise) => {
      const res = await promise;
      return {
        acknowledged: res.acknowledged,
        deletedCount: res.modifiedCount,
      };
    });
  });

  schema.static('findOneAndDelete', function findOneAndDelete(filter, ...rest) {
    return this.findOneAndUpdate(filter, getDelete(), ...omitCallback(rest));
  });

  schema.static('restoreOne', function restoreOne(filter, ...rest) {
    const query = this.updateOne(filter, getRestore(), ...omitCallback(rest));
    return wrapQuery(query, async (promise) => {
      const res = await promise;
      return {
        acknowledged: res.acknowledged,
        restoredCount: res.modifiedCount,
      };
    });
  });

  schema.static('restoreMany', function restoreMany(filter, ...rest) {
    const query = this.updateMany(filter, getRestore(), ...omitCallback(rest));
    return wrapQuery(query, async (promise) => {
      const res = await promise;
      return {
        acknowledged: res.acknowledged,
        restoredCount: res.modifiedCount,
      };
    });
  });

  schema.static('destroyOne', function destroyOne(conditions, ...rest) {
    // Following Mongoose patterns here
    const query = new this.Query({}, {}, this, this.collection).deleteOne(
      conditions,
      ...omitCallback(rest)
    );
    return wrapQuery(query, async (promise) => {
      const res = await promise;
      return {
        acknowledged: res.acknowledged,
        destroyedCount: res.deletedCount,
      };
    });
  });

  schema.static('destroyMany', function destroyMany(conditions, ...rest) {
    // Following Mongoose patterns here
    const query = new this.Query({}, {}, this, this.collection).deleteMany(
      conditions,
      ...omitCallback(rest)
    );
    return wrapQuery(query, async (promise) => {
      const res = await promise;
      return {
        acknowledged: res.acknowledged,
        destroyedCount: res.deletedCount,
      };
    });
  });

  schema.static('findDeleted', function findDeleted(filter, ...rest) {
    filter = {
      ...filter,
      deleted: true,
    };
    return this.find(filter, ...omitCallback(rest));
  });

  schema.static('findOneDeleted', function findOneDeleted(filter, ...rest) {
    filter = {
      ...filter,
      deleted: true,
    };
    return this.findOne(filter, ...omitCallback(rest));
  });

  schema.static('findByIdDeleted', function findByIdDeleted(id, ...rest) {
    const filter = {
      _id: id,
      deleted: true,
    };
    return this.findOne(filter, ...omitCallback(rest));
  });

  schema.static('existsDeleted', function existsDeleted(filter, ...rest) {
    filter = {
      ...filter,
      deleted: true,
    };
    return this.exists(filter, ...omitCallback(rest));
  });

  schema.static(
    'countDocumentsDeleted',
    function countDocumentsDeleted(filter, ...rest) {
      filter = {
        ...filter,
        deleted: true,
      };
      return this.countDocuments(filter, ...omitCallback(rest));
    }
  );

  schema.static('findWithDeleted', function findWithDeleted(filter, ...rest) {
    filter = {
      ...filter,
      ...getWithDeletedQuery(),
    };
    return this.find(filter, ...omitCallback(rest));
  });

  schema.static(
    'findOneWithDeleted',
    function findOneWithDeleted(filter, ...rest) {
      filter = {
        ...filter,
        ...getWithDeletedQuery(),
      };
      return this.findOne(filter, ...omitCallback(rest));
    }
  );

  schema.static(
    'findByIdWithDeleted',
    function findByIdWithDeleted(id, ...rest) {
      const filter = {
        _id: id,
        ...getWithDeletedQuery(),
      };
      return this.findOne(filter, ...omitCallback(rest));
    }
  );

  schema.static(
    'existsWithDeleted',
    function existsWithDeleted(filter, ...rest) {
      filter = {
        ...filter,
        ...getWithDeletedQuery(),
      };
      return this.exists(filter, ...omitCallback(rest));
    }
  );

  schema.static(
    'countDocumentsWithDeleted',
    function countDocumentsWithDeleted(filter, ...rest) {
      filter = {
        ...filter,
        ...getWithDeletedQuery(),
      };
      return this.countDocuments(filter, ...omitCallback(rest));
    }
  );
}

function getDelete() {
  return {
    deleted: true,
    deletedAt: new Date(),
  };
}

function getRestore() {
  return {
    deleted: false,
    $unset: { deletedAt: true },
  };
}

function getWithDeletedQuery() {
  return {
    deleted: { $in: [true, false] },
  };
}

// Unique Constraints

function applyUniqueConstraints(schema) {
  const hasUnique = hasUniqueConstraints(schema);

  if (!hasUnique) {
    return;
  }

  schema.pre('save', async function () {
    await assertUnique(this, {
      operation: this.isNew ? 'create' : 'update',
      model: this.constructor,
      schema,
    });
  });

  schema.pre(/^(update|replace)/, async function () {
    await assertUniqueForQuery(this, {
      schema,
    });
  });

  schema.pre('insertMany', async function (next, obj) {
    // Note that in order to access the objects to be inserted
    // we must supply the hook with at least 2 arguments, the
    // first of which is the next hook. This typically appears
    // as the last argument, however as we are passing an async
    // function it appears to not stop the middleware if we
    // don't call it directly.
    await assertUnique(obj, {
      operation: 'create',
      model: this,
      schema,
    });
  });
}

export async function assertUnique(obj, options) {
  const { operation, model, schema } = options;
  const id = getId(obj);
  const objFields = resolveUnique(schema, obj);
  if (Object.keys(objFields).length === 0) {
    return;
  }
  const query = {
    $or: getUniqueQueries(objFields),
    ...(id && {
      _id: { $ne: id },
    }),
  };
  const found = await model.findOne(query, {}, { lean: true });
  if (found) {
    const { modelName } = model;
    const foundFields = resolveUnique(schema, found);
    const collisions = getCollisions(objFields, foundFields).join(', ');
    throw new Error(
      `Cannot ${operation} ${modelName}. Duplicate fields exist: ${collisions}.`
    );
  }
}

function getId(arg) {
  const id = arg.id || arg._id;
  return id ? String(id) : null;
}

// Asserts than an update or insert query will not
// result in duplicate unique fields being present
// within non-deleted documents.
async function assertUniqueForQuery(query, options) {
  let update = query.getUpdate();
  const operation = getOperationForQuery(update);
  // Note: No need to check unique constraints
  // if the operation is a delete.
  if (operation === 'restore' || operation === 'update') {
    const { model } = query;
    const filter = query.getFilter();
    if (operation === 'restore') {
      // A restore operation is functionally identical to a new
      // insert so we need to fetch the deleted documents with
      // all fields available to check against.
      const docs = await model.findWithDeleted(filter, {}, { lean: true });
      update = docs.map((doc) => {
        return {
          ...doc,
          ...update,
        };
      });
    }
    await assertUnique(update, {
      ...options,
      operation,
      model,
    });
  }
}

function getOperationForQuery(update) {
  if (update?.deleted === false) {
    return 'restore';
  } else if (update?.deleted === true) {
    return 'delete';
  } else {
    return 'update';
  }
}

export function hasUniqueConstraints(schema) {
  const paths = [...Object.keys(schema.paths), ...Object.keys(schema.subpaths)];
  return paths.some((key) => {
    return isUniquePath(schema, key);
  });
}

function isUniquePath(schema, key) {
  return schema.path(key)?.options?.softUnique === true;
}

// Returns a flattened map of key -> [...values]
// consisting of only paths defined as unique on the schema.
function resolveUnique(schema, obj, map = {}, path = []) {
  if (Array.isArray(obj)) {
    for (let el of obj) {
      resolveUnique(schema, el, map, path);
    }
  } else if (obj instanceof mongoose.Document) {
    obj.schema.eachPath((key) => {
      const val = obj.get(key);
      resolveUnique(schema, val, map, [...path, key]);
    });
  } else if (obj && typeof obj === 'object') {
    for (let [key, val] of Object.entries(obj)) {
      resolveUnique(schema, val, map, [...path, key]);
    }
  } else if (obj) {
    const key = path.join('.');
    if (isUniquePath(schema, key)) {
      map[key] ||= [];
      map[key].push(obj);
    }
  }
  return map;
}

// Argument is guaranteed to be flattened.
function getUniqueQueries(obj) {
  return Object.entries(obj).map(([key, val]) => {
    if (val.length > 1) {
      return { [key]: { $in: val } };
    } else {
      return { [key]: val[0] };
    }
  });
}

// Both arguments here are guaranteed to be flattened
// maps of key -> [values] of unique fields only.
function getCollisions(obj1, obj2) {
  const collisions = [];
  for (let [key, arr1] of Object.entries(obj1)) {
    const arr2 = obj2[key];
    if (arr2) {
      const hasCollision = arr1.some((val) => {
        return arr2.includes(val);
      });
      if (hasCollision) {
        collisions.push(key);
      }
    }
  }
  return collisions;
}

// Hook Patch

function applyHookPatch(schema) {
  const schemaPre = schema.pre;
  const schemaPost = schema.post;

  schema.pre = function (name, fn) {
    if (name === 'restore') {
      // Document hooks
      schemaPre.call(this, 'save', getPreDocRestore(fn));
    } else if (name === 'deleteOne') {
      // Query Hooks
      schemaPre.call(this, 'updateOne', getPreDelete(fn));
    } else if (name === 'deleteMany') {
      schemaPre.call(this, 'updateMany', getPreDelete(fn));
    } else if (name === 'findOneAndDelete') {
      schemaPre.call(this, 'findOneAndUpdate', getPreDelete(fn));
    } else if (name === 'restoreOne') {
      schemaPre.call(this, 'updateOne', getPreRestore(fn));
    } else if (name === 'restoreMany') {
      schemaPre.call(this, 'updateMany', getPreRestore(fn));
    } else if (name === 'destroyOne') {
      schemaPre.call(this, 'deleteOne', getPre(fn));
    } else if (name === 'destroyMany') {
      schemaPre.call(this, 'deleteMany', getPre(fn));
    } else if (name === 'findDeleted') {
      schemaPre.call(this, 'find', getPreDeleted(fn));
    } else if (name === 'findOneDeleted') {
      schemaPre.call(this, 'findOne', getPreDeleted(fn));
    } else if (name === 'countDocumentsDeleted') {
      schemaPre.call(this, 'countDocuments', getPreDeleted(fn));
    } else if (name === 'findWithDeleted') {
      schemaPre.call(this, 'find', getPreWithDeleted(fn));
    } else if (name === 'findOneWithDeleted') {
      schemaPre.call(this, 'findOne', getPreWithDeleted(fn));
    } else if (name === 'countDocumentsWithDeleted') {
      schemaPre.call(this, 'countDocuments', getPreWithDeleted(fn));
    } else {
      schemaPre.apply(this, arguments);
    }
    return this;
  };

  schema.post = function (name, fn) {
    if (name === 'deleteOne') {
      schemaPost.call(this, 'updateOne', getPostDelete(fn));
    } else if (name === 'deleteMany') {
      schemaPost.call(this, 'updateMany', getPostDelete(fn));
    } else if (name === 'findOneAndDelete') {
      schemaPost.call(this, 'findOneAndUpdate', getPostDelete(fn));
    } else if (name === 'restoreOne') {
      schemaPost.call(this, 'updateOne', getPostRestore(fn));
    } else if (name === 'restoreMany') {
      schemaPost.call(this, 'updateMany', getPostRestore(fn));
    } else if (name === 'destroyOne') {
      schemaPost.call(this, 'deleteOne', getPost(fn));
    } else if (name === 'destroyMany') {
      schemaPost.call(this, 'deleteMany', getPost(fn));
    } else if (name === 'findDeleted') {
      schemaPost.call(this, 'find', getPostDeleted(fn));
    } else if (name === 'findOneDeleted') {
      schemaPost.call(this, 'findOne', getPostDeleted(fn));
    } else if (name === 'countDocumentsDeleted') {
      schemaPost.call(this, 'countDocuments', getPostDeleted(fn));
    } else if (name === 'findWithDeleted') {
      schemaPost.call(this, 'find', getPostWithDeleted(fn));
    } else if (name === 'findOneWithDeleted') {
      schemaPost.call(this, 'findOne', getPostWithDeleted(fn));
    } else if (name === 'countDocumentsWithDeleted') {
      schemaPost.call(this, 'countDocuments', getPostWithDeleted(fn));
    } else {
      schemaPost.apply(this, arguments);
    }
    return this;
  };
}

// Needs to be separated as hooks check arity to
// determine the arguments to pass.

function getPre(fn, check) {
  return function (next) {
    runHook(this, fn, check, next, arguments);
  };
}

function getPost(fn, check) {
  return function (res, next) {
    runHook(this, fn, check, next, arguments);
  };
}

function runHook(query, fn, check, next, args) {
  if (!check || check(query)) {
    const ret = fn.apply(query, args);
    if (ret instanceof Promise) {
      ret.finally(next);
    }
  } else {
    next();
  }
}

function getPreDelete(fn) {
  return getPre(fn, (query) => {
    return query.get('deleted') === true;
  });
}

function getPreRestore(fn) {
  return getPre(fn, (query) => {
    return query.get('deleted') === false;
  });
}

function getPreDeleted(fn) {
  return getPre(fn, (query) => {
    return query.getFilter().deleted === true;
  });
}

function getPreWithDeleted(fn) {
  return getPre(fn, (query) => {
    return isEqual(query.getFilter().deleted, getWithDeletedQuery().deleted);
  });
}

function getPreDocRestore(fn) {
  return getPre(fn, (doc) => {
    return doc.isModified('deleted') && doc.deleted === false;
  });
}

function getPostDelete(fn) {
  return getPost(fn, (query) => {
    return query.get('deleted') === true;
  });
}

function getPostRestore(fn) {
  return getPost(fn, (query) => {
    return query.get('deleted') === false;
  });
}

function getPostDeleted(fn) {
  return getPost(fn, (query) => {
    return query.getFilter().deleted === true;
  });
}

function getPostWithDeleted(fn) {
  return getPost(fn, (query) => {
    return isEqual(query.getFilter().deleted, getWithDeletedQuery().deleted);
  });
}

// Utils

// Mongoose >= v7 no longer accepts a callback for queries,
// however it still passes post hooks to static methods for
// some reason (this appears to be a bug), so omit functions
// here to allow projectsion/options to still be passed.
function omitCallback(args) {
  return args.filter((arg) => {
    return typeof arg !== 'function';
  });
}
