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
            id: user.names[0].id,
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
            id: user.one[0].id,
            two: [
              {
                id: user.one[0].two[0].id,
                three: [
                  {
                    id: user.one[0].two[0].three[0].id,
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

  describe('read access', () => {
    it('should deny all read access', () => {
      const User = createTestModel({
        password: {
          type: 'String',
          readAccess: 'none',
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
          readAccess: ['admin'],
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
          readAccess: ['admin'],
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
          readAccess: 'self',
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
    });

    it('should allow owner read access', () => {
      let data;

      const User = createTestModel();
      const Shop = createTestModel({
        name: 'String',
        earnings: {
          type: 'Number',
          readAccess: 'owner',
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
    });

    it('should allow user read access', () => {
      let data;

      const User = createTestModel();
      const Account = createTestModel({
        name: 'String',
        likes: {
          type: 'Number',
          readAccess: 'user',
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
    });

    it('should not error if document cannot be checked', async () => {
      const User = createTestModel({
        name: 'String',
        age: {
          type: 'Number',
          readAccess: 'self',
        },
      });
      const user = new User({
        name: 'Bob',
        age: 30,
      });
      expect(user.toObject()).toEqual({
        id: user.id,
        name: 'Bob',
      });
    });

    it('should allow string shortcut for scopes', () => {
      const User = createTestModel({
        password: {
          type: 'String',
          readAccess: ['admin'],
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
          readAccess: 'all',
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
            readAccess: 'none',
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
          readAccess: 'none',
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
                readAccess: 'none',
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
                      readAccess: 'none',
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
          type: 'String',
          readAccess: 'none',
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
          readAccess: ['admin'],
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
          readAccess: ['admin'],
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
          readAccess: ['admin'],
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
          readAccess: {
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
        readAccess: 'none',
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
                readAccess: ['admin', 'self', 'foo'],
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

    it('should deny read access on simple array', () => {
      const User = createTestModel({
        tokens: [
          {
            type: 'String',
            readAccess: 'none',
          },
        ],
      });
      const user = new User({
        tokens: ['foo'],
      });
      expect(user.tokens).toMatchObject(['foo']);
      expect(user.toObject().tokens).toBeUndefined();
    });

    it('should deny read access on extended array', () => {
      const User = createTestModel({
        tokens: {
          type: 'Array',
          readAccess: 'none',
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
          readAccess: 'none',
        },
      });
      const user = new User({
        tokens: ['token'],
      });
      expect(user.tokens).toEqual(['token']);
      expect(user.toObject().tokens).toBeUndefined();
    });
  });

  describe('other', () => {
    it('should serialize nested array object ids', async () => {
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
            id: user.foo[0].id,
            bar: [
              {
                id: user.foo[0].bar[0].id,
                name: 'wut',
              },
            ],
          },
        ],
      });
    });

    it('should serialize nested array object ids with Array syntax', async () => {
      const User = createTestModel({
        foo: {
          type: 'Array',
          attributes: {
            bar: {
              type: 'Array',
              attributes: {
                name: 'String',
              },
            },
          },
        },
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
            id: user.foo[0].id,
            bar: [
              {
                id: user.foo[0].bar[0].id,
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
              id: user.foo.bar[0].id,
              name: 'name',
            },
          ],
        },
      });
    });
  });
});
