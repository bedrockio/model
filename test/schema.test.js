import mongoose from 'mongoose';

import { normalizeAttributes } from '../src/schema';
import { createTestModel } from '../src/testing';

const { Decimal128 } = mongoose.Types;

describe('normalizeAttributes', () => {
  it('should accept already normalized', async () => {
    const attributes = {
      name: {
        type: 'String',
      },
      age: {
        type: 'Number',
      },
      dob: {
        type: 'Date',
      },
    };
    expect(normalizeAttributes(attributes)).toEqual({
      name: {
        type: 'String',
        trim: true,
      },
      age: {
        type: 'Number',
      },
      dob: {
        type: 'Date',
      },
    });
  });

  it('should convert string shorthand', async () => {
    const attributes = {
      name: 'String',
      age: 'Number',
      dob: 'Date',
    };
    expect(normalizeAttributes(attributes)).toEqual({
      name: {
        type: 'String',
        trim: true,
      },
      age: {
        type: 'Number',
      },
      dob: {
        type: 'Date',
      },
    });
  });

  it('should convert nested object', async () => {
    const attributes = {
      profile: {
        firstName: 'String',
        lastName: 'String',
      },
    };
    expect(normalizeAttributes(attributes)).toEqual({
      profile: {
        firstName: {
          type: 'String',
          trim: true,
        },
        lastName: {
          type: 'String',
          trim: true,
        },
      },
    });
  });

  it('should convert string array', async () => {
    const attributes = {
      names: ['String'],
    };
    expect(normalizeAttributes(attributes)).toEqual({
      names: {
        type: [
          {
            type: 'String',
            trim: true,
          },
        ],
      },
    });
  });

  it('should convert object array', async () => {
    const attributes = {
      profiles: [
        {
          firstName: 'String',
          lastName: 'String',
        },
      ],
    };
    expect(normalizeAttributes(attributes)).toEqual({
      profiles: {
        type: [
          {
            firstName: {
              type: 'String',
              trim: true,
            },
            lastName: {
              type: 'String',
              trim: true,
            },
          },
        ],
      },
    });
  });

  it('should convert deeply nested attributes', async () => {
    const attributes = {
      a: [
        {
          b: {
            c: 'String',
          },
        },
      ],
    };
    expect(normalizeAttributes(attributes)).toEqual({
      a: {
        type: [
          {
            b: {
              c: {
                type: 'String',
                trim: true,
              },
            },
          },
        ],
      },
    });
  });

  it('should allow arrays of unstructured objects', async () => {
    const attributes = {
      tokens: ['Object'],
    };
    expect(normalizeAttributes(attributes)).toEqual({
      tokens: {
        type: [
          {
            type: 'Object',
          },
        ],
      },
    });
  });

  it('should convert tuples', async () => {
    const attributes = {
      location: ['Number', 'Number'],
    };
    expect(normalizeAttributes(attributes)).toEqual({
      location: {
        type: [
          {
            type: 'Number',
          },
          {
            type: 'Number',
          },
        ],
      },
    });
  });

  it('should allow empty arrays', async () => {
    const attributes = {
      tokens: [],
    };
    expect(normalizeAttributes(attributes)).toEqual({
      tokens: {
        type: [],
      },
    });
  });

  it('should allow Mixed type', async () => {
    const attributes = {
      any: 'Mixed',
    };
    expect(normalizeAttributes(attributes)).toEqual({
      any: {
        type: 'Mixed',
      },
    });
  });

  it('should error on unknown types', async () => {
    const attributes = {
      profile: {
        name: 'foo',
      },
    };
    expect(() => {
      normalizeAttributes(attributes);
    }).toThrow('Invalid type "foo" for "profile.name".');
  });

  it('should error on lowercase', async () => {
    const attributes = {
      profile: {
        name: 'string',
      },
    };
    expect(() => {
      normalizeAttributes(attributes);
    }).toThrow('Type "string" in "profile.name" should be "String".');
  });

  it('should error on ObjectId with no ref', async () => {
    const attributes = {
      user: {
        type: 'ObjectId',
      },
    };
    expect(() => {
      normalizeAttributes(attributes);
    }).toThrow('Ref must be passed for "user".');
  });

  it('should error on ref without ObjectId', async () => {
    const attributes = {
      user: {
        ref: 'User',
      },
    };
    expect(() => {
      normalizeAttributes(attributes);
    }).toThrow('Invalid type "User" for "user.ref"');
  });

  it('should error on native functions for type', async () => {
    const attributes = {
      name: String,
    };
    expect(() => {
      normalizeAttributes(attributes);
    }).toThrow('Native functions are not allowed as types.');
  });

  it('should set array fields with validator', async () => {
    const attributes = {
      names: [
        {
          type: 'String',
          validate: 'email',
        },
      ],
    };
    expect(normalizeAttributes(attributes)).toEqual({
      names: {
        type: [
          {
            type: 'String',
            validate: 'email',
            trim: true,
          },
        ],
      },
    });
  });

  it('should normalize a location schema', async () => {
    const attributes = {
      location: {
        type: {
          type: 'String',
          default: 'Point',
        },
        coordinates: {
          type: ['Number'],
          default: [],
        },
      },
    };
    expect(normalizeAttributes(attributes)).toEqual({
      location: {
        type: {
          type: 'String',
          default: 'Point',
          trim: true,
        },
        coordinates: {
          type: [
            {
              type: 'Number',
            },
          ],
          default: [],
        },
      },
    });
  });

  it('should work with literal type', async () => {
    const attributes = {
      profile: {
        type: {
          name: 'String',
        },
      },
    };
    expect(normalizeAttributes(attributes)).toEqual({
      profile: {
        type: {
          name: {
            type: 'String',
            trim: true,
          },
        },
      },
    });
  });

  it('should normalize extended object syntax', async () => {
    const attributes = {
      profile: {
        type: 'Object',
        attributes: {
          firstName: 'String',
          lastName: 'String',
        },
      },
    };
    expect(normalizeAttributes(attributes)).toEqual({
      profile: {
        type: 'Object',
        attributes: {
          firstName: {
            type: 'String',
            trim: true,
          },
          lastName: {
            type: 'String',
            trim: true,
          },
        },
      },
    });
  });

  it('should normalize extended array syntax', async () => {
    const attributes = {
      profiles: {
        type: 'Array',
        attributes: {
          firstName: 'String',
          lastName: 'String',
        },
      },
    };
    expect(normalizeAttributes(attributes)).toEqual({
      profiles: {
        type: 'Array',
        attributes: {
          firstName: {
            type: 'String',
            trim: true,
          },
          lastName: {
            type: 'String',
            trim: true,
          },
        },
      },
    });
  });

  it('should auto-detect literal "type" field', async () => {
    const attributes = {
      type: 'String',
      name: 'String',
    };
    expect(normalizeAttributes(attributes)).toEqual({
      type: {
        type: 'String',
        trim: true,
      },
      name: {
        type: 'String',
        trim: true,
      },
    });
  });
});

