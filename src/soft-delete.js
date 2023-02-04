export function applySoftDelete(schema) {
  schema.pre(/^find|count|exists/, function (next) {
    const filter = this.getFilter();
    if (filter.deleted === undefined) {
      // Search non-deleted docs by default
      filter.deleted = false;
    }
    return next();
  });

  schema.method('delete', function () {
    this.deletedAt = new Date();
    this.deleted = true;
    return this.save();
  });

  schema.method('restore', function restore() {
    this.deletedAt = undefined;
    this.deleted = false;
    return this.save();
  });

  schema.method('destroy', function destroy() {
    return this.remove();
  });

  schema.static('findDeleted', function findOneDeleted(filter) {
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
      deleted: { $in: [true, false] },
    });
  });

  schema.static('findOneWithDeleted', function findOneWithDeleted(filter) {
    return this.findOne({
      ...filter,
      deleted: { $in: [true, false] },
    });
  });

  schema.static('findByIdWithDeleted', function findByIdWithDeleted(id) {
    return this.findOne({
      _id: id,
      deleted: { $in: [true, false] },
    });
  });

  schema.static('existsWithDeleted', function existsWithDeleted() {
    return this.exists({
      deleted: { $in: [true, false] },
    });
  });

  schema.static(
    'countDocumentsWithDeleted',
    function countDocumentsWithDeleted(filter) {
      return this.countDocuments({
        ...filter,
        deleted: { $in: [true, false] },
      });
    }
  );
}
