import yd from '@bedrockio/yada';
import { lowerFirst } from 'lodash';

import {
  getValidationSchema,
  getNamedValidator,
  addValidators,
} from '../src/validation';
import { createTestModel } from '../src/testing';
import { createSchema } from '../src/schema';
import { UniqueConstraintError } from '../src/errors';

async function assertPass(schema, obj, expected, options) {
  try {
    const result = await schema.validate(obj, options);
    if (expected) {
      expect(result).toEqual(expected);
    } else {
      expect(true).toBe(true);
    }
  } catch (error) {
    // eslint-disable-next-line
    console.error(JSON.stringify(error, null, 2));
    throw error;
  }
}

async function assertFail(schema, obj, options, message) {
  try {
    await schema.validate(obj, options);
    throw new Error('Expected failure but passed.');
  } catch (error) {
    if (!error.details) {
      throw error;
    } else if (message) {
      expect(error.getFullMessage()).toBe(message);
    }
    expect(error).not.toBeUndefined();
  }
}

async function assertPassOptions(schema, obj, options) {
  await assertPass(schema, obj, undefined, options);
}

async function assertFailOptions(schema, obj, options) {
  await assertFail(schema, obj, options);
}

async function assertFailWithError(schema, obj, message) {
  await assertFail(schema, obj, undefined, message);
}

