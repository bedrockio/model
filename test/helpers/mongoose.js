import { equals, iterableEquality, subsetEquality } from '@jest/expect-utils';
import mongoose from 'mongoose';

const { ObjectId, Subdocument } = mongoose.Types;

// Custom serializer for mongoose ObjectId
expect.addSnapshotSerializer({
  test(val) {
    return val instanceof ObjectId;
  },
  serialize(val) {
    return `ObjectId("${val.toString()}")`;
  },
});

// Custom serializer for mongoose Subdocuments
expect.addSnapshotSerializer({
  test(val) {
    return val instanceof Subdocument;
  },
  serialize(val, config, indentation, depth, refs, printer) {
    return printer(val.toObject(), config, indentation, depth, refs);
  },
});

// Helper to recursively convert mongoose objects to plain objects
function mongooseToPlain(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  // Keep ObjectId as-is for comparison
  if (obj instanceof ObjectId) {
    return obj;
  }
  if (obj instanceof Subdocument) {
    return mongooseToPlain(obj.toObject());
  }
  if (obj?.toObject && typeof obj.toObject === 'function') {
    return mongooseToPlain(obj.toObject());
  }
  if (Array.isArray(obj)) {
    return obj.map(mongooseToPlain);
  }
  if (typeof obj === 'object' && obj.constructor === Object) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, mongooseToPlain(v)]),
    );
  }
  return obj;
}

// Override toEqual and toMatchObject to handle mongoose objects
expect.extend({
  toEqual(received, expected) {
    const plainReceived = mongooseToPlain(received);
    const plainExpected = mongooseToPlain(expected);
    const pass = equals(plainReceived, plainExpected, [iterableEquality], true);

    return {
      pass,
      message: () => {
        const hint = this.utils.matcherHint('toEqual', undefined, undefined, {
          isNot: this.isNot,
          promise: this.promise,
        });
        const diff = this.utils.diff(plainExpected, plainReceived, {
          expand: this.expand,
        });
        return `${hint}\n\n${diff || 'Expected values to be equal'}`;
      },
    };
  },

  toMatchObject(received, expected) {
    const plainReceived = mongooseToPlain(received);
    const plainExpected = mongooseToPlain(expected);

    const pass = equals(plainReceived, plainExpected, [
      iterableEquality,
      subsetEquality,
    ]);

    return {
      pass,
      message: () => {
        const hint = this.utils.matcherHint(
          'toMatchObject',
          undefined,
          undefined,
          {
            isNot: this.isNot,
            promise: this.promise,
          },
        );
        const diff = this.utils.diff(plainExpected, plainReceived, {
          expand: this.expand,
        });
        return `${hint}\n\n${diff || 'Expected object to match'}`;
      },
    };
  },
});

// Custom equality tester for ObjectId
expect.addEqualityTesters([
  function objectIdEqualityTester(a, b) {
    if (a instanceof ObjectId && b instanceof ObjectId) {
      return a.equals(b);
    }
    return undefined;
  },
]);
