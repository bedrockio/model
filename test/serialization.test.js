import { createTestModel } from '../src/testing';

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
            name: 'String',
            position: 'Number',
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
      expect(user.toObject()).toEqual({
        id: user.id,
        names: [
          {
            name: 'Foo',
            position: 2,
          },
        ],
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
                    name: 'String',
                    position: 'Number',
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
      expect(user.toObject()).toEqual({
        id: user.id,
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
    });

    it('should not expose fields with underscore', () => {
      const User = createTestModel({
        _private: 'String',
      });
      const user = new User();
      user._private = 'private';

      expect(user._private).toBe('private');
      const data = user.toObject();
      expect(data._private).toBeUndefined();
    });
  });

  describe('read scopes', () => {
    it('should deny all read access', () => {
      const User = createTestModel({
        password: {
          type: 'String',
          readScopes: 'none',
        },
      });
      const user = new User({
        password: 'fake password',
      });
      expect(user.password).toBe('fake password');
      expect(user.toObject().password).toBeUndefined();
    });

    it('should deny read access by scope', () => {
      const User = createTestModel({
        password: {
          type: 'String',
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
          type: 'String',
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
          type: 'String',
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
        name: 'String',
        earnings: {
          type: 'Number',
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
        name: 'String',
        likes: {
          type: 'Number',
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
          type: 'String',
          readScopes: ['admin'],
        },
      });
      const user = new User({
        password: 'fake password',
      });
      expect(user.password).toBe('fake password');
      expect(user.toObject({ scope: 'admin' }).password).toBe('fake password');
    });

    it('should allow read access to all', () => {
      const User = createTestModel({
        password: {
          type: 'String',
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
            type: 'String',
            readScopes: 'none',
          },
        ],
      });
      const user = new User({
        tags: ['one', 'two'],
      });

      expect(user.tags).toEqual(['one', 'two']);

      const data = user.toObject();
      expect(data.tags).toBeUndefined();
    });

    it('should not expose private array fields with real syntax', () => {
      const User = createTestModel({
        tags: {
          type: ['String'],
          readScopes: 'none',
        },
      });
      const user = new User({
        tags: ['one', 'two'],
      });

      expect(user.tags).toEqual(['one', 'two']);

      const data = user.toObject();
      expect(data.tags).toBeUndefined();
    });

    it('should not expose deeply nested private fields', () => {
      const User = createTestModel({
        one: {
          two: {
            three: {
              name: 'String',
              age: {
                type: 'Number',
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
                    name: 'String',
                    age: {
                      type: 'Number',
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

      expect(user.toObject()).toEqual({
        id: user.id,
        one: [
          {
            two: [
              {
                three: [
                  {
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
          type: 'String',
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
          type: 'String',
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
          type: 'String',
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
          type: 'Object',
          readScopes: ['admin'],
          attributes: {
            password: 'String',
            attempts: 'Number',
          },
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

    it('should deny access on nested objects', async () => {
      const User = createTestModel({
        terms: {
          readScopes: {
            type: 'String',
            default: 'none',
          },
          service: 'Boolean',
          privacy: 'Boolean',
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
              name: 'String',
              profits: {
                type: 'Number',
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

    it('should deny read access on extended array', () => {
      const User = createTestModel({
        tokens: {
          type: 'Array',
          readScopes: 'none',
          attributes: {
            name: 'String',
          },
        },
      });
      const user = new User({
        tokens: [
          {
            name: 'foo',
          },
        ],
      });
      expect(user.tokens).toMatchObject([
        {
          name: 'foo',
        },
      ]);
      expect(user.toObject().tokens).toBeUndefined();
    });

    it('should deny access to array field with explicit typedef', async () => {
      const User = createTestModel({
        tokens: {
          type: [
            {
              type: 'String',
              validate: 'email',
            },
          ],
          readScopes: 'none',
        },
      });
      const user = new User({
        tokens: ['token'],
      });
      expect(user.tokens).toEqual(['token']);
      expect(user.toObject().tokens).toBeUndefined();
    });
  });

  it('should not serialize nested array object ids', async () => {
    const User = createTestModel({
      foo: [
        {
          bar: [
            {
              name: 'String',
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
    expect(user.toObject()).toEqual({
      id: user.id,
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
  });

  it('should serialize id on nested field with type', async () => {
    const User = createTestModel({
      foo: {
        type: {
          type: 'String',
          required: true,
        },
        bar: [
          {
            name: 'String',
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
    expect(user.toObject()).toEqual({
      id: user.id,
      foo: {
        type: 'foo type',
        bar: [
          {
            name: 'name',
          },
        ],
      },
    });
  });
});