describe('getCreateValidation', () => {
  it('should get a basic create schema', async () => {
    const User = createTestModel({
      name: {
        type: 'String',
        required: true,
      },
      count: {
        type: 'Number',
        required: true,
      },
    });
    const schema = User.getCreateValidation();
    expect(yd.isSchema(schema)).toBe(true);
    await assertPass(schema, {
      name: 'foo',
      count: 10,
    });
    await assertFail(schema, {
      name: 'foo',
    });
    await assertFail(schema, {
      name: 10,
      count: 10,
    });
    await assertFail(schema, {
      foo: 'bar',
    });
  });

  it('should handle location schema', async () => {
    const User = createTestModel({
      location: {
        type: {
          type: 'String',
          default: 'Point',
        },
        coordinates: {
          type: ['Number'],
        },
      },
    });
    const schema = User.getCreateValidation();
    await assertPass(schema, {
      location: {
        type: 'Line',
        coordinates: [35, 95],
      },
    });
    await assertFail(schema, {
      location: 'Line',
    });
  });

  it('should not require a field with a default', async () => {
    const User = createTestModel({
      name: {
        type: 'String',
        required: true,
      },
      type: {
        type: 'String',
        required: true,
        enum: ['foo', 'bar'],
        default: 'foo',
      },
    });
    const schema = User.getCreateValidation();
    expect(yd.isSchema(schema)).toBe(true);
    await assertPass(schema, {
      name: 'foo',
    });
  });

  it('should apply a named validator', async () => {
    const User = createTestModel({
      email: {
        type: 'String',
        validate: 'email',
      },
    });
    const schema = User.getCreateValidation();
    await assertPass(schema, {
      email: 'foo@bar.com',
    });

    await assertFailWithError(
      schema,
      {
        email: 'foo',
      },
      '"email" must be an email address.',
    );
  });

  it('should apply a US phone validator', async () => {
    const User = createTestModel({
      phone: {
        type: 'String',
        validate: 'phone:US',
      },
    });
    const schema = User.getCreateValidation();
    expect(yd.isSchema(schema)).toBe(true);
    await assertPass(schema, {
      phone: '',
    });
    await assertPass(schema, {
      phone: '+15552222222',
    });
    await assertFail(schema, {
      phone: '+1222',
    });
    await assertFail(schema, {
      phone: '+818080103122',
    });
  });

  it('should apply a custom validator', async () => {
    const User = createTestModel({
      name: {
        type: 'String',
        validate: (val) => {
          if (val === 'bar') {
            throw new Error('No bars!');
          }
        },
      },
    });
    const schema = User.getCreateValidation();
    await assertPass(schema, {
      name: 'foo',
    });

    await assertFailWithError(
      schema,
      {
        name: 'bar',
      },
      'No bars!',
    );
  });

  it('should coerce id field to a string', async () => {
    const User = createTestModel({
      shop: {
        type: 'ObjectId',
        ref: 'Shop',
      },
    });
    const schema = User.getCreateValidation();
    const result = await schema.validate({
      shop: {
        foo: 'bar',
        id: '5fd396fac80fa73203bd9554',
      },
    });
    expect(result.shop).toBe('5fd396fac80fa73203bd9554');

    await assertFailWithError(
      schema,
      {
        shop: {
          id: 'bad-id',
        },
      },
      '"shop" must be an id or object containing an "id" field.',
    );
  });

  it('should not fail on a dynamic default', async () => {
    const User = createTestModel({
      name: 'String',
      lastAccessedAt: {
        type: 'Date',
        default: 'now',
      },
    });

    const schema = User.getCreateValidation();
    await expect(
      schema.validate({
        name: 'foo',
      }),
    ).resolves.not.toThrow();
  });

  it('should not fail on an empty string', async () => {
    const User = createTestModel({
      name: 'String',
      nested: {
        field: 'String',
      },
      array: [
        {
          field: 'String',
        },
      ],
    });
    const schema = User.getCreateValidation();
    await assertPass(schema, {
      name: '',
      nested: {
        field: '',
      },
      array: [
        {
          field: '',
        },
      ],
    });
  });

  it('should strip empty strings', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = User.getCreateValidation();
    const result = await schema.validate({
      name: '',
    });
    expect(result).toEqual({});
  });

  describe('modification', () => {
    it('should append schemas with append', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          required: true,
        },
      });
      const schema = User.getCreateValidation().append({
        count: yd.number().required(),
      });
      expect(yd.isSchema(schema)).toBe(true);
      await assertFail(schema, {
        name: 'foo',
      });
      await assertPass(schema, {
        name: 'foo',
        count: 10,
      });
    });

    it('should append schemas with export', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          required: true,
        },
      });

      const schema = yd.object({
        ...User.getCreateValidation().export(),
        count: yd.number().required(),
      });
      await assertFail(schema, {
        name: 'foo',
      });
      await assertPass(schema, {
        name: 'foo',
        count: 10,
      });
    });
  });

  describe('write access', () => {
    it('should deny access', async () => {
      const User = createTestModel({
        name: 'String',
        verified: {
          type: 'Boolean',
          writeAccess: 'none',
        },
      });
      const schema = User.getCreateValidation();

      await assertPass(schema, {
        name: 'Barry',
      });

      await assertFail(
        schema,
        {
          name: 'Barry',
          verified: true,
        },
        {},
        'Unknown field "verified".',
      );

      await assertFail(
        schema,
        {
          verified: false,
        },
        {},
        'Unknown field "verified".',
      );
    });

    it('should deny access to an array field', async () => {
      const User = createTestModel({
        name: 'String',
        tokens: {
          type: ['String'],
          writeAccess: 'none',
        },
      });

      const schema = User.getCreateValidation();
      await assertPass(schema, {
        name: 'Barry',
      });
      await assertFail(schema, {
        name: 'Barry',
        tokens: ['fake token'],
      });
      await assertFail(schema, {
        name: 'Barry',
        tokens: [],
      });
    });

    it('should deny access to simple array field', async () => {
      const User = createTestModel({
        name: 'String',
        tokens: [
          {
            type: 'String',
            writeAccess: 'none',
          },
        ],
      });

      const schema = User.getCreateValidation();
      await assertPass(schema, {
        name: 'Barry',
      });
      await assertFail(schema, {
        name: 'Barry',
        tokens: ['fake token'],
      });
      await assertFail(schema, {
        name: 'Barry',
        tokens: [],
      });
    });

    it('should deny access on a deep field', async () => {
      const User = createTestModel({
        name: 'String',
        a: {
          b: {
            c: {
              type: 'String',
              writeAccess: 'none',
            },
          },
        },
      });
      const schema = User.getCreateValidation();
      await assertPass(schema, {
        name: 'Barry',
      });
      await assertFail(schema, {
        name: 'Barry',
        a: {
          b: {
            c: 'deep',
          },
        },
      });
    });

    it('should deny access by scope', async () => {
      const User = createTestModel({
        name: 'String',
        password: {
          type: 'String',
          writeAccess: ['admin'],
        },
      });
      const schema = User.getCreateValidation();

      await assertPass(schema, {
        name: 'Barry',
      });

      await assertPassOptions(
        schema,
        {
          name: 'Barry',
          password: 'fake password',
        },
        { scope: 'admin' },
      );

      await assertFail(
        schema,
        {
          name: 'Barry',
          password: 'fake password',
        },
        {},
        'Unknown field "password".',
      );
    });

    it('should require only one valid scope', async () => {
      const User = createTestModel({
        foo: {
          type: 'String',
          writeAccess: ['foo'],
        },
        bar: {
          type: 'String',
          writeAccess: ['bar'],
        },
        foobar: {
          type: 'String',
          writeAccess: ['foo', 'bar'],
        },
      });
      const schema = User.getCreateValidation();

      // With ['foo'] scopes
      await assertPassOptions(
        schema,
        {
          foo: 'foo!',
        },
        { scopes: ['foo'] },
      );
      await assertFailOptions(
        schema,
        {
          bar: 'bar!',
        },
        { scopes: ['foo'] },
      );
      await assertPassOptions(
        schema,
        {
          foobar: 'foobar!',
        },
        { scopes: ['foo'] },
      );
      await assertPassOptions(
        schema,
        {
          foo: 'foo!',
          foobar: 'foobar!',
        },
        { scopes: ['foo'] },
      );
      await assertFailOptions(
        schema,
        {
          foo: 'foo!',
          bar: 'bar!',
          foobar: 'foobar!',
        },
        { scopes: ['foo'] },
      );

      // With ['bar'] scopes
      await assertFailOptions(
        schema,
        {
          foo: 'foo!',
        },
        { scopes: ['bar'] },
      );
      await assertPassOptions(
        schema,
        {
          bar: 'bar!',
        },
        { scopes: ['bar'] },
      );
      await assertPassOptions(
        schema,
        {
          foobar: 'foobar!',
        },
        { scopes: ['bar'] },
      );
      await assertFailOptions(
        schema,
        {
          foo: 'foo!',
          foobar: 'foobar!',
        },
        { scopes: ['bar'] },
      );
      await assertFailOptions(
        schema,
        {
          foo: 'foo!',
          bar: 'bar!',
          foobar: 'foobar!',
        },
        { scopes: ['bar'] },
      );

      // With ['foo', 'bar'] scopes
      await assertPassOptions(
        schema,
        {
          foo: 'foo!',
        },
        { scopes: ['foo', 'bar'] },
      );
      await assertPassOptions(
        schema,
        {
          bar: 'bar!',
        },
        { scopes: ['foo', 'bar'] },
      );
      await assertPassOptions(
        schema,
        {
          foobar: 'foobar!',
        },
        { scopes: ['foo', 'bar'] },
      );
      await assertPassOptions(
        schema,
        {
          foo: 'foo!',
          foobar: 'foobar!',
        },
        { scopes: ['foo', 'bar'] },
      );
      await assertPassOptions(
        schema,
        {
          foo: 'foo!',
          bar: 'bar!',
          foobar: 'foobar!',
        },
        { scopes: ['foo', 'bar'] },
      );
    });

    it('should skip field entirely if no write access', async () => {
      const User = createTestModel({
        name: 'String',
        apiKey: {
          type: 'String',
          required: true,
          writeAccess: 'none',
        },
      });
      const schema = User.getCreateValidation();
      await assertPass(schema, {
        name: 'Barry',
      });
      await assertFail(schema, {
        name: 'Barry',
        apiKey: 'foo',
      });
    });

    it('should be able to skip access checks', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          writeAccess: 'none',
        },
      });

      const schema = User.getCreateValidation({
        requireWriteAccess: false,
      });

      await assertPass(schema, {
        name: 'Barry',
      });
    });
  });

  describe('soft unique', () => {
    it('should enforce soft uniqueness', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      const user = await User.create({
        email: 'foo@bar.com',
      });
      const schema = User.getCreateValidation();

      // Does not exist -> can create.
      await assertPass(schema, {
        email: 'foo@foo.com',
      });

      // Exists -> throw error.
      await assertFailWithError(
        schema,
        {
          email: 'foo@bar.com',
        },
        '"email" already exists.',
      );

      // Available again -> can create.
      await user.delete();
      await assertPass(schema, {
        email: 'foo@bar.com',
      });
    });

    it('should enforce other constraints with unique', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
        name: {
          type: 'String',
          required: true,
        },
      });
      const user = await User.create({
        name: 'foo',
        email: 'foo@bar.com',
      });
      const schema = User.getCreateValidation();

      // Does not exist -> can create.
      await assertFail(schema, {
        email: 'foo@foo.com',
      });

      await assertPass(schema, {
        name: 'foo',
        email: 'foo@foo.com',
      });

      await user.destroy();
    });

    it('should enforce soft uniqueness on a nested field', async () => {
      const User = createTestModel({
        profile: {
          email: {
            type: 'String',
            unique: true,
          },
        },
      });
      const user = await User.create({
        profile: {
          email: 'foo@bar.com',
        },
      });
      const schema = User.getCreateValidation();

      // Does not exist -> can create.
      await assertPass(schema, {
        profile: {
          email: 'foo@foo.com',
        },
      });

      // Exists -> throw error.
      await assertFailWithError(
        schema,
        {
          profile: {
            email: 'foo@bar.com',
          },
        },
        '"profile.email" already exists.',
      );

      // Available again -> can create.
      await user.delete();
      await assertPass(schema, {
        profile: {
          email: 'foo@bar.com',
        },
      });
    });

    it('should enforce soft uniqueness on an array field', async () => {
      const User = createTestModel({
        businesses: [
          {
            email: {
              type: 'String',
              unique: true,
            },
          },
        ],
      });
      const user = await User.create({
        businesses: [
          {
            email: 'foo@bar.com',
          },
        ],
      });
      const schema = User.getCreateValidation();

      // Does not exist -> can create.
      await assertPass(schema, {
        businesses: [
          {
            email: 'foo@foo.com',
          },
        ],
      });

      // Exists -> throw error.
      await assertFailWithError(
        schema,
        {
          businesses: [
            {
              email: 'foo@bar.com',
            },
          ],
        },
        '"businesses.email" already exists.',
      );

      // Available again -> can create.
      await user.delete();
      await assertPass(schema, {
        businesses: [
          {
            email: 'foo@bar.com',
          },
        ],
      });
    });

    it('should have one-off messages for User', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
        phone: {
          type: 'String',
          unique: true,
        },
      });
      User.modelName = 'User';
      await User.create({
        email: 'foo@bar.com',
        phone: '+15551234567',
      });
      const schema = User.getCreateValidation();

      await assertFailWithError(
        schema,
        {
          email: 'foo@bar.com',
        },
        'A user with that email already exists.',
      );

      await assertFailWithError(
        schema,
        {
          phone: '+15551234567',
        },
        'A user with that phone number already exists.',
      );
    });

    it('should not have one-off messages for nested fields.', async () => {
      const User = createTestModel({
        business: {
          email: {
            type: 'String',
            unique: true,
          },
        },
      });
      User.modelName = 'User';
      await User.create({
        business: {
          email: 'foo@bar.com',
        },
      });
      const schema = User.getCreateValidation();

      await assertFailWithError(
        schema,
        {
          business: {
            email: 'foo@bar.com',
          },
        },
        '"business.email" already exists.',
      );
    });

    it('should expose details with custom error message', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      await User.create({
        email: 'foo@bar.com',
      });
      const schema = User.getCreateValidation();

      let error;

      try {
        await schema.validate({
          email: 'foo@bar.com',
        });
      } catch (err) {
        error = err;
      }

      const data = JSON.parse(JSON.stringify(error));
      expect(data).toEqual({
        type: 'validation',
        details: [
          {
            type: 'field',
            details: [
              {
                type: 'unique',
                message: '"email" already exists.',
              },
            ],
            field: 'email',
          },
        ],
      });

      const uniqueError = error.details[0].details[0];
      expect(uniqueError).toBeInstanceOf(UniqueConstraintError);
      expect(uniqueError.details.field).toBe('email');
      expect(uniqueError.details.value).toBe('foo@bar.com');
      expect(uniqueError.details.model).toBe(User);
    });
  });

  describe('OpenAPI', () => {
    it('should correctly describe its schema', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          required: true,
        },
        status: {
          type: 'String',
          default: 'active',
        },
        profileImage: {
          type: 'ObjectId',
          ref: 'Upload',
        },
        shop: {
          ref: 'Shop',
          type: 'ObjectId',
          required: true,
        },
      });
      const schema = User.getCreateValidation();
      expect(schema.toOpenApi()).toMatchObject({
        type: 'object',
        properties: {
          name: {
            type: 'string',
            required: true,
          },
          status: {
            type: 'string',
            default: 'active',
          },
          profileImage: {
            oneOf: [
              {
                type: 'string',
              },
              {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                  },
                },
              },
            ],
          },
          shop: {
            oneOf: [
              {
                type: 'string',
                format: 'mongo-object-id',
              },
              {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    required: true,
                    format: 'mongo-object-id',
                  },
                },
              },
            ],
            required: true,
          },
        },
      });
    });

    it('should correctly describe its schema with includes', async () => {
      const User = createTestModel({
        name: 'String',
      });
      const schema = User.getCreateValidation({
        allowInclude: true,
      });
      expect(schema.toOpenApi()).toMatchObject({
        type: 'object',
        properties: {
          include: {
            oneOf: [
              {
                type: 'string',
              },
              {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            ],
          },
        },
      });
    });
  });

  it('should work correctly with array schemas', async () => {
    const User = createTestModel({
      name: {
        type: 'String',
        required: true,
      },
    });
    const schema = yd.array(User.getCreateValidation());
    await assertPass(schema, [
      {
        name: 'foo',
      },
    ]);
  });

  it('should have correct error details', async () => {
    const User = createTestModel({
      shop: {
        type: 'ObjectId',
        ref: 'Shop',
      },
    });
    const schema = User.getCreateValidation();
    try {
      await schema.validate({
        shop: {
          id: 'bad-id',
        },
      });
    } catch (error) {
      const data = JSON.parse(JSON.stringify(error));
      expect(data.details).toEqual([
        {
          details: [
            {
              details: [
                {
                  details: [
                    {
                      format: 'mongo-object-id',
                      message: 'Must be a valid ObjectId.',
                      type: 'format',
                    },
                  ],
                  field: 'id',
                  message: 'Must be a valid object id.',
                  type: 'field',
                },
              ],
              type: 'allowed',
            },
          ],
          field: 'shop',
          message: 'Must be an id or object containing an "id" field.',
          type: 'field',
        },
      ]);
    }
  });

  it('should get a validation on a shallow field', async () => {
    const User = createTestModel({
      name: {
        type: 'String',
        validate: 'email',
        required: true,
      },
    });
    const schema = User.getCreateValidation();
    const name = schema.get('name');

    await assertPass(name, 'foo@bar.com');
    await assertFail(name, 'foo');
    await assertFail(name, '');
    await assertFail(name, null);
  });

  it('should get a validation on a deep field', async () => {
    const User = createTestModel({
      profile: {
        name: {
          type: 'String',
          validate: 'email',
          required: true,
        },
      },
    });
    const schema = User.getCreateValidation();
    const name = schema.get('profile.name');

    await assertPass(name, 'foo@bar.com');
    await assertFail(name, 'foo');
    await assertFail(name, '');
    await assertFail(name, null);
  });

  it('should make optional fields required', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = User.getCreateValidation().require('name');

    await assertPass(schema, { name: 'John Doe' });
    await assertFail(schema, { name: '' });
    await assertFail(schema, {});
  });

  it('should make deep optional fields required', async () => {
    const User = createTestModel({
      profile: {
        name: 'String',
      },
    });
    const schema = User.getCreateValidation().require('profile.name');

    await assertPass(schema, { profile: { name: 'John Doe' } });
    await assertFail(schema, { profile: { name: '' } });
    await assertPass(schema, {});
  });

  it('should make intermediary objects required', async () => {
    const User = createTestModel({
      profile: {
        name: 'String',
      },
    });
    const schema = User.getCreateValidation().require('profile');

    await assertPass(schema, { profile: { name: 'John Doe' } });
    await assertPass(schema, { profile: {} });
    await assertFail(schema, {});
  });

  it('should not have intermediary objects required by default', async () => {
    const User = createTestModel({
      profile: {
        name: 'String',
      },
    });
    const schema = User.getCreateValidation();

    await assertPass(schema, { profile: { name: 'John Doe' } });
    await assertPass(schema, { profile: {} });
    await assertPass(schema, {});
  });
});

