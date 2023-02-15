import warn from './warn';

export function applySoftDelete(schema) {
  applyQueries(schema);
  applyUniqueConstraints(schema);
  applyDisallowedMethods(schema);
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

  schema.static('deleteOne', async function deleteOne(filter, ...rest) {
    const update = getDelete();
    const res = await this.updateOne(filter, update, ...rest);
    return {
      acknowledged: res.acknowledged,
      deletedCount: res.modifiedCount,
    };
  });

  schema.static('deleteMany', async function deleteMany(filter, ...rest) {
    const update = getDelete();
    const res = await this.updateMany(filter, update, ...rest);
    return {
      acknowledged: res.acknowledged,
      deletedCount: res.modifiedCount,
    };
  });

  schema.static(
    'findOneAndDelete',
    async function findOneAndDelete(filter, ...args) {
      return await this.findOneAndUpdate(filter, getDelete(), ...args);
    }
  );

  schema.static('restoreOne', async function restoreOne(filter, ...rest) {
    const update = getRestore();
    const res = await this.updateOne(filter, update, ...rest);
    return {
      acknowledged: res.acknowledged,
      restoredCount: res.modifiedCount,
    };
  });

  schema.static('restoreMany', async function restoreMany(filter, ...rest) {
    const update = getRestore();
    const res = await this.updateMany(filter, update, ...rest);
    return {
      acknowledged: res.acknowledged,
      restoredCount: res.modifiedCount,
    };
  });

  schema.static('destroyOne', async function destroyOne(...args) {
    const res = await this.collection.deleteOne(...args);
    return {
      acknowledged: res.acknowledged,
      destroyedCount: res.deletedCount,
    };
  });

  schema.static('destroyMany', async function destroyMany(...args) {
    const res = await this.collection.deleteMany(...args);
    return {
      acknowledged: res.acknowledged,
      destroyedCount: res.deletedCount,
    };
  });

  schema.static('findDeleted', function findDeleted(filter, ...rest) {
    filter = {
      ...filter,
      deleted: true,
    };
    return this.find(filter, ...rest);
  });

  schema.static('findOneDeleted', function findOneDeleted(filter, ...rest) {
    filter = {
      ...filter,
      deleted: true,
    };
    return this.findOne(filter, ...rest);
  });

  schema.static('findByIdDeleted', function findByIdDeleted(id, ...rest) {
    const filter = {
      _id: id,
      deleted: true,
    };
    return this.findOne(filter, ...rest);
  });

  schema.static('existsDeleted', function existsDeleted(filter, ...rest) {
    filter = {
      ...filter,
      deleted: true,
    };
    return this.exists(filter, ...rest);
  });

  schema.static(
    'countDocumentsDeleted',
    function countDocumentsDeleted(filter, ...rest) {
      filter = {
        ...filter,
        deleted: true,
      };
      return this.countDocuments(filter, ...rest);
    }
  );

  schema.static('findWithDeleted', function findWithDeleted(filter, ...rest) {
    filter = {
      ...filter,
      ...getWithDeletedQuery(),
    };
    return this.find(filter, ...rest);
  });

  schema.static(
    'findOneWithDeleted',
    function findOneWithDeleted(filter, ...rest) {
      filter = {
        ...filter,
        ...getWithDeletedQuery(),
      };
      return this.findOne(filter, ...rest);
    }
  );

  schema.static(
    'findByIdWithDeleted',
    function findByIdWithDeleted(id, ...rest) {
      const filter = {
        _id: id,
        ...getWithDeletedQuery(),
      };
      return this.findOne(filter, ...rest);
    }
  );

  schema.static(
    'existsWithDeleted',
    function existsWithDeleted(filter, ...rest) {
      filter = {
        ...filter,
        ...getWithDeletedQuery(),
      };
      return this.exists(filter, ...rest);
    }
  );

  schema.static(
    'countDocumentsWithDeleted',
    function countDocumentsWithDeleted(filter, ...rest) {
      filter = {
        ...filter,
        ...getWithDeletedQuery(),
      };
      return this.countDocuments(filter, ...rest);
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
    await assertUnique(this.toObject(), {
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

// Disallowed Methods

function applyDisallowedMethods(schema) {
  schema.method(
    'remove',
    function () {
      warn(
        'The "remove" method on documents is disallowed due to ambiguity.',
        'To permanently delete a document use "destroy", otherwise "delete".'
      );
      throw new Error('Method not allowed.');
    },
    {
      suppressWarning: true,
    }
  );

  schema.method('deleteOne', function () {
    warn(
      'The "deleteOne" method on documents is disallowed due to ambiguity',
      'Use either "delete" or "deleteOne" on the model.'
    );
    throw new Error('Method not allowed.');
  });

  schema.static('remove', function () {
    warn(
      'The "remove" method on models is disallowed due to ambiguity.',
      'To permanently delete a document use "destroyMany", otherwise "deleteMany".'
    );
    throw new Error('Method not allowed.');
  });

  schema.static('findOneAndRemove', function () {
    warn(
      'The "findOneAndRemove" method on models is disallowed due to ambiguity.',
      'To permanently delete a document use "findOneAndDestroy", otherwise "findOneAndDelete".'
    );
    throw new Error('Method not allowed.');
  });

  schema.static('findByIdAndRemove', function () {
    warn(
      'The "findByIdAndRemove" method on models is disallowed due to ambiguity.',
      'To permanently delete a document use "findByIdAndDestroy", otherwise "findByIdAndDelete".'
    );
    throw new Error('Method not allowed.');
  });
}
