import { isEqual } from 'lodash';

import { wrapQuery } from './query';
import { UniqueConstraintError } from './errors';

export function applySoftDelete(schema) {
  applyQueries(schema);
  applyUniqueConstraints(schema);
  applyHookPatch(schema);
}

export async function assertUnique(options) {
  let { id, model, path, value } = options;

  if (!value) {
    return;
  }

  const field = Array.isArray(path) ? path.join('.') : path;

  const query = {
    [field]: value,
    _id: { $ne: id },
  };

  const exists = await model.exists(query);
  if (exists) {
    const message = getUniqueErrorMessage(model, field);
    throw new UniqueConstraintError(message, {
      model,
      field,
      value,
    });
  }
}

function getUniqueErrorMessage(model, field) {
  const { modelName } = model;
  if (modelName === 'User' && !field.includes('.')) {
    const name = field === 'phone' ? 'phone number' : field;
    return `A user with that ${name} already exists.`;
  } else {
    return `"${field}" already exists.`;
  }
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
    return this.save({
      // Do not validate when soft deleting the data is effectively
      // gone for now, however ensure that we do validate when restoring.
      validateBeforeSave: false,
    });
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
    const query = this.updateOne(
      {
        ...filter,
        deleted: false,
      },
      update,
      ...omitCallback(rest),
    );
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
    const query = this.updateMany(
      {
        ...filter,
        deleted: false,
      },
      update,
      ...omitCallback(rest),
    );
    return wrapQuery(query, async (promise) => {
      const res = await promise;
      return {
        acknowledged: res.acknowledged,
        deletedCount: res.modifiedCount,
      };
    });
  });

  schema.static('findOneAndDelete', function findOneAndDelete(filter, ...rest) {
    return this.findOneAndUpdate(
      {
        ...filter,
        deleted: false,
      },
      getDelete(),
      ...omitCallback(rest),
    );
  });

  schema.static('restoreOne', function restoreOne(filter, ...rest) {
    const query = this.updateOne(
      {
        ...filter,
        deleted: true,
      },
      getRestore(),
      ...omitCallback(rest),
    );
    return wrapQuery(query, async (promise) => {
      const res = await promise;
      return {
        acknowledged: res.acknowledged,
        restoredCount: res.modifiedCount,
      };
    });
  });

  schema.static('restoreMany', function restoreMany(filter, ...rest) {
    const query = this.updateMany(
      {
        ...filter,
        deleted: true,
      },
      getRestore(),
      ...omitCallback(rest),
    );
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
      ...omitCallback(rest),
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
      ...omitCallback(rest),
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
    },
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
    },
  );

  schema.static(
    'findByIdWithDeleted',
    function findByIdWithDeleted(id, ...rest) {
      const filter = {
        _id: id,
        ...getWithDeletedQuery(),
      };
      return this.findOne(filter, ...omitCallback(rest));
    },
  );

  schema.static(
    'existsWithDeleted',
    function existsWithDeleted(filter, ...rest) {
      filter = {
        ...filter,
        ...getWithDeletedQuery(),
      };
      return this.exists(filter, ...omitCallback(rest));
    },
  );

  schema.static(
    'countDocumentsWithDeleted',
    function countDocumentsWithDeleted(filter, ...rest) {
      filter = {
        ...filter,
        ...getWithDeletedQuery(),
      };
      return this.countDocuments(filter, ...omitCallback(rest));
    },
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
  const uniquePaths = getUniqueConstraints(schema);

  if (!uniquePaths.length) {
    return;
  }

  schema.pre('save', async function () {
    for (let path of uniquePaths) {
      await assertUnique({
        path,
        id: this.id,
        value: this.get(path),
        model: this.constructor,
      });
    }
  });

  schema.pre(/^(update|replace)/, async function () {
    await assertUniqueForQuery(this, {
      schema,
      uniquePaths,
    });
  });

  schema.pre('insertMany', async function (next, obj) {
    // Note that in order to access the objects to be inserted
    // we must supply the hook with at least 2 arguments, the
    // first of which is the next hook. This typically appears
    // as the last argument, however as we are passing an async
    // function it appears to not stop the middleware if we
    // don't call it directly.

    await runUniqueConstraints(obj, {
      model: this,
      uniquePaths,
    });
  });
}

async function runUniqueConstraints(arg, options) {
  const { uniquePaths, model } = options;
  // Updates or inserts
  const operations = Array.isArray(arg) ? arg : [arg];
  for (let operation of operations) {
    for (let path of uniquePaths) {
      const value = operation[path];
      if (value) {
        await assertUnique({
          path,
          value,
          model,
        });
      }
    }
  }
}

// Asserts than an update or insert query will not
// result in duplicate unique fields being present
// within non-deleted documents.
async function assertUniqueForQuery(query, options) {
  const update = query.getUpdate();
  const operation = getOperationForQuery(update);
  // Note: No need to check unique constraints
  // if the operation is a delete.
  if (operation === 'restore' || operation === 'update') {
    const { model } = query;
    const filter = query.getFilter();

    let updates;
    if (operation === 'restore') {
      // A restore operation is functionally identical to a new
      // insert so we need to fetch the deleted documents with
      // all fields available to check against.
      const docs = await model.findWithDeleted(filter, {}, { lean: true });
      updates = docs.map((doc) => {
        return {
          ...doc,
          ...update,
        };
      });
    } else {
      updates = [update];
    }

    const { uniquePaths } = options;
    for (let update of updates) {
      for (let path of uniquePaths) {
        const value = update[path];
        if (value) {
          await assertUnique({
            path,
            value,
            model,
          });
        }
      }
    }
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

function getUniqueConstraints(schema) {
  const paths = [...Object.keys(schema.paths), ...Object.keys(schema.subpaths)];
  return paths.filter((key) => {
    return isUniquePath(schema, key);
  });
}

function isUniquePath(schema, key) {
  return schema.path(key)?.options?.softUnique === true;
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