describe('getUpdateValidation', () => {
  it('should not fail on empty object', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = User.getUpdateValidation();
    await assertPass(schema, {});
  });

  it('should skip unknown in nested validations', async () => {
    const User = createTestModel({
      names: [
        {
          first: 'String',
        },
      ],
    });
    const schema = User.getUpdateValidation();
    await assertPass(schema, {
      names: [
        {
          id: 'fake id',
          first: 'First',
        },
      ],
    });
  });

  it('should skip required fields', async () => {
    const User = createTestModel({
      name: {
        type: 'String',
        required: true,
      },
      count: {
        type: 'Number',
        required: true,
      },
    });
    const schema = User.getUpdateValidation();
    expect(yd.isSchema(schema)).toBe(true);
    await assertPass(schema, {
      name: 'foo',
    });
    await assertPass(schema, {
      count: 10,
    });
  });

  it('should not require reference fields', async () => {
    const Shop = createTestModel({
      name: 'String',
    });
    const User = createTestModel({
      name: 'String',
      shop: {
        type: 'ObjectId',
        ref: Shop.modelName,
        required: true,
      },
    });
    const schema = User.getUpdateValidation();
    expect(yd.isSchema(schema)).toBe(true);
    await assertPass(schema, {
      name: 'foo',
    });
    await assertPass(schema, {
      shop: '5fd396fac80fa73203bd9554',
    });
    await assertFail(schema, {
      shop: '',
    });
  });

  describe('unsetting', () => {
    it('should allow null or empty to unset optional string fields', async () => {
      const User = createTestModel({
        name: 'String',
      });
      const schema = User.getUpdateValidation();
      expect(yd.isSchema(schema)).toBe(true);
      await assertPass(schema, {
        name: null,
      });
      await assertPass(schema, {
        name: '',
      });
    });

    it('should allow null to unset optional number fields', async () => {
      const User = createTestModel({
        count: {
          type: 'Number',
        },
      });
      const schema = User.getUpdateValidation();
      expect(yd.isSchema(schema)).toBe(true);
      await assertPass(schema, {
        count: null,
      });
      await assertFail(schema, {
        count: '',
      });
    });

    it('should allow null or empty on nested primitive fields', async () => {
      const User = createTestModel({
        nested: {
          name: 'String',
          count: 'Number',
        },
      });
      const schema = User.getUpdateValidation();
      expect(yd.isSchema(schema)).toBe(true);
      await assertPass(schema, {
        nested: {
          name: '',
          count: null,
        },
      });
      await assertPass(schema, {
        nested: {
          name: null,
          count: null,
        },
      });
      await assertPass(schema, {
        nested: {
          name: '',
          count: null,
        },
      });
    });

    it('should not allow null or empty to unset required number fields', async () => {
      const User = createTestModel({
        count: {
          type: 'Number',
          required: true,
        },
      });
      const schema = User.getUpdateValidation();
      expect(yd.isSchema(schema)).toBe(true);
      await assertFail(schema, {
        count: null,
      });
      await assertFail(schema, {
        count: '',
      });
    });

    it('should not allow null or empty to unset required string fields', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          required: true,
        },
      });
      const schema = User.getUpdateValidation();
      expect(yd.isSchema(schema)).toBe(true);
      await assertFail(schema, {
        name: null,
      });
      await assertFail(schema, {
        name: '',
      });
    });

    it('should allow null or empty to unset optional reference fields', async () => {
      const User = createTestModel({
        shop: {
          type: 'ObjectId',
          ref: 'Shop',
        },
      });
      const schema = User.getUpdateValidation();
      expect(yd.isSchema(schema)).toBe(true);
      await assertPass(schema, {
        shop: null,
      });
      await assertPass(schema, {
        shop: '',
      });
    });

    it('should not allow null or empty to unset required reference fields', async () => {
      const User = createTestModel({
        shop: {
          type: 'ObjectId',
          ref: 'Shop',
          required: true,
        },
      });
      const schema = User.getUpdateValidation();
      expect(yd.isSchema(schema)).toBe(true);
      await assertFail(schema, {
        shop: null,
      });
      await assertFail(schema, {
        shop: '',
      });
    });

    it('should not allow null or empty on array fields', async () => {
      const User = createTestModel({
        tags: ['String'],
      });
      const schema = User.getUpdateValidation();
      expect(yd.isSchema(schema)).toBe(true);
      await assertFail(schema, {
        tags: null,
      });
      await assertFail(schema, {
        tags: '',
      });
    });

    it('should not allow null or empty on boolean fields', async () => {
      const User = createTestModel({
        active: 'Boolean',
      });
      const schema = User.getUpdateValidation();
      expect(yd.isSchema(schema)).toBe(true);
      await assertFail(schema, {
        active: null,
      });
      await assertFail(schema, {
        active: '',
      });
    });

    it('should allow unsetting a field with a format validation', async () => {
      const User = createTestModel({
        phone: {
          type: 'String',
          validate: 'phone',
        },
      });
      const schema = User.getUpdateValidation();
      expect(yd.isSchema(schema)).toBe(true);
      await assertPass(schema, {
        phone: '',
      });
    });
  });

  it('should not enforce a schema on unstructured objects', async () => {
    const User = createTestModel({
      profile: {
        name: 'String',
      },
      devices: [
        {
          type: 'Object',
        },
      ],
    });
    const schema = User.getUpdateValidation();
    expect(yd.isSchema(schema)).toBe(true);
    await assertPass(schema, {
      devices: [
        {
          id: 'id',
          name: 'name',
          class: 'class',
        },
      ],
    });
    await assertPass(schema, {
      profile: {
        name: 'foo',
      },
      devices: [
        {
          id: 'id',
          name: 'name',
          class: 'class',
        },
      ],
    });

    const result = await schema.validate({
      profile: {
        name: 'name',
        foo: 'bar',
      },
      devices: [
        {
          id: 'id',
          name: 'name',
          class: 'class',
        },
      ],
    });
    expect(result).toEqual({
      profile: {
        name: 'name',
      },
      devices: [
        {
          id: 'id',
          name: 'name',
          class: 'class',
        },
      ],
    });
  });

  it('should strip reserved fields', async () => {
    const User = createTestModel({
      name: {
        type: 'String',
        required: true,
      },
    });
    const schema = User.getUpdateValidation();
    await assertPass(schema, {
      name: 'foo',
      id: 'id',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      deletedAt: 'deletedAt',
    });
  });

  it('should strip virtuals', async () => {
    const User = createTestModel({
      firstName: {
        type: 'String',
        required: true,
      },
      lastName: {
        type: 'String',
        required: true,
      },
    });
    User.schema.virtual('fullName').get(function () {
      return `${this.firstName} ${this.lastName}`;
    });
    const user = new User({
      firstName: 'John',
      lastName: 'Doe',
    });
    const data = user.toObject();
    expect(data).toEqual({
      id: user.id,
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
    });
    const schema = User.getUpdateValidation();
    await assertPass(schema, data);
    expect(await schema.validate(data)).toEqual({
      firstName: 'John',
      lastName: 'Doe',
    });
  });

  it('should strip nested virtuals', async () => {
    const Profile = createTestModel({
      firstName: {
        type: 'String',
        required: true,
      },
      lastName: {
        type: 'String',
        required: true,
      },
    });
    Profile.schema.virtual('fullName').get(function () {
      return `${this.firstName} ${this.lastName}`;
    });
    const User = createTestModel({
      profile: Profile.schema,
    });
    const user = new User({
      profile: {
        firstName: 'John',
        lastName: 'Doe',
      },
    });
    const data = user.toObject();
    expect(data).toEqual({
      id: user.id,
      profile: {
        id: user.profile.id,
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
      },
    });
    const schema = User.getUpdateValidation();
    await assertPass(schema, data);
    expect(await schema.validate(data)).toEqual({
      profile: {
        firstName: 'John',
        lastName: 'Doe',
      },
    });
  });

  it('should not skip required validations in array fields', async () => {
    const User = createTestModel({
      users: [
        {
          name: {
            type: 'String',
            required: true,
          },
          count: 'Number',
        },
      ],
    });
    const schema = User.getUpdateValidation();
    expect(yd.isSchema(schema)).toBe(true);
    await assertPass(schema, {
      users: [
        {
          name: 'foo',
        },
      ],
    });
    await assertPass(schema, {
      users: [
        {
          name: 'foo',
          count: 1,
        },
      ],
    });
    await assertFail(schema, {
      users: [{}],
    });
    await assertFail(schema, {
      users: [
        {
          count: 1,
        },
      ],
    });
  });

  it('should coerce id field to a string', async () => {
    const User = createTestModel({
      shop: {
        type: 'ObjectId',
        ref: 'Shop',
      },
    });
    const schema = User.getUpdateValidation();
    const result = await schema.validate({
      shop: {
        foo: 'bar',
        id: '5fd396fac80fa73203bd9554',
      },
    });
    expect(result.shop).toBe('5fd396fac80fa73203bd9554');

    await assertFailWithError(
      schema,
      {
        shop: {
          id: 'bad-id',
        },
      },
      '"shop.id" must be a valid object id.',
    );
  });

  describe('modification', () => {
    it('should append schemas with append', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          required: true,
        },
      });
      const schema = User.getUpdateValidation().append({
        count: yd.number().required(),
      });
      expect(yd.isSchema(schema)).toBe(true);
      await assertFail(schema, {
        name: 'foo',
      });
      await assertPass(schema, {
        name: 'foo',
        count: 10,
      });
    });

    it('should append schemas with export', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          required: true,
        },
      });

      const schema = yd.object({
        ...User.getUpdateValidation().export(),
        count: yd.number().required(),
      });
      await assertFail(schema, {
        name: 'foo',
      });
      await assertPass(schema, {
        name: 'foo',
        count: 10,
      });
    });
  });
  describe('write access', () => {
    it('should strip field on attempt to update with no write scopes', async () => {
      const User = createTestModel({
        name: 'String',
        password: {
          type: 'String',
          writeAccess: 'none',
        },
      });
      const schema = User.getUpdateValidation();
      await assertPass(
        schema,
        {
          name: 'Barry',
          password: 'fake password',
        },
        {
          name: 'Barry',
        },
      );
    });

    it('should throw on attempt to update with invalid scopes', async () => {
      const User = createTestModel({
        name: 'String',
        password: {
          type: 'String',
          writeAccess: 'admin',
        },
      });
      const schema = User.getUpdateValidation();
      await expect(
        schema.validate(
          {
            name: 'Barry',
            password: 'fake password',
          },
          {
            scope: 'not admin',
          },
        ),
      ).rejects.toThrow();
    });

    it('should not throw when value has not changed', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          writeAccess: 'admin',
        },
        profile: {
          age: {
            type: 'Number',
            writeAccess: 'admin',
          },
        },
      });
      const user = await User.create({
        name: 'Joe',
        profile: {
          age: 30,
        },
      });
      const schema = User.getUpdateValidation();

      await expect(
        schema.validate(
          {
            name: 'Joe',
          },
          {
            document: user,
          },
        ),
      ).resolves.not.toThrow();

      await expect(
        schema.validate(
          {
            profile: {
              age: 30,
            },
          },
          {
            document: user,
          },
        ),
      ).resolves.not.toThrow();

      await expect(
        schema.validate(
          {
            name: 'Joe',
            profile: {
              age: 30,
            },
          },
          {
            document: user,
          },
        ),
      ).resolves.not.toThrow();

      await expect(
        schema.validate(
          {
            name: 'Bill',
          },
          {
            document: user,
          },
        ),
      ).rejects.toThrow();

      await expect(
        schema.validate(
          {
            profile: {
              age: 50,
            },
          },
          {
            document: user,
          },
        ),
      ).rejects.toThrow();
    });

    it('should handle self scope', async () => {
      const User = createTestModel({
        name: 'String',
        grade: {
          type: 'Number',
          writeAccess: 'self',
        },
      });
      const user1 = await User.create({
        name: 'Barry',
      });
      const user2 = await User.create({
        name: 'Larry',
      });
      const schema = User.getCreateValidation();

      await expect(
        schema.validate(
          {
            name: 'Barry',
            grade: 50,
          },
          {
            document: user1,
            authUser: user1,
          },
        ),
      ).resolves.not.toThrow();

      await expect(
        schema.validate(
          {
            name: 'Barry',
            grade: 50,
          },
          {
            document: user1,
            authUser: user2,
          },
        ),
      ).rejects.toThrow();
    });

    it('should resolve from the model name', async () => {
      const User = createTestModel({
        name: 'String',
        grade: {
          type: 'Number',
          writeAccess: 'self',
        },
      });
      const user = await User.create({
        name: 'Barry',
      });
      const schema = User.getCreateValidation();

      await expect(
        schema.validate(
          {
            name: 'Barry',
            grade: 50,
          },
          {
            [lowerFirst(User.modelName)]: user,
            authUser: user,
          },
        ),
      ).resolves.not.toThrow();
    });

    it('should throw if not the same', async () => {
      const User = createTestModel({
        name: 'String',
        grade: {
          type: 'Number',
          writeAccess: 'self',
        },
      });
      const user1 = await User.create({
        name: 'Barry',
        grade: 50,
      });
      const user2 = await User.create({
        name: 'Larry',
        grade: 50,
      });
      const schema = User.getCreateValidation();

      await expect(
        schema.validate(
          {
            name: 'Barry',
            grade: 50,
          },
          {
            document: user1,
            authUser: user1,
          },
        ),
      ).resolves.not.toThrow();

      await expect(
        schema.validate(
          {
            name: 'Barry',
            grade: 50,
          },
          {
            document: user1,
            authUser: user2,
          },
        ),
      ).resolves.not.toThrow();

      await expect(
        schema.validate(
          {
            name: 'Barry',
            grade: 70,
          },
          {
            document: user1,
            authUser: user2,
          },
        ),
      ).rejects.toThrow();
    });

    it('should validate document based access', async () => {
      const User = createTestModel({
        name: 'String',
      });
      const Shop = createTestModel(
        createSchema({
          attributes: {
            name: 'String',
            owner: {
              type: 'ObjectId',
              ref: User.modelName,
            },
          },
          access: {
            update: ['owner', 'admin'],
          },
        }),
      );

      const schema = Shop.getUpdateValidation();

      const user1 = await User.create({
        name: 'Barry',
      });

      const user2 = await User.create({
        name: 'Larry',
      });

      const admin = await User.create({
        name: 'Admin',
      });

      const viewer = await User.create({
        name: 'Viewer',
      });

      const shop = await Shop.create({
        name: 'My Shop',
        owner: user1,
      });

      await assertPass(
        schema,
        {
          name: 'My New Shop',
        },
        {
          name: 'My New Shop',
        },
        {
          document: shop,
          authUser: user1,
        },
      );

      await assertPass(
        schema,
        {
          name: 'My New Shop',
        },
        {
          name: 'My New Shop',
        },
        {
          document: shop,
          authUser: admin,
          scopes: ['admin'],
        },
      );

      await assertFail(
        schema,
        {
          name: 'My New Shop',
        },
        {
          document: shop,
          authUser: user2,
        },
        'You do not have permissions to update this document.',
      );

      await assertFail(
        schema,
        {
          name: 'My New Shop',
        },
        {
          document: shop,
          authUser: viewer,
          scopes: ['viewer'],
        },
        'You do not have permissions to update this document.',
      );
    });

    it('should validate document based access with id', async () => {
      const User = createTestModel({
        name: 'String',
      });
      const Shop = createTestModel(
        createSchema({
          attributes: {
            name: 'String',
            owner: {
              type: 'ObjectId',
              ref: User.modelName,
            },
          },
          access: {
            update: ['owner', 'admin'],
          },
        }),
      );

      const schema = Shop.getUpdateValidation();

      const user1 = await User.create({
        name: 'Barry',
      });

      const user2 = await User.create({
        name: 'Larry',
      });

      const shop = await Shop.create({
        name: 'My Shop',
        owner: user1.id,
      });

      await assertPass(
        schema,
        {
          name: 'My New Shop',
        },
        {
          name: 'My New Shop',
        },
        {
          document: shop,
          authUser: user1,
        },
      );

      await assertFail(
        schema,
        {
          name: 'My New Shop',
        },
        {
          document: shop,
          authUser: user2,
        },
        'You do not have permissions to update this document.',
      );
    });

    it('should be able to skip access checks', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          writeAccess: 'none',
        },
      });

      const schema = User.getUpdateValidation({
        requireWriteAccess: false,
      });

      const result = await schema.validate({
        name: 'Barry',
      });

      expect(result).toEqual({
        name: 'Barry',
      });
    });
  });

  describe('soft unique', () => {
    it('should enforce soft uniqueness', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      const user = await User.create({
        email: 'foo@bar.com',
      });
      const schema = User.getUpdateValidation();

      // Does not exist -> can create.
      await assertPass(schema, {
        email: 'foo@foo.com',
      });

      // Exists -> throw error.
      await assertFailWithError(
        schema,
        {
          email: 'foo@bar.com',
        },
        '"email" already exists.',
      );

      // Available again -> can create.
      await user.delete();
      await assertPass(schema, {
        email: 'foo@bar.com',
      });
    });

    it('should exclude self on update', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      const user = await User.create({
        email: 'foo@bar.com',
      });
      const schema = User.getUpdateValidation();

      // Does not exist -> can create.
      await assertPass(schema, {
        id: user.id,
        email: 'foo@bar.com',
      });
    });

    it('should not exclude self if no id exists', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      await User.create({
        email: 'foo@bar.com',
      });
      const schema = User.getUpdateValidation();

      // Cannot exclude self as no id was passed,
      // so unique constraint causes a failure.
      await assertFail(schema, {
        email: 'foo@bar.com',
      });
    });
  });

  describe('OpenAPI', () => {
    it('should correctly describe its schema', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          required: true,
        },
        shop: {
          ref: 'Shop',
          type: 'ObjectId',
          required: true,
        },
      });
      const schema = User.getUpdateValidation();
      expect(schema.toOpenApi()).toMatchObject({
        type: 'object',
        properties: {
          name: {
            type: 'string',
          },
          shop: {
            oneOf: [
              {
                type: 'string',
                format: 'mongo-object-id',
              },
              {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    required: true,
                    format: 'mongo-object-id',
                  },
                },
              },
            ],
          },
        },
      });
    });
  });
});

