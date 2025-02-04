import mongoose from 'mongoose';

const { ObjectId } = mongoose.Types;

export function applySlug(schema) {
  schema.static('findByIdOrSlug', function findByIdOrSlug(str, ...args) {
    return find(this, str, args);
  });

  schema.static(
    'findByIdOrSlugDeleted',
    function findByIdOrSlugDeleted(str, ...args) {
      return find(this, str, args, {
        deleted: true,
      });
    },
  );

  schema.static(
    'findByIdOrSlugWithDeleted',
    function findByIdOrSlugWithDeleted(str, ...args) {
      return find(this, str, args, {
        deleted: { $in: [true, false] },
      });
    },
  );
}

function find(Model, str, args, deleted) {
  const isObjectId = str.length === 24 && ObjectId.isValid(str);
  // There is a non-zero chance of a slug colliding with an ObjectId but
  // is exceedingly rare (run of exactly 24 [a-f0-9] chars together
  // without a hyphen) so this should be acceptable.
  const query = {};
  if (isObjectId) {
    query._id = str;
  } else {
    query.slug = str;
  }
  return Model.findOne(
    {
      ...deleted,
      ...query,
    },
    ...args,
  );
}
