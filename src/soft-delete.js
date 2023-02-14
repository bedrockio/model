import warn from './warn';

export function applySoftDelete(schema) {
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

  schema.static('findDeleted', function findDeleted(filter) {
    return this.find({
      ...filter,
      deleted: true,
    });
  });

  schema.static('findOneDeleted', function findOneDeleted(filter) {
    return this.findOne({
      ...filter,
      deleted: true,
    });
  });

  schema.static('findByIdDeleted', function findByIdDeleted(id) {
    return this.findOne({
      _id: id,
      deleted: true,
    });
  });

  schema.static('existsDeleted', function existsDeleted() {
    return this.exists({
      deleted: true,
    });
  });

  schema.static(
    'countDocumentsDeleted',
    function countDocumentsDeleted(filter) {
      return this.countDocuments({
        ...filter,
        deleted: true,
      });
    }
  );

  schema.static('findWithDeleted', function findWithDeleted(filter) {
    return this.find({
      ...filter,
      ...getWithDeletedQuery(),
    });
  });

  schema.static('findOneWithDeleted', function findOneWithDeleted(filter) {
    return this.findOne({
      ...filter,
      ...getWithDeletedQuery(),
    });
  });

  schema.static('findByIdWithDeleted', function findByIdWithDeleted(id) {
    return this.findOne({
      _id: id,
      ...getWithDeletedQuery(),
    });
  });

  schema.static('existsWithDeleted', function existsWithDeleted() {
    return this.exists({
      ...getWithDeletedQuery(),
    });
  });

  schema.static(
    'countDocumentsWithDeleted',
    function countDocumentsWithDeleted(filter) {
      return this.countDocuments({
        ...filter,
        ...getWithDeletedQuery(),
      });
    }
  );

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
