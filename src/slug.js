import mongoose from 'mongoose';

const { ObjectId } = mongoose.Types;

export function applySlug(schema) {
  schema.static('findByIdOrSlug', function findByIdOrSlug(str, query = {}) {
    // There is a non-zero chance of a slug colliding with an ObjectId but
    // is exceedingly rare (run of exactly 24 [a-f0-9] chars together
    // without a hyphen) so this should be acceptable and greatly simplifies
    // the routes. Also enforce 24 chars as 12 is also techincally valid.
    if (str.length === 24 && ObjectId.isValid(str)) {
      query = { ...query, _id: str };
    } else {
      query = { ...query, slug: str };
    }
    return this.findOne({
      ...query,
    });
  });

  schema.static(
    'findByIdOrSlugWithDeleted',
    function findByIdOrSlugWithDeleted(str, query) {
      return this.findByIdOrSlug(str, {
        ...query,
        deleted: { $in: [true, false] },
      });
    }
  );
}
