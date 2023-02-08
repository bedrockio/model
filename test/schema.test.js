import mongoose from 'mongoose';

import { createTestModel, createSchemaFromAttributes } from '../src/testing';

describe('createSchema', () => {
  describe('basic functionality', () => {
    it('should create a basic schema', async () => {
      const User = createTestModel({
        name: { type: String, validate: /[a-z]/ },
      });
      const user = new User({ name: 'foo' });
      expect(user.name).toBe('foo');
      await expect(async () => {
        user.name = 'FOO';
        await user.save();
      }).rejects.toThrow();
    });

    it('should create a schema with an array field', async () => {
      const User = createTestModel({
        names: [{ type: String, validate: /[a-z]/ }],
      });
      const user = new User({ names: ['foo'] });

      expect(Array.from(user.names)).toEqual(['foo']);

      await expect(async () => {
        user.names = ['FOO'];
        await user.save();
      }).rejects.toThrow();
    });

    it('should allow alternate array function syntax', async () => {
      const User = createTestModel({
        names: {
          type: Array,
          default: [],
        },
      });
      const user = new User({ names: ['foo'] });
      expect(Array.from(user.names)).toEqual(['foo']);
    });

    it('should allow alternate array string syntax', async () => {
      const User = createTestModel({
        names: {
          type: 'Array',
          default: [],
        },
      });
      const user = new User({ names: ['foo'] });
      expect(Array.from(user.names)).toEqual(['foo']);
    });

    it('should create a schema with a nested field', async () => {
      const User = createTestModel({
        profile: {
          name: { type: String, validate: /[a-z]/ },
        },
      });
      const user = new User({
        profile: {
          name: 'foo',
        },
      });

      expect(user.profile.name).toBe('foo');

      await expect(async () => {
        user.profile.name = 'FOO';
        await user.save();
      }).rejects.toThrow();
    });

    it('should accept a schema for a subfield', async () => {
      const User = createTestModel({
        profile: createSchemaFromAttributes({
          name: { type: String, validate: /[a-z]/ },
        }),
      });
      const user = new User({
        profile: {
          name: 'foo',
        },
      });

      expect(user.profile.name).toBe('foo');

      await expect(async () => {
        user.profile.name = 'FOO';
        await user.save();
      }).rejects.toThrow();
    });

    it('should convert a string match to a regexp', async () => {
      const User = createTestModel({
        color: { type: String, match: '^#[0-9a-f]{6}$' },
      });
      const user = await User.create({
        color: '#ffffff',
      });

      await expect(async () => {
        user.color = 'foo';
        await user.save();
      }).rejects.toThrow();
    });

    it('should convert native functions to mongoose', async () => {
      const schema = createSchemaFromAttributes({
        name: String,
      });
      expect(schema.obj.name).toBe(mongoose.Schema.Types.String);
    });

    it('should error when type is unknown', async () => {
      expect(() => {
        createSchemaFromAttributes({
          image: {
            type: 'Object',
            ref: 'Upload',
          },
        });
      }).toThrow();
    });

    it('should not error when ObjectId has a refPath', async () => {
      const schema = createSchemaFromAttributes({
        image: {
          type: 'ObjectId',
          refPath: 'fakePath',
        },
      });
      expect(schema.obj.image.type).toBe(mongoose.Schema.Types.ObjectId);
    });

    it('should not error when a ref field is defined', async () => {
      const schema = createSchemaFromAttributes({
        name: 'String',
        ref: 'String',
      });
      expect(schema.obj.ref).toBe(mongoose.Schema.Types.String);
    });
  });

  describe('defaults', () => {
    it('should add timestamps by default', async () => {
      const User = createTestModel();
      const user = new User();
      await user.save();
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should add deletedAt by default', async () => {
      const User = createTestModel();
      const user = new User();
      await user.save();
      await user.delete();
      expect(user.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('serialization', () => {
    describe('reserved fields', () => {
      it('should expose id', () => {
        const User = createTestModel();
        const user = new User();
        const data = user.toObject();
        expect(data.id).toBe(user.id);
      });

      it('should not expose _id or __v', () => {
        const User = createTestModel();
        const user = new User();
        const data = user.toObject();
        expect(data._id).toBeUndefined();
        expect(data.__v).toBeUndefined();
      });

      it('should not expose _id in nested array objects of mixed type', () => {
        const User = createTestModel({
          names: [
            {
              name: String,
              position: Number,
            },
          ],
        });
        const user = new User({
          names: [
            {
              name: 'Foo',
              position: 2,
            },
          ],
        });
        const data = JSON.parse(JSON.stringify(user));
        expect(data.names[0]).toEqual({
          name: 'Foo',
          position: 2,
          id: user.names[0].id,
        });
      });

      it('should not expose _id in deeply nested array objects of mixed type', () => {
        const User = createTestModel({
          one: [
            {
              two: [
                {
                  three: [
                    {
                      name: String,
                      position: Number,
                    },
                  ],
                },
              ],
            },
          ],
        });
        const user = new User({
          one: [
            {
              two: [
                {
                  three: [
                    {
                      name: 'Foo',
                      position: 2,
                    },
                  ],
                },
              ],
            },
          ],
        });
        const data = JSON.parse(JSON.stringify(user));
        expect(data).toEqual({
          id: user.id,
          one: [
            {
              id: user.one[0].id,
              two: [
                {
                  id: user.one[0].two[0].id,
                  three: [
                    {
                      name: 'Foo',
                      position: 2,
                      id: user.one[0].two[0].three[0].id,
                    },
                  ],
                },
              ],
            },
          ],
        });
      });

      it('should not expose fields with underscore', () => {
        const User = createTestModel({
          _private: String,
        });
        const user = new User();
        user._private = 'private';

        expect(user._private).toBe('private');
        const data = user.toObject();
        expect(data._private).toBeUndefined();
      });
    });

    describe('read scopes', () => {
      it('should disallow all read access', () => {
        const User = createTestModel({
          password: {
            type: String,
            readScopes: 'none',
          },
        });
        const user = new User({
          password: 'fake password',
        });
        expect(user.password).toBe('fake password');
        expect(user.toObject().password).toBeUndefined();
      });

      it('should disallow read access by scope', () => {
        const User = createTestModel({
          password: {
            type: String,
            readScopes: ['admin'],
          },
        });
        const user = new User({
          password: 'fake password',
        });
        expect(user.password).toBe('fake password');
        expect(user.toObject().password).toBeUndefined();
      });

      it('should allow read access by scope', () => {
        const User = createTestModel({
          password: {
            type: String,
            readScopes: ['admin'],
          },
        });
        const user = new User({
          password: 'fake password',
        });
        expect(user.password).toBe('fake password');
        expect(user.toObject({ scopes: ['admin'] }).password).toBe(
          'fake password'
        );
      });

      it('should enforce self read access', () => {
        let data;

        const User = createTestModel({
          password: {
            type: String,
            readScopes: 'self',
          },
        });
        const user1 = new User({
          password: 'fake password',
        });

        data = user1.toObject({
          authUser: user1,
        });
        expect(data.password).toBe('fake password');

        const user2 = new User();
        data = user1.toObject({
          authUser: user2,
        });
        expect(data.password).toBeUndefined();

        expect(() => {
          user1.toObject();
        }).toThrow('Read scope "self" requires .toObject({ authUser }).');
      });

      it('should allow owner read access', () => {
        let data;

        const User = createTestModel();
        const Shop = createTestModel({
          name: String,
          earnings: {
            type: Number,
            readScopes: 'owner',
          },
          owner: {
            type: 'ObjectId',
            ref: User.modelName,
          },
        });
        const user1 = new User();
        const shop = new Shop({
          earnings: 5000,
          owner: user1,
        });

        data = shop.toObject({
          authUser: user1,
        });
        expect(data.earnings).toBe(5000);

        const user2 = new User();
        data = shop.toObject({
          authUser: user2,
        });
        expect(data.earnings).toBeUndefined();

        expect(() => {
          shop.toObject();
        }).toThrow('Read scope "owner" requires .toObject({ authUser }).');
      });

      it('should allow user read access', () => {
        let data;

        const User = createTestModel();
        const Account = createTestModel({
          name: String,
          likes: {
            type: Number,
            readScopes: 'user',
          },
          user: {
            type: 'ObjectId',
            ref: User.modelName,
          },
        });
        const user1 = new User();
        const account = new Account({
          likes: 5000,
          user: user1,
        });

        data = account.toObject({
          authUser: user1,
        });
        expect(data.likes).toBe(5000);

        const user2 = new User();
        data = account.toObject({
          authUser: user2,
        });
        expect(data.likes).toBeUndefined();

        expect(() => {
          account.toObject();
        }).toThrow('Read scope "user" requires .toObject({ authUser }).');
      });

      it('should allow string shortcut for scopes', () => {
        const User = createTestModel({
          password: {
            type: String,
            readScopes: ['admin'],
          },
        });
        const user = new User({
          password: 'fake password',
        });
        expect(user.password).toBe('fake password');
        expect(user.toObject({ scope: 'admin' }).password).toBe(
          'fake password'
        );
      });

      it('should allow read access to all', () => {
        const User = createTestModel({
          password: {
            type: String,
            readScopes: 'all',
          },
        });
        const user = new User({
          password: 'fake password',
        });
        expect(user.password).toBe('fake password');
        expect(user.toObject().password).toBe('fake password');
      });

      it('should not expose private array fields', () => {
        const User = createTestModel({
          tags: [
            {
              type: String,
              readScopes: 'none',
            },
          ],
        });
        const user = new User();
        user.tags = ['one', 'two'];

        expect(user.tags).toBeInstanceOf(Array);

        const data = user.toObject();
        expect(data.tags).toBeUndefined();
      });

      it('should not expose deeply nested private fields', () => {
        const User = createTestModel({
          one: {
            two: {
              three: {
                name: {
                  type: String,
                },
                age: {
                  type: Number,
                  readScopes: 'none',
                },
              },
            },
          },
        });
        const user = new User({
          one: {
            two: {
              three: {
                name: 'Harry',
                age: 21,
              },
            },
          },
        });

        const data = user.toObject();
        expect(data).toEqual({
          id: user.id,
          one: {
            two: {
              three: {
                name: 'Harry',
              },
            },
          },
        });
      });

      it('should not expose private fields deeply nested in arrays', () => {
        const User = createTestModel({
          one: [
            {
              two: [
                {
                  three: [
                    {
                      name: {
                        type: String,
                      },
                      age: {
                        type: Number,
                        readScopes: 'none',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        });
        const user = new User({
          one: [
            {
              two: [
                {
                  three: [
                    {
                      name: 'Harry',
                      age: 21,
                    },
                  ],
                },
              ],
            },
          ],
        });

        const data = JSON.parse(JSON.stringify(user));
        expect(data).toEqual({
          id: user.id,
          one: [
            {
              id: user.one[0].id,
              two: [
                {
                  id: user.one[0].two[0].id,
                  three: [
                    {
                      id: user.one[0].two[0].three[0].id,
                      name: 'Harry',
                    },
                  ],
                },
              ],
            },
          ],
        });
      });

      it('should serialize identically with toObject', () => {
        const User = createTestModel({
          secret: {
            type: String,
            readScopes: 'none',
          },
        });
        const user = new User({
          secret: 'foo',
        });
        const data = user.toObject();
        expect(data.id).toBe(user.id);
        expect(data._id).toBeUndefined();
        expect(data.__v).toBeUndefined();
        expect(data.secret).toBeUndefined();
      });

      it('should allow access to private fields with options on toJSON', () => {
        const User = createTestModel({
          secret: {
            type: String,
            readScopes: ['admin'],
          },
        });
        const user = new User({
          secret: 'foo',
        });
        const data = user.toJSON({
          scopes: ['admin'],
        });
        expect(data.id).toBe(user.id);
        expect(data._id).toBeUndefined();
        expect(data.__v).toBeUndefined();
        expect(data.secret).toBe('foo');
      });

      it('should allow access to private fields with options on toObject', () => {
        const User = createTestModel({
          secret: {
            type: String,
            readScopes: ['admin'],
          },
        });
        const user = new User({
          secret: 'foo',
        });
        const data = user.toObject({
          scopes: ['admin'],
        });
        expect(data.id).toBe(user.id);
        expect(data._id).toBeUndefined();
        expect(data.__v).toBeUndefined();
        expect(data.secret).toBe('foo');
      });

      it('should mark access on nested objects', async () => {
        const User = createTestModel({
          login: {
            password: String,
            attempts: Number,
            readScopes: ['admin'],
          },
        });
        const user = new User({
          login: {
            password: 'password',
            attempts: 10,
          },
        });
        expect(user.login.password).toBe('password');
        expect(user.login.attempts).toBe(10);
        expect(user.toObject().login).toBeUndefined();
      });

      it('should disallow access on nested objects', async () => {
        const User = createTestModel({
          terms: {
            readScopes: { type: String, default: 'none' },
            service: Boolean,
            privacy: Boolean,
          },
        });
        const user = new User({
          terms: {
            service: true,
            privacy: true,
          },
        });
        expect(user.terms).toEqual({
          service: true,
          privacy: true,
          readScopes: 'none',
        });
        expect(user.toObject().terms).toBeUndefined();
      });

      it('should enforce complex access', async () => {
        let data;
        const User = createTestModel({
          profile: {
            accounts: [
              {
                name: String,
                profits: {
                  type: Number,
                  readScopes: ['admin', 'self', 'foo'],
                },
              },
            ],
          },
        });
        const user = new User({
          profile: {
            accounts: [
              {
                name: 'Account 1',
                profits: 5000,
              },
              {
                name: 'Account 2',
                profits: 20,
              },
            ],
          },
        });

        data = user.toObject({
          authUser: user,
        });
        expect(data).toMatchObject({
          profile: {
            accounts: [
              {
                name: 'Account 1',
                profits: 5000,
              },
              {
                name: 'Account 2',
                profits: 20,
              },
            ],
          },
        });

        data = user.toObject({
          scope: 'admin',
          authUser: user,
        });
        expect(data).toMatchObject({
          profile: {
            accounts: [
              {
                name: 'Account 1',
                profits: 5000,
              },
              {
                name: 'Account 2',
                profits: 20,
              },
            ],
          },
        });

        data = user.toObject({
          scope: 'foo',
          authUser: user,
        });
        expect(data).toMatchObject({
          profile: {
            accounts: [
              {
                name: 'Account 1',
                profits: 5000,
              },
              {
                name: 'Account 2',
                profits: 20,
              },
            ],
          },
        });

        data = user.toObject({
          scope: 'bar',
          authUser: user,
        });
        expect(data).toMatchObject({
          profile: {
            accounts: [
              {
                name: 'Account 1',
              },
              {
                name: 'Account 2',
              },
            ],
          },
        });
      });
    });

    it('should serialize nested array object ids', async () => {
      const User = createTestModel({
        foo: [
          {
            bar: [
              {
                name: String,
              },
            ],
          },
        ],
      });
      const user = new User({
        foo: [
          {
            bar: [
              {
                name: 'wut',
              },
            ],
          },
        ],
      });
      const data = JSON.parse(JSON.stringify(user));
      expect(data.foo[0].bar[0].id).not.toBeUndefined();
    });

    it('should serialize id on nested field with type', async () => {
      const User = createTestModel({
        foo: {
          type: {
            type: String,
            required: true,
          },
          bar: [
            {
              name: String,
            },
          ],
        },
      });
      const user = new User({
        foo: {
          type: 'foo type',
          bar: [
            {
              name: 'name',
            },
          ],
        },
      });
      const data = JSON.parse(JSON.stringify(user));
      expect(data.foo.bar[0].id).not.toBeUndefined();
    });
  });

  describe('mongoose validation shortcuts', () => {
    it('should validate an email field', async () => {
      let user;
      const User = createTestModel({
        email: {
          type: String,
          validate: 'email',
        },
      });

      await expect(async () => {
        user = new User();
        await user.validate();
      }).not.toThrow();

      await expect(async () => {
        user = new User({
          email: 'good@email.com',
        });
        await user.validate();
      }).not.toThrow();

      await expect(async () => {
        // Note that null is expected to error here as it
        // will fail the type validation. To allow "null"
        // to be a JSON readable signal to unset a field
        // in mongoose it must be converted to "undefined".
        // This is part of why the "assign" method exists.
        user = new User({
          email: null,
        });
        await user.validate();
      }).rejects.toThrow(mongoose.Error.ValidationError);

      await expect(async () => {
        user = new User({
          email: 'bad@email',
        });
        await user.validate();
      }).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('should validate a required email field', async () => {
      let user;
      const User = createTestModel({
        email: {
          type: String,
          required: true,
          validate: 'email',
        },
      });

      await expect(async () => {
        user = new User({
          email: 'good@email.com',
        });
        await user.validate();
      }).not.toThrow();

      await expect(async () => {
        user = new User({
          email: 'bad@email',
        });
        await user.validate();
      }).rejects.toThrow();

      await expect(async () => {
        user = new User({
          email: '',
        });
        await user.validate();
      }).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('should validate a nested email field', async () => {
      let user;
      const User = createTestModel({
        emails: [
          {
            type: String,
            validate: 'email',
          },
        ],
      });

      await expect(async () => {
        user = new User({
          emails: ['good@email.com'],
        });
        await user.validate();
      }).not.toThrow();

      await expect(async () => {
        user = new User({
          emails: ['bad@email'],
        });
        await user.validate();
      }).rejects.toThrow(mongoose.Error.ValidationError);
    });
  });
});