describe('getDeleteValidation', () => {
  it('should validate document based access', async () => {
    const User = createTestModel({
      name: {
        type: 'String',
        required: true,
      },
    });
    const Shop = createTestModel(
      createSchema({
        attributes: {
          name: {
            type: 'String',
            required: true,
          },
          owner: {
            type: 'ObjectId',
            ref: User.modelName,
            required: true,
          },
        },
        access: {
          delete: ['owner', 'admin'],
        },
      }),
    );

    const schema = Shop.getDeleteValidation();

    const user1 = await User.create({
      name: 'Barry',
    });

    const user2 = await User.create({
      name: 'Larry',
    });

    const admin = await User.create({
      name: 'Admin',
    });

    const viewer = await User.create({
      name: 'Viewer',
    });

    const shop = await Shop.create({
      name: 'My Shop',
      owner: user1,
    });

    await assertPass(
      schema,
      {
        name: 'My New Shop',
      },
      {
        name: 'My New Shop',
      },
      {
        document: shop,
        authUser: user1,
      },
    );

    await assertPass(
      schema,
      {
        name: 'My New Shop',
      },
      {
        name: 'My New Shop',
      },
      {
        document: shop,
        authUser: admin,
        scopes: ['admin'],
      },
    );

    await assertFail(
      schema,
      {
        name: 'My New Shop',
      },
      {
        document: shop,
        authUser: user2,
      },
      'You do not have permissions to delete this document.',
    );

    await assertFail(
      schema,
      {
        name: 'My New Shop',
      },
      {
        document: shop,
        authUser: viewer,
        scopes: ['viewer'],
      },
      'You do not have permissions to delete this document.',
    );
  });

  it('should not validate access if not defined', async () => {
    const User = createTestModel({
      name: {
        type: 'String',
        required: true,
      },
    });
    const Shop = createTestModel(
      createSchema({
        attributes: {
          name: {
            type: 'String',
            required: true,
          },
          owner: {
            type: 'ObjectId',
            ref: User.modelName,
            required: true,
          },
        },
      }),
    );

    const schema = Shop.getDeleteValidation();

    const user1 = await User.create({
      name: 'Barry',
    });

    const user2 = await User.create({
      name: 'Larry',
    });

    const admin = await User.create({
      name: 'Admin',
    });

    const viewer = await User.create({
      name: 'Viewer',
    });

    const shop = await Shop.create({
      name: 'My Shop',
      owner: user1,
    });

    await assertPass(
      schema,
      {
        name: 'My New Shop',
      },
      {
        name: 'My New Shop',
      },
      {
        document: shop,
        authUser: user1,
      },
    );

    await assertPass(
      schema,
      {
        name: 'My New Shop',
      },
      {
        name: 'My New Shop',
      },
      {
        document: shop,
        authUser: admin,
        scopes: ['admin'],
      },
    );

    await assertPass(
      schema,
      {
        name: 'My New Shop',
      },
      {
        name: 'My New Shop',
      },
      {
        document: shop,
        authUser: user2,
      },
    );

    await assertPass(
      schema,
      {
        name: 'My New Shop',
      },
      {
        name: 'My New Shop',
      },
      {
        document: shop,
        authUser: viewer,
        scopes: ['viewer'],
      },
    );
  });
});

