import yd from '@bedrockio/yada';

import {
  getValidationSchema,
  getNamedValidator,
  addValidators,
} from '../src/validation';
import { createSchemaFromAttributes, createTestModel } from '../src/testing';

async function assertPass(schema, obj, expected) {
  try {
    const result = await schema.validate(obj);
    if (expected) {
      expect(result).toEqual(expected);
    } else {
      expect(true).toBe(true);
    }
  } catch (error) {
    // eslint-disable-next-line
    console.error(error);
    throw error;
  }
}

async function assertFail(schema, obj) {
  try {
    await schema.validate(obj);
    throw new Error('Expected failure but passed.');
  } catch (error) {
    if (!error.details) {
      throw error;
    }
    expect(error).not.toBeUndefined();
  }
}

describe('validation', () => {
  async function assertPass(schema, obj, options) {
    await expect(schema.validate(obj, options)).resolves.not.toThrow();
  }

  async function assertFail(schema, obj, options) {
    await expect(schema.validate(obj, options)).rejects.toThrow();
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

    it('should append schemas', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          required: true,
        },
      });
      const schema = User.getCreateValidation({
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

    it('should handle geolocation schema', async () => {
      const User = createTestModel({
        geoLocation: {
          type: {
            type: 'String',
            default: 'Point',
          },
          coordinates: {
            type: 'Array',
            default: [],
          },
        },
      });
      const user = await User.create({
        geoLocation: {
          coordinates: [35, 95],
        },
      });
      expect(user.toObject()).toEqual({
        id: user.id,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        geoLocation: {
          type: 'Point',
          coordinates: [35, 95],
        },
      });
      const schema = User.getCreateValidation();
      await assertPass(schema, {
        geoLocation: {
          type: 'Line',
          coordinates: [35, 95],
        },
      });
      await assertFail(schema, {
        geoLocation: 'Line',
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

    it('should allow a flag to skip required', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          required: true,
        },
        age: {
          type: 'Number',
          required: true,
          skipValidation: true,
        },
      });
      const schema = User.getCreateValidation();
      expect(yd.isSchema(schema)).toBe(true);
      await assertPass(schema, {
        name: 'foo',
      });
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
      const userSchema = createSchemaFromAttributes({
        firstName: {
          type: 'String',
          required: true,
        },
        lastName: {
          type: 'String',
          required: true,
        },
      });
      userSchema.virtual('fullName').get(function () {
        return `${this.firstName} ${this.lastName}`;
      });
      const User = createTestModel(userSchema);
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
      const profileSchema = createSchemaFromAttributes({
        firstName: {
          type: 'String',
          required: true,
        },
        lastName: {
          type: 'String',
          required: true,
        },
      });
      profileSchema.virtual('fullName').get(function () {
        return `${this.firstName} ${this.lastName}`;
      });
      const User = createTestModel({
        profile: profileSchema,
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

    describe('write scopes', () => {
      it('should disallow all access', async () => {
        const User = createTestModel({
          name: 'String',
          password: {
            type: 'String',
            writeScopes: 'none',
          },
        });
        const schema = User.getUpdateValidation();
        await assertPass(schema, {
          name: 'Barry',
        });
        await assertFail(schema, {
          name: 'Barry',
          password: 'fake password',
        });
      });

      it('should disallow access on an array field', async () => {
        const User = createTestModel({
          name: 'String',
          tokens: [
            {
              type: 'String',
              writeScopes: 'none',
            },
          ],
        });
        const schema = User.getUpdateValidation();
        await assertPass(schema, {
          name: 'Barry',
        });
        await assertFail(schema, {
          name: 'Barry',
          tokens: ['fake token'],
        });
      });

      it('should disallow access on a deep field', async () => {
        const User = createTestModel({
          name: 'String',
          a: {
            b: {
              c: {
                type: 'String',
                writeScopes: 'none',
              },
            },
          },
        });
        const schema = User.getUpdateValidation();
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

      it('should strip write scope validation fields', async () => {
        const User = createTestModel({
          name: 'String',
          password: {
            type: 'String',
            writeScopes: 'none',
            skipValidation: true,
          },
        });
        const schema = User.getUpdateValidation();
        await assertPass(schema, {
          name: 'Barry',
        });

        const value = await schema.validate({
          name: 'Barry',
          password: 'fake password',
        });
        expect(value.name).toBe('Barry');
        expect(value.password).toBeUndefined();
      });

      it('should disallow access by scope', async () => {
        const User = createTestModel({
          name: 'String',
          password: {
            type: 'String',
            writeScopes: ['private'],
          },
        });
        const schema = User.getUpdateValidation();
        await assertPass(schema, {
          name: 'Barry',
        });
        await assertFail(schema, {
          name: 'Barry',
          password: 'fake password',
        });
        await assertPass(
          schema,
          {
            name: 'Barry',
            password: 'fake password',
          },
          { scopes: ['private'] }
        );
      });

      it('should require only one of valid scopes', async () => {
        const User = createTestModel({
          foo: {
            type: 'String',
            writeScopes: ['foo'],
          },
          bar: {
            type: 'String',
            writeScopes: ['bar'],
          },
          foobar: {
            type: 'String',
            writeScopes: ['foo', 'bar'],
          },
        });
        const schema = User.getUpdateValidation();

        // With ['foo'] scopes
        await assertPass(
          schema,
          {
            foo: 'foo!',
          },
          { scopes: ['foo'] }
        );
        await assertFail(
          schema,
          {
            bar: 'bar!',
          },
          { scopes: ['foo'] }
        );
        await assertPass(
          schema,
          {
            foobar: 'foobar!',
          },
          { scopes: ['foo'] }
        );
        await assertPass(
          schema,
          {
            foo: 'foo!',
            foobar: 'foobar!',
          },
          { scopes: ['foo'] }
        );
        await assertFail(
          schema,
          {
            foo: 'foo!',
            bar: 'bar!',
            foobar: 'foobar!',
          },
          { scopes: ['foo'] }
        );

        // With ['bar'] scopes
        await assertFail(
          schema,
          {
            foo: 'foo!',
          },
          { scopes: ['bar'] }
        );
        await assertPass(
          schema,
          {
            bar: 'bar!',
          },
          { scopes: ['bar'] }
        );
        await assertPass(
          schema,
          {
            foobar: 'foobar!',
          },
          { scopes: ['bar'] }
        );
        await assertFail(
          schema,
          {
            foo: 'foo!',
            foobar: 'foobar!',
          },
          { scopes: ['bar'] }
        );
        await assertFail(
          schema,
          {
            foo: 'foo!',
            bar: 'bar!',
            foobar: 'foobar!',
          },
          { scopes: ['bar'] }
        );

        // With ['foo', 'bar'] scopes
        await assertPass(
          schema,
          {
            foo: 'foo!',
          },
          { scopes: ['foo', 'bar'] }
        );
        await assertPass(
          schema,
          {
            bar: 'bar!',
          },
          { scopes: ['foo', 'bar'] }
        );
        await assertPass(
          schema,
          {
            foobar: 'foobar!',
          },
          { scopes: ['foo', 'bar'] }
        );
        await assertPass(
          schema,
          {
            foo: 'foo!',
            foobar: 'foobar!',
          },
          { scopes: ['foo', 'bar'] }
        );
        await assertPass(
          schema,
          {
            foo: 'foo!',
            bar: 'bar!',
            foobar: 'foobar!',
          },
          { scopes: ['foo', 'bar'] }
        );
      });
    });

    it('should strip validation with skip flag', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          required: true,
        },
        age: {
          type: 'Number',
          required: true,
          skipValidation: true,
          default: 10,
        },
      });
      const schema = User.getUpdateValidation();
      expect(yd.isSchema(schema)).toBe(true);
      await assertPass(schema, {
        name: 'foo',
        age: 25,
      });
      const value = await schema.validate({
        name: 'foo',
        age: 25,
      });
      expect(value.age).toBeUndefined();
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
        // TODO: validate better?
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
      });
      const schema = User.getSearchValidation();
      expect(yd.isSchema(schema)).toBe(true);
      await assertPass(schema, {
        age: { gte: 5 },
      });
      await assertPass(schema, {
        date: { gte: '2020-01-01' },
      });
      await assertPass(schema, {});
    });

    it('should allow search on a nested field', async () => {
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
        }
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
        }
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
        }
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
        users: [{}],
      });
    });

    it('should transform fields', async () => {
      const schema = getValidationSchema(
        {
          name: {
            type: 'String',
            required: true,
          },
        },
        {
          transformField: (key, field) => {
            if (key === 'name') {
              return {
                ...field,
                minLength: 5,
              };
            }
          },
        }
      );
      await assertFail(schema, { name: 'foo' });
      await assertPass(schema, { name: 'fooooo' });
    });

    it('should disallow fields with custom transform', async () => {
      const schema = getValidationSchema(
        {
          name: {
            type: 'String',
            required: true,
          },
          password: {
            type: 'String',
            private: true,
          },
        },
        {
          transformField: (key, field) => {
            if (!field.private) {
              return field;
            }
          },
        }
      );
      await assertPass(schema, { name: 'foo' });
      await assertFail(schema, { name: 'foo', password: 'bar' });
    });

    it('should be able return a schema in transform', async () => {
      const schema = getValidationSchema(
        {
          name: {
            type: 'String',
            required: true,
          },
        },
        {
          transformField: () => {
            return yd.string().min(5);
          },
        }
      );
      await assertFail(schema, { name: 'foo' });
      await assertPass(schema, { name: 'foooo' });
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

    it('should optionally allow an array on an enum field', async () => {
      const schema = getValidationSchema(
        {
          name: {
            type: 'String',
            enum: ['foo', 'bar'],
          },
        },
        {
          allowMultiple: true,
        }
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
        const schema = getValidationSchema({
          image: {
            type: 'ObjectId',
            ref: 'Upload',
          },
        });
        await assertPass(schema, { image: '5fd396fac80fa73203bd9554' });
        await assertPass(schema, { image: { id: '5fd396fac80fa73203bd9554' } });
        await assertFail(schema, { image: { id: '5fd396fac80fa73203bd9xyz' } });
        await assertFail(schema, { image: { id: '5fd396fac80f' } });
        await assertFail(schema, { image: { id: 'bad id' } });
        await assertFail(schema, { image: { id: '' } });
      });

      it('should transform an array of objects or ids', async () => {
        const schema = getValidationSchema({
          categories: [
            {
              type: 'ObjectId',
              ref: 'Upload',
            },
          ],
        });
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
        const schema = getValidationSchema({
          user: {
            manager: {
              category: {
                type: 'ObjectId',
                ref: 'Upload',
              },
            },
          },
        });
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
        const schema = getValidationSchema({
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
        });
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

    it('should validate minimum number of elements for required array field', async () => {
      const schema = getValidationSchema({
        categories: [
          {
            type: 'String',
            required: true,
          },
        ],
      });
      await assertPass(schema, { categories: ['foo'] });
      await assertFail(schema, { categories: [] });
      await assertFail(schema, { categories: 'foo' });
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

    it('should allow explit array string type', async () => {
      const schema = getValidationSchema({
        tags: 'Array',
      });
      await assertPass(schema, {
        tags: ['foo', 'bar'],
      });
      await assertFail(schema, {
        tags: 'foo',
      });
    });

    it('should allow explit array function type', async () => {
      const schema = getValidationSchema({
        tags: 'Array',
      });
      await assertPass(schema, {
        tags: ['foo', 'bar'],
      });
      await assertFail(schema, {
        tags: 'foo',
      });
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
        }
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
        }
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

  describe('ranges', () => {
    it('should append a date range schema', async () => {
      const schema = getValidationSchema(
        {
          startsAt: 'Date',
        },
        {
          allowRanges: true,
        }
      );
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

    it('should append a number range schema', async () => {
      const schema = getValidationSchema(
        {
          age: 'Number',
        },
        {
          allowRanges: true,
        }
      );
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
  });
});

describe('getNamedValidator', () => {
  it('should get an email validator', async () => {
    const emailValidator = getNamedValidator('email');
    await expect(emailValidator('foo@bar.com')).resolves.not.toThrow();
    await expect(emailValidator('bad@email')).rejects.toThrow();
  });
});

describe('addValidators', () => {
  it('should be able to add a custom schema validator', async () => {
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
      })
    ).resolves.not.toThrow();

    await expect(
      User.create({
        dog: 'Husky',
      })
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
