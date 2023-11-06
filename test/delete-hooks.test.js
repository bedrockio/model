import { getTestModelName, createTestModel } from '../src/testing';
import { createSchema } from '../src/schema';

describe('delete hooks', () => {
  describe('simple ref', () => {
    const userModelName = getTestModelName();
    const shopModelName = getTestModelName();

    const User = createTestModel(
      userModelName,
      createSchema({
        attributes: {
          name: 'String',
        },
        hooks: {
          delete: {
            [shopModelName]: 'owner',
          },
        },
      })
    );
    const Shop = createTestModel(shopModelName, {
      name: 'String',
      owner: {
        type: 'ObjectId',
        ref: userModelName,
      },
    });

    afterEach(async () => {
      await User.deleteMany({});
      await Shop.deleteMany({});
    });

    it('should delete hooked document', async () => {
      const user = await User.create({
        name: 'Barry',
      });
      await Shop.create({
        name: 'shop',
        owner: user,
      });
      await user.delete();

      const shops = await Shop.find();
      expect(shops).toEqual([]);
    });

    it('should delete multiple documents', async () => {
      const user = await User.create({
        name: 'Barry',
      });
      await Shop.create({
        name: 'shop1',
        owner: user,
      });
      await Shop.create({
        name: 'shop2',
        owner: user,
      });

      await user.delete();

      const shops = await Shop.find();

      expect(shops).toEqual([]);
    });

    it('should leave other documents untouched', async () => {
      const user1 = await User.create({
        name: 'Barry',
      });
      const user2 = await User.create({
        name: 'Larry',
      });

      await Shop.create({
        name: 'shop1',
        owner: user1,
      });
      await Shop.create({
        name: 'shop2',
        owner: user2,
      });

      await user1.delete();

      const shops = await Shop.find();

      expect(shops).toMatchObject([
        {
          name: 'shop2',
        },
      ]);
    });

    it('should not apply delete hooks when _id is tampered with', async () => {
      const user1 = await User.create({
        name: 'Barry',
      });
      const user2 = await User.create({
        name: 'Larry',
      });

      await Shop.create({
        name: 'shop1',
        owner: user1,
      });
      await Shop.create({
        name: 'shop2',
        owner: user2,
      });

      // Deleting _id shenanigans
      user1._id = null;

      await expect(async () => {
        await user1.delete();
      }).rejects.toThrow();

      expect(await Shop.countDocuments()).toBe(2);
    });
  });

  describe('nested field', () => {
    const userModelName = getTestModelName();
    const shopModelName = getTestModelName();

    const User = createTestModel(
      userModelName,
      createSchema({
        attributes: {
          name: 'String',
        },
        hooks: {
          delete: {
            [shopModelName]: 'info.owner',
          },
        },
      })
    );
    const Shop = createTestModel(shopModelName, {
      name: 'String',
      info: {
        owner: {
          type: 'ObjectId',
          ref: userModelName,
        },
      },
    });

    afterEach(async () => {
      await User.deleteMany({});
      await Shop.deleteMany({});
    });

    it('should delete hooked document for nested field', async () => {
      const user = await User.create({
        name: 'Barry',
      });
      await Shop.create({
        name: 'shop',
        info: {
          owner: user,
        },
      });

      let shops;

      shops = await Shop.find({
        'info.owner': user.id,
      });
      expect(shops.length).toBe(1);

      await user.delete();

      shops = await Shop.find({
        'info.owner': user.id,
      });
      expect(shops.length).toBe(0);
    });
  });

  describe('$and operator', () => {
    const userModelName = getTestModelName();
    const shopModelName = getTestModelName();

    const User = createTestModel(
      userModelName,
      createSchema({
        attributes: {
          name: 'String',
        },
        hooks: {
          delete: {
            [shopModelName]: {
              $and: ['owner', 'administrator'],
            },
          },
        },
      })
    );
    const Shop = createTestModel(shopModelName, {
      name: 'String',
      owner: {
        type: 'ObjectId',
        ref: userModelName,
      },
      administrator: {
        type: 'ObjectId',
        ref: userModelName,
      },
    });

    afterEach(async () => {
      await User.deleteMany({});
      await Shop.deleteMany({});
    });

    it('should only documents that are both owners and administrators', async () => {
      const user = await User.create({
        name: 'Barry',
      });
      await Shop.create({
        name: 'shop1',
        owner: user,
      });
      await Shop.create({
        name: 'shop2',
        administrator: user,
      });
      await Shop.create({
        name: 'shop3',
        owner: user,
        administrator: user,
      });

      await user.delete();

      const shops = await Shop.find().sort({ name: 1 });
      expect(shops).toMatchObject([
        {
          name: 'shop1',
        },
        {
          name: 'shop2',
        },
      ]);
    });
  });

  describe('$or operator', () => {
    const userModelName = getTestModelName();
    const shopModelName = getTestModelName();

    const User = createTestModel(
      userModelName,
      createSchema({
        attributes: {
          name: 'String',
        },
        hooks: {
          delete: {
            [shopModelName]: {
              $or: ['owner', 'administrator'],
            },
          },
        },
      })
    );
    const Shop = createTestModel(shopModelName, {
      name: 'String',
      owner: {
        type: 'ObjectId',
        ref: userModelName,
      },
      administrator: {
        type: 'ObjectId',
        ref: userModelName,
      },
    });

    afterEach(async () => {
      await User.deleteMany({});
      await Shop.deleteMany({});
    });

    it('should delete both documents with $or query', async () => {
      const user = await User.create({
        name: 'Barry',
      });
      await Shop.create({
        name: 'shop1',
        owner: user,
      });
      await Shop.create({
        name: 'shop2',
        administrator: user,
      });

      await user.delete();

      const shops = await Shop.find();
      expect(shops.length).toBe(0);
    });
  });

  describe('errors', () => {
    it('should error if both $and and $or are defined', async () => {
      expect(() => {
        createTestModel(
          createSchema({
            attributes: {
              name: 'String',
            },
            hooks: {
              delete: {
                Shop: {
                  $and: ['owner'],
                  $or: ['administrator'],
                },
              },
            },
          })
        );
      }).toThrow();
    });

    it('should not apply delete hooks when ref is misspelled', async () => {
      const userModelName = getTestModelName();
      const shopModelName = getTestModelName();
      const User = createTestModel(
        userModelName,
        createSchema({
          attributes: {
            name: 'String',
          },
          hooks: {
            delete: {
              [shopModelName]: 'ownerz',
            },
          },
        })
      );
      const Shop = createTestModel(shopModelName, {
        name: 'String',
        owner: {
          type: 'ObjectId',
          ref: userModelName,
        },
      });

      const user1 = await User.create({
        name: 'Barry',
      });
      const user2 = await User.create({
        name: 'Larry',
      });

      await Shop.create({
        name: 'shop1',
        owner: user1,
      });
      await Shop.create({
        name: 'shop2',
        owner: user2,
      });

      // Deleting _id shenanigans
      user1._id = null;

      await expect(async () => {
        await user1.delete();
      }).rejects.toThrow();

      expect(await Shop.countDocuments()).toBe(2);
    });
  });
});