describe('getSearchValidation', () => {
  it('should get a basic search schema allowing empty', async () => {
    const User = createTestModel({
      name: {
        type: 'String',
        required: true,
      },
    });
    const schema = User.getSearchValidation();
    expect(yd.isSchema(schema)).toBe(true);
    await assertPass(schema, {
      name: 'foo',
    });
    await assertPass(schema, {});
  });

  it('should mixin default search schema', async () => {
    const User = createTestModel({
      name: {
        type: 'String',
        required: true,
      },
    });
    const schema = User.getSearchValidation();
    await assertPass(schema, {
      name: 'foo',
      keyword: 'keyword',
      skip: 1,
      limit: 5,
      sort: {
        field: 'createdAt',
        order: 'desc',
      },
      ids: ['6345a7f52773f7001d97c0d2'],
    });

    await assertFail(schema, {
      ids: ['12345'],
    });
  });

  it('should allow an array for a string field', async () => {
    const User = createTestModel({
      name: {
        type: 'String',
        required: true,
      },
    });
    const schema = User.getSearchValidation();
    expect(yd.isSchema(schema)).toBe(true);
    await assertPass(schema, {
      name: ['foo', 'bar'],
    });
    await assertPass(schema, {});
  });

  it('should allow range based search', async () => {
    const User = createTestModel({
      age: 'Number',
      date: 'Date',
      name: 'String',
    });
    const schema = User.getSearchValidation();
    expect(yd.isSchema(schema)).toBe(true);
    await assertPass(schema, {
      age: { gte: 5 },
    });
    await assertPass(schema, {
      date: { gte: '2020-01-01' },
    });
    await assertPass(schema, {
      name: { gte: 'Frank' },
    });
    await assertPass(schema, {});
  });

  it('should unwind array fields', async () => {
    const User = createTestModel({
      tokens: ['String'],
    });
    const schema = User.getSearchValidation();
    await assertPass(schema, {
      tokens: 'foo',
    });
  });

  it('should allow search on a nested object field', async () => {
    const User = createTestModel({
      profile: {
        name: 'String',
      },
    });
    const schema = User.getSearchValidation();
    await assertPass(schema, {
      profile: {
        name: 'foo',
      },
    });
  });

  it('should allow search on a nested array field', async () => {
    const User = createTestModel({
      roles: [
        {
          role: {
            type: 'String',
            required: true,
          },
          scope: {
            type: 'String',
            required: true,
          },
        },
      ],
    });
    const schema = User.getSearchValidation();
    await assertPass(schema, {
      roles: {
        role: 'test',
      },
    });
  });

  it('should allow an array to be passed for sort', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = User.getSearchValidation();
    expect(yd.isSchema(schema)).toBe(true);
    await assertPass(schema, {
      name: 'foo',
      sort: [
        {
          field: 'name',
          order: 'asc',
        },
        {
          field: 'createdAt',
          order: 'desc',
        },
      ],
    });
  });

  it('should expand dot syntax', async () => {
    const User = createTestModel({
      profile: {
        name: 'String',
      },
    });
    const schema = User.getSearchValidation();
    await assertPass(schema, {
      'profile.name': 'foo',
    });
    await assertFail(schema, {
      'profile.age': 22,
    });
  });

  it('should strip empty strings', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = User.getSearchValidation();
    const result = await schema.validate({
      name: '',
    });
    expect(result).toEqual({
      limit: 50,
      skip: 0,
      sort: {
        field: '_id',
        order: 'asc',
      },
    });
  });

  describe('write access', () => {
    it('should not enforce write access', async () => {
      const User = createTestModel({
        name: 'String',
        age: {
          type: 'Number',
          writeAccess: 'none',
        },
      });
      const schema = User.getSearchValidation();
      await assertPass(schema, {
        name: 'Barry',
      });
      await assertPass(schema, {
        name: 'Barry',
        age: 50,
      });
    });
  });

  describe('read access', () => {
    it('should ignore field if no read access', async () => {
      const User = createTestModel({
        name: 'String',
        age: {
          type: 'Number',
          readAccess: 'none',
        },
      });
      const schema = User.getSearchValidation();
      await assertPass(schema, {
        name: 'Barry',
      });
      await assertFailWithError(
        schema,
        {
          name: 'Barry',
          age: 50,
        },
        'Unknown field "age".',
      );
    });

    it('should ignore field if only has self read access', async () => {
      const User = createTestModel({
        name: 'String',
        age: {
          type: 'Number',
          readAccess: 'self',
        },
      });
      const schema = User.getSearchValidation();
      await assertPass(schema, {
        name: 'Barry',
      });
      await assertFailWithError(
        schema,
        {
          name: 'Barry',
          age: 50,
        },
        'Unknown field "age".',
      );
    });

    it('should not error on "self" if other access level is met', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          readAccess: ['self', 'admin'],
        },
      });
      const schema = User.getSearchValidation();
      await assertPassOptions(
        schema,
        {
          name: 'Barry',
        },
        {
          scope: 'admin',
        },
      );
    });
  });

  describe('ranges', () => {
    it('should append a number range schema', async () => {
      const User = createTestModel({
        age: 'Number',
      });
      const schema = User.getSearchValidation();
      await assertPass(schema, { age: 5 });
      await assertPass(schema, { age: { lte: 5 } });
      await assertPass(schema, { age: { gte: 5 } });
      await assertPass(schema, { age: { gte: 5, lte: 5 } });
      await assertPass(schema, { age: { lt: 5 } });
      await assertPass(schema, { age: { gt: 5 } });
      await assertPass(schema, { age: { gt: 5, lt: 5 } });
      await assertPass(schema, { age: {} });
      await assertFail(schema, { age: { lte: 'bad' } });
    });

    it('should append a date range schema', async () => {
      const User = createTestModel({
        startsAt: 'Date',
      });
      const schema = User.getSearchValidation();
      await assertPass(schema, { startsAt: '2020-01-01' });
      await assertPass(schema, { startsAt: { lte: '2020-01-01' } });
      await assertPass(schema, { startsAt: { gte: '2019-01-01' } });
      await assertPass(schema, {
        startsAt: { gte: '2019-01-01', lte: '2020-01-01' },
      });
      await assertPass(schema, { startsAt: { lt: '2020-01-01' } });
      await assertPass(schema, { startsAt: { gt: '2019-01-01' } });
      await assertPass(schema, {
        startsAt: { gt: '2019-01-01', lt: '2020-01-01' },
      });
      await assertPass(schema, { startsAt: {} });
      await assertFail(schema, { startsAt: { lte: 'bad' } });
    });
  });

  describe('OpenAPI', () => {
    it('should correctly describe its schema', async () => {
      const User = createTestModel({
        name: 'String',
        tokens: [
          {
            type: 'String',
            readAccess: 'none',
          },
        ],
      });
      const schema = User.getSearchValidation();
      const openApi = schema.toOpenApi();
      expect(openApi).toMatchObject({
        type: 'object',
        properties: {
          name: {
            oneOf: [
              {
                type: 'string',
                nullable: true,
              },
              {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              {
                type: 'object',
                properties: {
                  gt: {
                    type: 'string',
                  },
                  gte: {
                    type: 'string',
                  },
                  lt: {
                    type: 'string',
                  },
                  lte: {
                    type: 'string',
                  },
                },
              },
            ],
          },
        },
      });
      expect(openApi.properties.tokens).toBeUndefined();
    });
  });

  it('should allow min/max on fields', async () => {
    const Review = createTestModel({
      age: {
        type: 'Number',
        min: 0,
        max: 100,
      },
      date: {
        type: 'Date',
        min: '2020-01-01',
        max: '2021-01-01',
      },
    });
    const schema = Review.getSearchValidation();
    await assertPass(schema, {
      age: 50,
    });
    await assertFail(schema, {
      age: -50,
    });
    await assertFail(schema, {
      age: 150,
    });
    await assertPass(schema, {
      date: '2020-06-01',
    });
    await assertFail(schema, {
      date: '2019-01-01',
    });
    await assertFail(schema, {
      date: '2022-01-01',
    });
    await assertPass(schema, {});
  });

  it('should strip deleted fields', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = User.getSearchValidation();
    await assertPass(schema, {
      name: 'foo',
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    });
    await assertFail(schema, {
      deletedAt: '2020-01-01T00:00:00Z',
    });
    await assertFail(schema, {
      deleted: true,
    });
  });

  it('should pass defaults as options', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = User.getSearchValidation({
      defaults: {
        limit: 5,
        sort: {
          field: 'name',
          order: 'desc',
        },
      },
    });

    const result = await schema.validate({});
    expect(result).toEqual({
      limit: 5,
      skip: 0,
      sort: {
        field: 'name',
        order: 'desc',
      },
    });
  });

  it('should provide a way to include deleted', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = User.getSearchValidation({
      stripDeleted: false,
    });
    await assertPass(schema, {
      deleted: true,
      deletedAt: '2020-01-01T00:00:00Z',
    });
  });

  it('should allow null', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = User.getSearchValidation();
    expect(yd.isSchema(schema)).toBe(true);
    await assertPass(schema, {
      name: null,
    });
  });

  it('should not allow null on required fields', async () => {
    const User = createTestModel({
      name: {
        type: 'String',
        required: true,
      },
    });
    const schema = User.getSearchValidation();
    expect(yd.isSchema(schema)).toBe(true);
    await assertFail(schema, {
      name: null,
    });
  });

  it('should append schema', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = User.getSearchValidation().append({
      age: yd.number(),
    });
    await assertPass(schema, {
      name: 'foo',
      age: 25,
    });
  });
});