describe('createSchema', () => {
  describe('basic', () => {
    it('should create a basic schema', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          validate: /[a-z]/,
        },
      });
      const user = new User({ name: 'foo' });
      expect(user.name).toBe('foo');
      await expect(async () => {
        user.name = 'FOO';
        await user.save();
      }).rejects.toThrow();
    });

    it('should convert a string match to a regexp', async () => {
      const User = createTestModel({
        color: {
          type: 'String',
          match: '/^#[0-9a-f]{6}$/i',
        },
      });
      const user = await User.create({
        color: '#ffffff',
      });

      await expect(async () => {
        user.color = 'foo';
        await user.save();
      }).rejects.toThrow();
    });

    it('should allow Mixed type', async () => {
      const User = createTestModel({
        any: 'Mixed',
      });

      let user = new User();

      user.any = 1;
      await user.save();
      user = await User.findById(user.id);
      expect(user.any).toBe(1);

      user.any = 'foo';
      await user.save();
      user = await User.findById(user.id);
      expect(user.any).toBe('foo');

      user.any = {
        key: 'foo',
      };
      await user.save();
      user = await User.findById(user.id);
      expect(user.any).toEqual({
        key: 'foo',
      });
    });

    it('should error when type is unknown', async () => {
      expect(() => {
        createTestModel({
          image: {
            type: 'Object',
            ref: 'Upload',
          },
        });
      }).toThrow();
    });

    it('should not error when ObjectId has a refPath', async () => {
      const User = createTestModel({
        image: {
          type: 'ObjectId',
          refPath: 'fakePath',
        },
      });
      expect(User.schema.obj.image.type).toBe('ObjectId');
    });

    it('should not error when a literal ref field is defined', async () => {
      const User = createTestModel({
        name: 'String',
        ref: 'String',
      });
      expect(User.schema.obj.ref).toEqual({
        type: 'String',
        trim: true,
      });
    });
  });

  describe('special', () => {
    it('should handle Decimal128', async () => {
      const Product = createTestModel({
        price: 'Decimal128',
      });
      const product = new Product({
        price: '29.99',
      });

      expect(product.price).toEqual(Decimal128.fromString('29.99'));
    });

    it('should handle BigInt', async () => {
      const Product = createTestModel({
        views: 'BigInt',
      });
      const product = new Product({
        views: 10,
      });

      expect(product.views).toEqual(10n);
    });

    it('should handle Buffer', async () => {
      const Product = createTestModel({
        data: 'Buffer',
      });

      const product = new Product({
        data: 'data',
      });

      expect(Buffer.isBuffer(product.data)).toBe(true);
      expect(product.data.toString()).toEqual('data');
    });
  });

  describe('extensions', () => {
    it('should flag a unique field as soft', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      expect(User.schema.obj.email).toEqual({
        type: 'String',
        trim: true,
        softUnique: true,
      });
    });

    it('should enforce soft unique on model', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          required: true,
          unique: true,
        },
        content: {
          type: 'String',
          required: true,
        },
      });

      await User.create({
        email: 'foo@bar.com',
        content: 'foo',
      });

      await expect(async () => {
        await User.create({
          email: 'foo@bar.com',
        });
      }).rejects.toThrow();
    });
  });

  describe('strings', () => {
    it('should always trim strings by default', async () => {
      const User = createTestModel({
        name: 'String',
      });
      const user = new User({ name: 'foo     ' });
      expect(user.name).toBe('foo');
    });

    it('should trim strings inside arrays', async () => {
      const User = createTestModel({
        names: ['String'],
      });
      const user = new User({ names: ['foo     '] });
      expect(user.names).toEqual(['foo']);
    });

    it('should trim strings inside array objects', async () => {
      const User = createTestModel({
        name: {
          first: 'String',
        },
      });
      const user = new User({ name: { first: 'foo   ' } });
      expect(user.name.first).toBe('foo');
    });

    it('should optionally allow preventing trim', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          trim: false,
        },
      });
      const user = new User({ name: 'foo   ' });
      expect(user.name).toBe('foo   ');
    });
  });

  describe('arrays', () => {
    it('should create a schema with an array field', async () => {
      const User = createTestModel({
        names: [
          {
            type: 'String',
            validate: /[a-z]/,
          },
        ],
      });
      const user = new User({ names: ['foo'] });

      expect(Array.from(user.names)).toEqual(['foo']);

      await expect(async () => {
        user.names = ['FOO'];
        await user.save();
      }).rejects.toThrow();
    });

    it('should allow string syntax', async () => {
      const User = createTestModel({
        names: ['String'],
      });
      const user = new User({ names: ['foo'] });
      expect(Array.from(user.names)).toEqual(['foo']);
    });

    it('should allow a specified default', async () => {
      const User = createTestModel({
        names: {
          type: ['String'],
          default: undefined,
        },
      });
      const user = new User();
      expect(user.names).toBeUndefined();
    });

    describe('extensions', () => {
      it('should allow extended array syntax', async () => {
        const User = createTestModel({
          names: {
            type: 'Array',
            attributes: {
              firstName: 'String',
              lastName: 'String',
            },
            default: [
              {
                firstName: 'John',
                lastName: 'Doe',
              },
            ],
          },
        });

        const user = await User.create({});
        expect(user.names).toMatchObject([
          {
            firstName: 'John',
            lastName: 'Doe',
          },
        ]);

        await expect(
          User.create({
            names: ['John Doe'],
          }),
        ).rejects.toThrow();
      });

      it('should allow nested extended array syntax', async () => {
        const User = createTestModel({
          tokens: {
            type: 'Array',
            attributes: {
              id: {
                type: 'String',
                required: true,
              },
              name: {
                type: 'String',
                required: true,
              },
            },
          },
        });

        await expect(
          User.create({
            tokens: [
              {
                id: 'foo',
              },
            ],
          }),
        ).rejects.toThrow();

        await expect(
          User.create({
            tokens: [
              {
                id: 'foo',
                name: 'bar',
              },
            ],
          }),
        ).resolves.not.toThrow();
      });

      it('should allow double nested extended syntax', async () => {
        const User = createTestModel({
          auth: {
            type: 'Object',
            attributes: {
              tokens: {
                type: 'Array',
                attributes: {
                  id: {
                    type: 'String',
                    required: true,
                  },
                  name: {
                    type: 'String',
                    required: true,
                  },
                },
              },
            },
          },
        });

        await expect(
          User.create({
            auth: {
              tokens: [
                {
                  id: 'foo',
                },
              ],
            },
          }),
        ).rejects.toThrow();

        await expect(
          User.create({
            auth: {
              tokens: [
                {
                  id: 'foo',
                  name: 'bar',
                },
              ],
            },
          }),
        ).resolves.not.toThrow();
      });

      it('should allow mixed nested syntax', async () => {
        const User = createTestModel({
          auth: {
            type: 'Object',
            attributes: {
              tokens: [
                {
                  types: {
                    type: 'Array',
                    attributes: {
                      name: 'String',
                    },
                  },
                },
              ],
            },
          },
        });

        const user = await User.create({
          auth: {
            tokens: [
              {
                types: [
                  {
                    name: 'test',
                  },
                ],
              },
            ],
          },
        });

        const data = user.toObject();
        expect(data.auth.tokens[0].types[0]).toEqual({
          id: user.auth.tokens[0].types[0].id,
          name: 'test',
        });
      });

      it('should validate array min/max length', async () => {
        const User = createTestModel({
          names: {
            type: ['String'],
            minLength: 1,
            maxLength: 2,
          },
        });

        await expect(
          User.create({
            names: [],
          }),
        ).rejects.toThrow('Must have at least 1 element.');

        await expect(
          User.create({
            names: ['foo'],
          }),
        ).resolves.not.toThrow();

        await expect(
          User.create({
            names: ['foo', 'bar'],
          }),
        ).resolves.not.toThrow();

        await expect(
          User.create({
            names: ['foo', 'bar', 'baz'],
          }),
        ).rejects.toThrow('Cannot have more than 2 elements.');
      });

      it('should validate tuple types', async () => {
        const User = createTestModel({
          location: ['Number', 'Number'],
        });

        await expect(
          User.create({
            location: [],
          }),
        ).resolves.not.toThrow();

        await expect(
          User.create({
            location: [35],
          }),
        ).rejects.toThrow();

        await expect(
          User.create({
            location: [35, 139],
          }),
        ).resolves.not.toThrow();

        await expect(
          User.create({
            location: [35, 139, 13],
          }),
        ).rejects.toThrow();

        await expect(
          User.create({
            location: [35, '139'],
          }),
        ).rejects.toThrow();
      });

      it('should validate tuples inside a scope', async () => {
        const User = createTestModel({
          $private: {
            type: 'Scope',
            readAccess: 'none',
            writeAccess: 'none',
            attributes: {
              coordinates: ['Number', 'Number'],
            },
          },
        });

        await expect(
          User.create({
            coordinates: [],
          }),
        ).resolves.not.toThrow();

        await expect(
          User.create({
            coordinates: [35],
          }),
        ).rejects.toThrow();

        await expect(
          User.create({
            coordinates: [35, 139],
          }),
        ).resolves.not.toThrow();

        await expect(
          User.create({
            coordinates: [35, 139, 13],
          }),
        ).rejects.toThrow();

        await expect(
          User.create({
            coordinates: [35, '139'],
          }),
        ).rejects.toThrow();
      });
    });

    it('should hoist read/write scopes in array field as a special case', async () => {
      const User = createTestModel({
        tokens: [
          {
            type: 'String',
            readAccess: 'none',
            writeAccess: 'none',
          },
        ],
      });
      expect(User.schema.obj).toMatchObject({
        tokens: {
          type: [
            {
              type: 'String',
            },
          ],
          readAccess: 'none',
          writeAccess: 'none',
        },
      });
    });

    it('should allow array of refs to have a minLength', async () => {
      const Category = createTestModel({
        name: 'String',
      });
      const Product = createTestModel({
        categories: {
          type: [
            {
              type: 'ObjectId',
              ref: 'Category',
            },
          ],
          minLength: 2,
        },
      });
      const category1 = await Category.create({
        name: 'foo',
      });
      const category2 = await Category.create({
        name: 'bar',
      });

      await expect(async () => {
        await Product.create({
          categories: [category1.id],
        });
      }).rejects.toThrow();

      const product = await Product.create({
        categories: [category1.id, category2.id],
      });

      expect(product.categories[0]._id).toEqual(category1._id);
      expect(product.categories[1]._id).toEqual(category2._id);
    });

    it('should be able to disable array _id field with shorthand', async () => {
      const Product = createTestModel({
        categories: [
          {
            name: 'String',
            _id: false,
          },
        ],
      });
      const product = await Product.create({
        categories: [
          {
            name: 'foo',
          },
          {
            name: 'bar',
          },
        ],
      });

      expect(product.toObject().categories).toEqual([
        {
          name: 'foo',
        },
        {
          name: 'bar',
        },
      ]);
    });
  });

  describe('objects', () => {
    it('should create a schema for a nested field', async () => {
      const User = createTestModel({
        profile: {
          name: {
            type: 'String',
            validate: /[a-z]/,
          },
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

    it('should accept a schema for a nested field', async () => {
      const Profile = createTestModel({
        name: {
          type: 'String',
          validate: /[a-z]/,
        },
      });
      const User = createTestModel({
        profile: Profile.schema,
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

    it('should not fail on a literal type field', async () => {
      const User = createTestModel({
        location: {
          type: {
            type: 'String',
            default: 'Point',
          },
          coordinates: ['Number'],
        },
      });
      const user = await User.create({});
      expect(user.toObject()).toMatchObject({
        location: {
          type: 'Point',
        },
      });
    });

    describe('extensions', () => {
      it('should allow required objects', async () => {
        const User = createTestModel({
          profile: {
            type: 'Object',
            required: true,
            attributes: {
              firstName: 'String',
              lastName: 'String',
            },
          },
        });

        await expect(
          User.create({
            profile: {
              firstName: 'John',
              lastName: 'Doe',
            },
          }),
        ).resolves.not.toThrow();

        await expect(User.create({})).rejects.toThrow();
      });

      it('should set a default on an object type', async () => {
        const User = createTestModel({
          profile: {
            type: 'Object',
            required: true,
            default: {
              firstName: 'John',
              lastName: 'Doe',
            },
            attributes: {
              firstName: 'String',
              lastName: 'String',
            },
          },
        });

        const user = await User.create({});
        expect(user.profile.firstName).toBe('John');
        expect(user.profile.lastName).toBe('Doe');
      });

      it('should work with nested extension', async () => {
        const User = createTestModel({
          account: {
            profile: {
              type: 'Object',
              required: true,
              attributes: {
                firstName: 'String',
                lastName: 'String',
              },
            },
          },
        });
        await expect(
          User.create({
            account: {
              profile: {
                firstName: 'John',
                lastName: 'Doe',
              },
            },
          }),
        ).resolves.not.toThrow();

        await expect(
          User.create({
            account: {},
          }),
        ).rejects.toThrow();
      });

      it('should work with extension in array', async () => {
        const User = createTestModel({
          accounts: [
            {
              profile: {
                type: 'Object',
                required: true,
                attributes: {
                  firstName: 'String',
                  lastName: 'String',
                },
              },
            },
          ],
        });
        await expect(
          User.create({
            accounts: [
              {
                profile: {
                  firstName: 'John',
                  lastName: 'Doe',
                },
              },
            ],
          }),
        ).resolves.not.toThrow();

        await expect(
          User.create({
            accounts: [{}],
          }),
        ).rejects.toThrow();
      });

      it('should allow a way to disambigate a typedef from fields', async () => {
        const User = createTestModel({
          location: {
            type: 'Object',
            attributes: {
              type: {
                type: 'String',
              },
            },
            default: {
              type: 'Point',
            },
          },
        });

        const user = await User.create({});
        expect(user.toObject()).toMatchObject({
          location: {
            type: 'Point',
          },
        });
      });

      it('should apply scope attributes to all properties', async () => {
        const User = createTestModel({
          private: {
            type: 'Scope',
            readAccess: 'none',
            writeAccess: 'none',
            attributes: {
              firstName: 'String',
              lastName: 'String',
            },
          },
        });

        expect(User.schema.obj).toMatchObject({
          firstName: {
            type: 'String',
            readAccess: 'none',
            writeAccess: 'none',
          },
          lastName: {
            type: 'String',
            readAccess: 'none',
            writeAccess: 'none',
          },
        });
      });

      it('should apply a scope to a nested field', async () => {
        const User = createTestModel({
          private: {
            type: 'Scope',
            writeAccess: 'none',
            attributes: {
              profile: {
                name: 'String',
              },
            },
          },
        });

        const user = await User.create({
          profile: {
            name: 'foo',
            foo: 'bar',
          },
        });
        expect(user.profile.name).toBe('foo');
        expect(user.profile.foo).toBeUndefined();
      });

      it('should correctly reflect a nested path with a scope', async () => {
        const User = createTestModel({
          private: {
            type: 'Scope',
            attributes: {
              profile: {
                name: {
                  type: 'String',
                },
              },
            },
          },
        });
        const schema = User.schema.path('profile.name');
        expect(schema instanceof mongoose.SchemaTypes.String).toBe(true);
      });

      it('should support scopes with mixed path types', async () => {
        const User = createTestModel({
          $private: {
            type: 'Scope',
            readAccess: ['admin'],
            attributes: {
              name: {
                type: 'String',
              },
              profile: {
                age: 'Number',
              },
            },
          },
        });

        const user = await User.create({
          name: 'foo',
          profile: {
            age: 42,
          },
        });

        expect(user.name).toBe('foo');
        expect(user.profile).toEqual({
          age: 42,
          _id: user.profile._id,
        });

        expect(user.toObject()).toEqual({
          id: user.id,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        });
      });
    });
  });

  describe('dates', () => {
    it('should be able to set default now', async () => {
      const User = createTestModel({
        name: 'String',
        lastAccessedAt: {
          type: 'Date',
          default: 'now',
        },
      });
      const user = await User.create({
        name: 'foo',
      });

      expect(user.lastAccessedAt.getTime()).toBeCloseTo(Date.now(), -20);
    });

    it('should be able to set default now in array', async () => {
      const User = createTestModel({
        tokens: [
          {
            name: 'String',
            lastAccessedAt: {
              type: 'Date',
              default: 'now',
            },
          },
        ],
      });
      const user = await User.create({
        tokens: [
          {
            name: 'foo',
          },
        ],
      });

      expect(user.tokens[0].lastAccessedAt.getTime()).toBeCloseTo(
        Date.now(),
        -20,
      );
    });

    it('should be able to set default now in extended array', async () => {
      const User = createTestModel({
        tokens: {
          type: 'Array',
          attributes: {
            name: 'String',
            lastAccessedAt: {
              type: 'Date',
              default: 'now',
            },
          },
        },
      });
      const user = await User.create({
        tokens: [
          {
            name: 'foo',
          },
        ],
      });

      expect(user.tokens[0].lastAccessedAt.getTime()).toBeCloseTo(
        Date.now(),
        -20,
      );
    });

    it('should be able to set default now in object', async () => {
      const User = createTestModel({
        token: {
          name: 'String',
          lastAccessedAt: {
            type: 'Date',
            default: 'now',
          },
        },
      });
      const user = await User.create({
        token: {
          name: 'foo',
        },
      });

      expect(user.token.lastAccessedAt.getTime()).toBeCloseTo(Date.now(), -20);
    });

    it('should be able to set default now in extended object', async () => {
      const User = createTestModel({
        token: {
          type: 'Object',
          attributes: {
            name: 'String',
            lastAccessedAt: {
              type: 'Date',
              default: 'now',
            },
          },
        },
      });
      const user = await User.create({
        token: {
          name: 'foo',
        },
      });

      expect(user.token.lastAccessedAt.getTime()).toBeCloseTo(Date.now(), -20);
    });

    it('should allow default now to be mocked', async () => {
      const User = createTestModel({
        date: {
          type: 'Date',
          default: 'now',
        },
      });
      const NativeDate = Date;
      function MockDate(...args) {
        return new NativeDate(...args);
      }
      MockDate.now = () => {
        return 0;
      };
      global.Date = MockDate;

      const user = await User.create({});
      expect(user.date.getTime()).toBe(0);

      global.Date = NativeDate;
    });
  });

  describe('locations', () => {
    it('should handle a GeoJSON schema', async () => {
      const User = createTestModel({
        geometry: {
          type: {
            type: 'String',
            default: 'Point',
          },
          coordinates: ['Number', 'Number'],
        },
      });

      let user;

      user = await User.create({});
      expect(user.geometry.toObject()).toEqual({
        type: 'Point',
        coordinates: [],
      });

      user = await User.create({
        geometry: {
          coordinates: [],
        },
      });
      expect(user.geometry.toObject()).toEqual({
        type: 'Point',
        coordinates: [],
      });

      user = await User.create({
        geometry: {
          coordinates: [-105.0732721, 39.7417583],
        },
      });
      expect(user.geometry.toObject()).toEqual({
        type: 'Point',
        coordinates: [-105.0732721, 39.7417583],
      });

      await expect(() => {
        return User.create({
          geometry: {
            coordinates: [-105.0732721],
          },
        });
      }).rejects.toThrow('geometry.coordinates: Validation failed.');

      await expect(() => {
        return User.create({
          geometry: {
            coordinates: [-105.0732721, 39.7417583, 15],
          },
        });
      }).rejects.toThrow('geometry.coordinates: Validation failed.');
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

  describe('mongoose validation shortcuts', () => {
    it('should validate an email field', async () => {
      let user;
      const User = createTestModel({
        email: {
          type: 'String',
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
          type: 'String',
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
      const User = createTestModel({
        emails: [
          {
            type: 'String',
            validate: 'email',
          },
        ],
      });

      await expect(
        User.create({
          emails: ['good@email.com'],
        }),
      ).resolves.not.toThrow();

      await expect(
        User.create({
          emails: ['bad@email'],
        }),
      ).rejects.toThrow();
    });

    it('should validate an E.164 phone field', async () => {
      let user;
      const User = createTestModel({
        phone: {
          type: 'String',
          validate: 'phone',
        },
      });

      await expect(async () => {
        user = new User();
        await user.validate();
      }).not.toThrow();

      await expect(async () => {
        user = new User({
          phone: 'bad',
        });
        await user.validate();
      }).rejects.toThrow(mongoose.Error.ValidationError);

      await expect(async () => {
        user = new User({
          phone: '+15551234567',
        });
        await user.validate();
      }).not.toThrow();

      await expect(async () => {
        user = new User({
          phone: '+818080103122',
        });
        await user.validate();
      }).not.toThrow();
    });

    it('should validate a US phone number', async () => {
      let user;
      const User = createTestModel({
        phone: {
          type: 'String',
          validate: 'phone:US',
        },
      });

      await expect(async () => {
        user = new User();
        await user.validate();
      }).not.toThrow();

      await expect(async () => {
        user = new User({
          phone: 'bad',
        });
        await user.validate();
      }).rejects.toThrow(mongoose.Error.ValidationError);

      await expect(async () => {
        user = new User({
          phone: '+15552234567',
        });
        await user.validate();
      }).not.toThrow();

      await expect(async () => {
        user = new User({
          phone: '+818080103122',
        });
        await user.validate();
      }).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('should validate a NANP phone number', async () => {
      let user;
      const User = createTestModel({
        phone: {
          type: 'String',
          validate: 'phone:NANP',
        },
      });

      await expect(async () => {
        user = new User();
        await user.validate();
      }).not.toThrow();

      await expect(async () => {
        user = new User({
          phone: 'bad',
        });
        await user.validate();
      }).rejects.toThrow(mongoose.Error.ValidationError);

      await expect(async () => {
        user = new User({
          phone: '+15552234567',
        });
        await user.validate();
      }).not.toThrow();

      await expect(async () => {
        user = new User({
          phone: '+818080103122',
        });
        await user.validate();
      }).rejects.toThrow(mongoose.Error.ValidationError);
    });
  });
});
