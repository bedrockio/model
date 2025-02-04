import warn from './warn';

export function applyDisallowed(schema) {
  schema.method('deleteOne', function () {
    warn(
      'The "deleteOne" method on documents is disallowed due to ambiguity',
      'Use either "delete" or "deleteOne" on the model.',
    );
    throw new Error('Method not allowed.');
  });

  schema.static('findOneAndRemove', function () {
    warn(
      'The "findOneAndRemove" method on models is disallowed due to ambiguity.',
      'To permanently delete a document use "findOneAndDestroy", otherwise "findOneAndDelete".',
    );
    throw new Error('Method not allowed.');
  });

  schema.static('findByIdAndRemove', function () {
    warn(
      'The "findByIdAndRemove" method on models is disallowed due to ambiguity.',
      'To permanently delete a document use "findByIdAndDestroy", otherwise "findByIdAndDelete".',
    );
    throw new Error('Method not allowed.');
  });

  schema.static('count', function () {
    warn(
      'The "count" method on models is deprecated. Use "countDocuments" instead.',
    );
    throw new Error('Method not allowed.');
  });
}