describe('getBaseSchema', () => {
  it('should get the base model schema', async () => {
    const User = createTestModel({
      name: {
        type: 'String',
        required: true,
      },
    });
    const schema = User.getBaseSchema();
    expect(yd.isSchema(schema)).toBe(true);
    await assertPass(schema, {
      name: 'foo',
    });
    await assertFail(schema, {});
  });

  describe('OpenAPI', () => {
    it('should correctly describe its schema', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          required: true,
        },
        shop: {
          ref: 'Shop',
          type: 'ObjectId',
          required: true,
        },
      });
      const schema = User.getBaseSchema();
      expect(schema.toOpenApi()).toMatchObject({
        type: 'object',
        properties: {
          name: {
            type: 'string',
            required: true,
          },
          shop: {
            type: 'string',
            required: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      });
    });

    it('should correctly describe a mixed schema', async () => {
      const User = createTestModel({
        any: 'Mixed',
      });
      const schema = User.getBaseSchema();
      expect(schema.toOpenApi()).toMatchObject({
        type: 'object',
        properties: {
          any: {
            type: ['object', 'array', 'string', 'number', 'boolean', 'null'],
          },
        },
      });
    });

    it('should not include fields without read access', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          required: true,
        },
        age: {
          type: 'Number',
          readAccess: 'none',
        },
      });
      const schema = User.getBaseSchema();
      expect(schema.toOpenApi().properties.age).toBeUndefined();
    });

    it('should not fail on fields with conditional read access', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          required: true,
        },
        age: {
          type: 'Number',
          readAccess: 'admin',
        },
      });
      const schema = User.getBaseSchema();
      expect(schema.toOpenApi().properties.age).toEqual({
        type: 'number',
      });
    });
  });
});

