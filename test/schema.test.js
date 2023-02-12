import mongoose from 'mongoose';

import { createTestModel } from '../src/testing';
import { normalizeAttributes } from '../src/schema';

describe('normalizeAttributes', () => {
  it('should accept a correctly formatted definition', async () => {
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
      },
      age: {
        type: 'Number',
      },
      dob: {
        type: 'Date',
      },
    });
  });

  it('should convert strings to type definitions', async () => {
    const attributes = {
      name: 'String',
      age: 'Number',
      dob: 'Date',
    };
    expect(normalizeAttributes(attributes)).toEqual({
      name: {
        type: 'String',
      },
      age: {
        type: 'Number',
      },
      dob: {
        type: 'Date',
      },
    });
  });

  it('should convert objects to type definitions', async () => {
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
        },
        lastName: {
          type: 'String',
        },
      },
    });
  });

  it('should convert array of strings to type definitions', async () => {
    const attributes = {
      names: ['String'],
    };
    expect(normalizeAttributes(attributes)).toEqual({
      names: {
        type: [
          {
            type: 'String',
          },
        ],
      },
    });
  });

  it('should convert array of objects to type definitions', async () => {
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
            },
            lastName: {
              type: 'String',
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
        type: 'Tuple',
        types: [
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

  it('should allow empty arrays as mixed types', async () => {
    const attributes = {
      tokens: [],
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

  it('should error on Mixed type', async () => {
    const attributes = {
      name: 'Mixed',
    };
    expect(() => {
      normalizeAttributes(attributes);
    }).toThrow('Type "Mixed" is not allowed. Use "Object" instead.');
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

  it('should error on ref but not ObjectId', async () => {
    const attributes = {
      user: {
        ref: 'User',
      },
    };
    expect(() => {
      normalizeAttributes(attributes);
    }).toThrow('Ref field "user" must be type "ObjectId".');
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

    it('should error when type is Mixed', async () => {
      expect(() => {
        createTestModel({
          object: 'Mixed',
        });
      }).toThrow('Type "Mixed" is not allowed. Use "Object" instead.');
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
      });
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
          })
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
          })
        ).rejects.toThrow();

        await expect(
          User.create({
            tokens: [
              {
                id: 'foo',
                name: 'bar',
              },
            ],
          })
        ).resolves.not.toThrow();
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
          })
        ).rejects.toThrow('Must have at least 1 element.');

        await expect(
          User.create({
            names: ['foo'],
          })
        ).resolves.not.toThrow();

        await expect(
          User.create({
            names: ['foo', 'bar'],
          })
        ).resolves.not.toThrow();

        await expect(
          User.create({
            names: ['foo', 'bar', 'baz'],
          })
        ).rejects.toThrow('Cannot have more than 2 elements.');
      });

      it('should validate tuple types', async () => {
        const User = createTestModel({
          location: ['Number', 'Number'],
        });

        await expect(
          User.create({
            location: [],
          })
        ).rejects.toThrow();

        await expect(
          User.create({
            location: [35],
          })
        ).rejects.toThrow();

        await expect(
          User.create({
            location: [35, 139],
          })
        ).resolves.not.toThrow();

        await expect(
          User.create({
            location: [35, 139, 13],
          })
        ).rejects.toThrow();

        await expect(
          User.create({
            location: [35, '139'],
          })
        ).rejects.toThrow();
      });
    });

    it('should hoist read/write scopes in array field as a special case', async () => {
      const User = createTestModel({
        tokens: [
          {
            type: 'String',
            readScopes: 'none',
            writeScopes: 'none',
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
          readScopes: 'none',
          writeScopes: 'none',
        },
      });
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
          })
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
          })
        ).resolves.not.toThrow();

        await expect(
          User.create({
            account: {},
          })
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
          })
        ).resolves.not.toThrow();

        await expect(
          User.create({
            accounts: [{}],
          })
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

      it('should apply a scope attributes to all properties', async () => {
        const User = createTestModel({
          private: {
            type: 'Scope',
            readScopes: 'none',
            writeScopes: 'none',
            attributes: {
              firstName: 'String',
              lastName: 'String',
            },
          },
        });

        expect(User.schema.obj).toMatchObject({
          firstName: {
            type: 'String',
            readScopes: 'none',
            writeScopes: 'none',
          },
          lastName: {
            type: 'String',
            readScopes: 'none',
            writeScopes: 'none',
          },
        });
      });
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
        })
      ).resolves.not.toThrow();

      await expect(
        User.create({
          emails: ['bad@email'],
        })
      ).rejects.toThrow();
    });
  });
});