describe('getValidationSchema', () => {
  describe('alternate type forms', () => {
    it('should get a schema for a basic string field', async () => {
      const schema = getValidationSchema({
        name: 'String',
      });
      expect(yd.isSchema(schema)).toBe(true);
    });

    it('should get a schema for shorthand string field', async () => {
      const schema = getValidationSchema({
        name: 'String',
      });
      expect(yd.isSchema(schema)).toBe(true);
    });

    it('should get a schema for string type', async () => {
      const schema = getValidationSchema({
        name: 'String',
      });
      expect(yd.isSchema(schema)).toBe(true);
    });

    it('should get a schema for shorthand string type', async () => {
      const schema = getValidationSchema({
        name: 'String',
      });
      expect(yd.isSchema(schema)).toBe(true);
    });
  });

  describe('basic functionality', () => {
    it('should validate basic fields', async () => {
      const schema = getValidationSchema({
        name: {
          type: 'String',
          required: true,
        },
        count: 'Number',
      });
      await assertPass(schema, {
        name: 'foo',
      });
      await assertPass(schema, {
        name: 'foo',
        count: 10,
      });
      await assertFail(schema, {
        count: 10,
      });
      await assertFail(schema, {});
    });

    it('should strip unknown fields', async () => {
      const schema = getValidationSchema(
        {
          name: 'String',
        },
        {
          stripUnknown: true,
        },
      );
      await assertPass(schema, { id: 1, name: 'foo' }, { name: 'foo' });
      await assertPass(schema, { createdAt: 'date', name: 'foo' });
      await assertPass(schema, { updatedAt: 'date', name: 'foo' });
      await assertPass(schema, { deletedAt: 'date', name: 'foo' });
    });

    it('should override required fields', async () => {
      const schema = getValidationSchema(
        {
          name: {
            type: 'String',
            required: true,
          },
          count: {
            type: 'Number',
            required: true,
          },
        },
        {
          skipRequired: true,
        },
      );
      await assertPass(schema, { name: 'foo' });
      await assertPass(schema, { count: 5 });
      await assertPass(schema, {});
    });

    it('should not skip required inside nested arrays', async () => {
      const schema = getValidationSchema(
        {
          users: [
            {
              name: {
                type: 'String',
                required: true,
              },
              count: 'Number',
            },
          ],
        },
        {
          skipRequired: true,
        },
      );
      await assertPass(schema, {
        users: [
          {
            name: 'foo',
            count: 1,
          },
        ],
      });
      await assertPass(schema, {
        users: [
          {
            name: 'foo',
          },
        ],
      });
      await assertPass(schema, {
        users: [],
      });
      await assertFail(schema, {
        users: [
          {
            count: 1,
          },
        ],
      });
      await assertFail(schema, {
        users: [{}],
      });
    });
  });

  describe('global options', () => {
    it('should validate a required field', async () => {
      const schema = getValidationSchema({
        name: {
          type: 'String',
          required: true,
        },
      });
      await assertPass(schema, { name: 'foo' });
      await assertFail(schema, {});
    });
  });

  describe('string fields', () => {
    it('should validate an enum field', async () => {
      const schema = getValidationSchema({
        name: {
          type: 'String',
          enum: ['foo', 'bar'],
        },
      });
      await assertPass(schema, { name: 'foo' });
      await assertPass(schema, { name: 'bar' });
      await assertFail(schema, { name: 'baz' });
    });

    it('should allow an array on an enum field with allowSearch', async () => {
      const schema = getValidationSchema(
        {
          name: {
            type: 'String',
            enum: ['foo', 'bar'],
          },
        },
        {
          allowSearch: true,
        },
      );
      await assertPass(schema, { name: ['foo', 'bar'] });
    });

    it('should validate minimum length', async () => {
      const schema = getValidationSchema({
        name: {
          type: 'String',
          minLength: 3,
        },
      });
      await assertPass(schema, { name: 'foo' });
      await assertFail(schema, { name: 'fo' });
    });

    it('should validate maximum length', async () => {
      const schema = getValidationSchema({
        name: {
          type: 'String',
          maxLength: 3,
        },
      });
      await assertPass(schema, { name: 'foo' });
      await assertFail(schema, { name: 'fooo' });
    });

    it('should validate minimum and maximum length together', async () => {
      const schema = getValidationSchema({
        name: {
          type: 'String',
          minLength: 3,
          maxLength: 5,
        },
      });
      await assertPass(schema, { name: 'foo' });
      await assertPass(schema, { name: 'fooo' });
      await assertFail(schema, { name: 'foooooo' });
    });

    it('should validate a matched field', async () => {
      const schema = getValidationSchema({
        name: {
          type: 'String',
          match: /^foo$/,
        },
      });
      await assertPass(schema, { name: 'foo' });
      await assertFail(schema, { name: 'foo ' });
    });

    it('should convert string match field to regex', async () => {
      const schema = getValidationSchema({
        name: {
          type: 'String',
          match: '^foo$',
        },
      });
      await assertPass(schema, { name: 'foo' });
      await assertFail(schema, { name: 'bar' });
    });
  });

  describe('number fields', () => {
    it('should validate an enum field', async () => {
      const schema = getValidationSchema({
        count: {
          type: 'Number',
          enum: [100, 1000],
        },
      });
      await assertPass(schema, { count: 100 });
      await assertPass(schema, { count: 1000 });
      await assertFail(schema, { count: 1001 });
    });

    it('should validate a minimum value', async () => {
      const schema = getValidationSchema({
        count: {
          type: 'Number',
          min: 100,
        },
      });
      await assertPass(schema, { count: 100 });
      await assertFail(schema, { count: 99 });
    });

    it('should validate maximum value', async () => {
      const schema = getValidationSchema({
        count: {
          type: 'Number',
          max: 100,
        },
      });
      await assertPass(schema, { count: 100 });
      await assertFail(schema, { count: 101 });
    });

    it('should validate minimum and maximum together', async () => {
      const schema = getValidationSchema({
        count: {
          type: 'Number',
          min: 100,
          max: 200,
        },
      });
      await assertPass(schema, { count: 100 });
      await assertPass(schema, { count: 200 });
      await assertFail(schema, { count: 99 });
      await assertFail(schema, { count: 201 });
    });
  });

  describe('boolean fields', () => {
    it('should validate boolean field', async () => {
      const schema = getValidationSchema({
        isActive: 'Boolean',
      });
      await assertPass(schema, { isActive: true });
      await assertPass(schema, { isActive: false });
    });
  });

  describe('date fields', () => {
    it('should validate date ISO-8601 field', async () => {
      const schema = getValidationSchema({
        posted: 'Date',
      });
      await assertPass(schema, { posted: '2020-01-01T00:00:00Z' });
      await assertPass(schema, { posted: '2020-01-01T00:00:00' });
      await assertFail(schema, { posted: 'January 1, 2020' });
    });
  });

  describe('reference fields', () => {
    describe('simple', () => {
      it('should validate a string reference field', async () => {
        const schema = getValidationSchema({
          image: {
            type: 'ObjectId',
            ref: 'Upload',
          },
        });
        await assertPass(schema, { image: '5fd396fac80fa73203bd9554' });
        await assertFail(schema, { image: 'bad id' });
      });

      it('should transform an object with a valid id', async () => {
        const schema = getValidationSchema(
          {
            image: {
              type: 'ObjectId',
              ref: 'Upload',
            },
          },
          {
            allowExpandedRefs: true,
          },
        );
        await assertPass(schema, { image: '5fd396fac80fa73203bd9554' });
        await assertPass(schema, { image: { id: '5fd396fac80fa73203bd9554' } });
        await assertFail(schema, { image: { id: '5fd396fac80fa73203bd9xyz' } });
        await assertFail(schema, { image: { id: '5fd396fac80f' } });
        await assertFail(schema, { image: { id: 'bad id' } });
        await assertFail(schema, { image: { id: '' } });
      });

      it('should transform an array of objects or ids', async () => {
        const schema = getValidationSchema(
          {
            categories: [
              {
                type: 'ObjectId',
                ref: 'Upload',
              },
            ],
          },
          {
            allowExpandedRefs: true,
          },
        );
        await assertPass(schema, { categories: ['5fd396fac80fa73203bd9554'] });
        await assertPass(schema, {
          categories: [{ id: '5fd396fac80fa73203bd9554' }],
        });
        await assertPass(schema, {
          categories: [
            '5fd396fac80fa73203bd9554',
            { id: '5fd396fac80fa73203bd9554' },
            '5fd396fac80fa73203bd9554',
            { id: '5fd396fac80fa73203bd9554' },
            '5fd396fac80fa73203bd9554',
          ],
        });
        await assertFail(schema, {
          categories: [{ id: '5fd396fac80fa73203bd9554' }, 'bad id'],
        });
        await assertFail(schema, {
          categories: [{ id: '5fd396fac80fa73203bd9xyz' }],
        });
        await assertFail(schema, { categories: [{ id: '5fd396fac80f' }] });
        await assertFail(schema, { categories: [{ id: 'bad id' }] });
        await assertFail(schema, { categories: [{ id: '' }] });
      });
    });

    describe('nested', () => {
      it('should transform a deeply nested ObjectId', async () => {
        const schema = getValidationSchema(
          {
            user: {
              manager: {
                category: {
                  type: 'ObjectId',
                  ref: 'Upload',
                },
              },
            },
          },
          {
            allowExpandedRefs: true,
          },
        );
        await assertPass(schema, {
          user: {
            manager: {
              category: '5fd396fac80fa73203bd9554',
            },
          },
        });
        await assertPass(schema, {
          user: {
            manager: {
              category: {
                id: '5fd396fac80fa73203bd9554',
              },
            },
          },
        });
        await assertFail(schema, {
          user: {
            manager: {
              category: {
                id: {
                  id: '5fd396fac80fa73203bd9554',
                },
              },
            },
          },
        });
        await assertFail(schema, {
          user: {
            manager: {
              id: '5fd396fac80fa73203bd9554',
            },
          },
        });
        await assertFail(schema, {
          user: {
            id: '5fd396fac80fa73203bd9554',
          },
        });
        await assertFail(schema, {
          id: '5fd396fac80fa73203bd9554',
        });
        await assertPass(schema, {});
      });

      it('should transform a deeply nested array ObjectId', async () => {
        const schema = getValidationSchema(
          {
            users: [
              {
                managers: [
                  {
                    categories: [
                      {
                        type: 'ObjectId',
                        ref: 'Upload',
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            allowExpandedRefs: true,
          },
        );
        await assertPass(schema, {
          users: [
            {
              managers: [
                {
                  categories: ['5fd396fac80fa73203bd9554'],
                },
              ],
            },
          ],
        });
        await assertPass(schema, {
          users: [
            {
              managers: [
                {
                  categories: [
                    {
                      id: '5fd396fac80fa73203bd9554',
                    },
                  ],
                },
              ],
            },
          ],
        });
        await assertFail(schema, {
          users: [
            {
              manager: [
                {
                  categories: [
                    {
                      id: {
                        id: '5fd396fac80fa73203bd9554',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        });
        await assertFail(schema, {
          users: [
            {
              managers: [
                {
                  id: '5fd396fac80fa73203bd9554',
                },
              ],
            },
          ],
        });
        await assertFail(schema, {
          users: [
            {
              id: '5fd396fac80fa73203bd9554',
            },
          ],
        });
        await assertFail(schema, {
          id: '5fd396fac80fa73203bd9554',
        });
        await assertPass(schema, {});
      });
    });
  });

  describe('array fields', () => {
    it('should validate array of strings', async () => {
      const schema = getValidationSchema({
        categories: ['String'],
      });
      await assertPass(schema, { categories: ['foo'] });
      await assertPass(schema, { categories: [] });
      await assertFail(schema, { categories: 'foo' });
    });

    it('should validate array type shortcut syntax', async () => {
      const schema = getValidationSchema({
        categories: ['String'],
      });
      await assertPass(schema, { categories: ['foo'] });
      await assertPass(schema, { categories: [] });
      await assertFail(schema, { categories: 'foo' });
    });

    it('should validate array of object ids', async () => {
      const schema = getValidationSchema({
        categories: [
          {
            type: 'ObjectId',
          },
        ],
      });
      await assertPass(schema, { categories: ['5fd396fac80fa73203bd9554'] });
      await assertPass(schema, { categories: [] });
      await assertFail(schema, { categories: ['bad id'] });
    });

    it('should validate min/max elements in an array field', async () => {
      const schema = getValidationSchema({
        categories: {
          type: ['String'],
          minLength: 1,
          maxLength: 2,
        },
      });
      await assertFail(schema, { categories: [] });
      await assertPass(schema, { categories: ['foo'] });
      await assertPass(schema, { categories: ['foo', 'bar'] });
      await assertFail(schema, { categories: ['foo', 'bar', 'baz'] });
    });

    it('should validate nested object array', async () => {
      const schema = getValidationSchema({
        roles: [
          {
            role: {
              type: 'String',
              required: true,
            },
            scope: {
              type: 'String',
              required: true,
            },
            scopeRef: {
              type: 'ObjectId',
            },
          },
        ],
      });
      await assertPass(schema, {
        roles: [
          {
            role: 'role',
            scope: 'scope',
          },
        ],
      });
      await assertPass(schema, {
        roles: [
          {
            role: 'role1',
            scope: 'scope',
          },
          {
            role: 'role2',
            scope: 'scope',
          },
        ],
      });
      await assertPass(schema, {
        roles: [
          {
            role: 'role',
            scope: 'scope',
            scopeRef: '60096760d392ed3ba949265d',
          },
        ],
      });
      await assertFail(schema, {
        roles: [
          {
            role: 'role',
          },
        ],
      });
      await assertFail(schema, {
        roles: [
          {
            scope: 'scope',
          },
        ],
      });
    });

    it('should validate on array of strings', async () => {
      const schema = getValidationSchema({
        tags: ['String'],
      });
      await assertPass(schema, {
        tags: ['foo', 'bar'],
      });
      await assertFail(schema, {
        tags: 'foo',
      });
    });

    it('should allow a mixed type array field', async () => {
      const schema = getValidationSchema({
        categories: {
          type: 'Array',
        },
      });
      await assertPass(schema, { categories: ['foo'] });
      await assertPass(schema, { categories: [] });
      await assertFail(schema, { categories: 'foo' });
    });
  });

  describe('nested fields', () => {
    it('should validate nested field', async () => {
      const schema = getValidationSchema({
        counts: {
          view: 'Number',
        },
      });
      await assertPass(schema, { counts: { view: 1 } });
      await assertFail(schema, { counts: { view: 'bad number' } });
    });

    it('should not validate mixed type', async () => {
      const schema = getValidationSchema({
        counts: 'Mixed',
      });
      await assertPass(schema, { counts: { foo: 'bar' } });
      await assertPass(schema, { counts: { name: 'foo' } });
    });

    it('should not validate explicit mixed type', async () => {
      const schema = getValidationSchema({
        counts: {
          type: 'Mixed',
        },
      });
      await assertPass(schema, { counts: { foo: 'bar' } });
      await assertPass(schema, { counts: { name: 'foo' } });
    });

    it('should validate mixed with nested type object', async () => {
      const schema = getValidationSchema({
        type: {
          type: 'String',
          required: true,
        },
      });
      await assertPass(schema, {
        type: 'foo',
      });
      await assertFail(schema, {
        type: {
          type: 'foo',
        },
      });
      await assertFail(schema, {});
    });
  });

  describe('appendSchema', () => {
    it('should append plain objects as schemas', async () => {
      const schema = getValidationSchema(
        {
          type: {
            type: 'String',
            required: true,
          },
        },
        {
          appendSchema: {
            count: yd.number().required(),
          },
        },
      );
      await assertFail(schema, {
        type: 'foo',
      });
      await assertPass(schema, {
        type: 'foo',
        count: 10,
      });
    });

    it('should merge schemas', async () => {
      const schema = getValidationSchema(
        {
          type: {
            type: 'String',
            required: true,
          },
          count: {
            type: 'Number',
            required: true,
          },
        },
        {
          appendSchema: yd.object({
            count: yd.number(),
          }),
        },
      );
      await assertPass(schema, {
        type: 'foo',
      });
      await assertPass(schema, {
        type: 'foo',
        count: 10,
      });
    });
  });
});

describe('tuples', () => {
  it('should build correct validations for tuples', async () => {
    const User = createTestModel({
      address: {
        geometry: {
          type: {
            type: 'String',
            default: 'Point',
          },
          coordinates: ['Number', 'Number'],
        },
      },
    });

    await expect(User.create({})).resolves.not.toThrow();

    await expect(
      User.create({
        address: {
          geometry: {
            type: 'Point',
            coordinates: [35, 140],
          },
        },
      }),
    ).resolves.not.toThrow();

    await expect(
      User.create({
        address: {
          geometry: {
            type: 'Point',
            coordinates: [35],
          },
        },
      }),
    ).rejects.toThrow();

    const schema = User.getUpdateValidation();

    await assertPass(schema, {
      address: {
        geometry: {
          type: 'Point',
          coordinates: [35, 140],
        },
      },
    });

    await assertFail(schema, {
      address: {
        geometry: {
          type: 'Point',
          coordinates: [35],
        },
      },
    });
  });
});

describe('named validators', () => {
  describe('getNamedValidator', () => {
    it('should get an email validator', async () => {
      const emailValidator = getNamedValidator('email');
      await expect(emailValidator('foo@bar.com')).resolves.not.toThrow();
      await expect(emailValidator('bad@email')).rejects.toThrow();
    });
  });

  describe('other', () => {
    it('should have a zipcode validator', async () => {
      const User = createTestModel({
        zipcode: {
          type: 'String',
          validate: 'zipcode',
        },
      });
      const schema = User.getCreateValidation();
      await assertPass(schema, {
        zipcode: '80906',
      });

      await assertFailWithError(
        schema,
        {
          zipcode: '153-0062',
        },
        '"zipcode" must be a valid zipcode.',
      );
    });

    it('should have a postal code validator', async () => {
      const User = createTestModel({
        postalCode: {
          type: 'String',
          validate: 'postalCode',
        },
      });
      const schema = User.getCreateValidation();
      await assertPass(schema, {
        postalCode: '80906',
      });
      await assertPass(schema, {
        postalCode: '153-0062',
      });

      await assertFailWithError(
        schema,
        {
          postalCode: 'foo',
        },
        '"postalCode" must be a valid postal code.',
      );
    });
  });
});

describe('addValidators', () => {
  it('should add a custom schema validator', async () => {
    addValidators({
      dog: yd.allow('Golden Retriever', 'Australian Shepherd'),
    });
    const User = createTestModel({
      dog: {
        type: 'String',
        validate: 'dog',
      },
    });

    await expect(
      User.create({
        dog: 'Australian Shepherd',
      }),
    ).resolves.not.toThrow();

    await expect(
      User.create({
        dog: 'Husky',
      }),
    ).rejects.toThrow();

    const schema = User.getCreateValidation();
    await assertPass(schema, {
      dog: 'Australian Shepherd',
    });
    await assertFail(schema, {
      dog: 'Husky',
    });
  });
});
