import mongoose from 'mongoose';

import { createSchema } from '../src/schema';
import { createTestModel } from '../src/testing';

describe('cached fields', () => {
  it('should cache a foreign document field', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = createSchema({
      attributes: {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      },
      cache: {
        userName: {
          type: 'String',
          path: 'user.name',
        },
      },
    });
    const Shop = createTestModel(schema);

    const user = await User.create({
      name: 'Frank',
    });

    const shop = await Shop.create({
      user,
    });

    expect(shop.userName).toBe('Frank');
  });

  it('should update cache when local field changed', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = createSchema({
      attributes: {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      },
      cache: {
        userName: {
          type: 'String',
          path: 'user.name',
        },
      },
    });
    const Shop = createTestModel(schema);

    const user1 = await User.create({
      name: 'Frank',
    });

    const user2 = await User.create({
      name: 'Dennis',
    });

    const shop = await Shop.create({
      user: user1,
    });

    expect(shop.userName).toBe('Frank');

    shop.user = user2;
    await shop.save();
    expect(shop.userName).toBe('Dennis');
  });

  it('should cache multiple fields on the same document', async () => {
    const User = createTestModel({
      firstName: 'String',
      lastName: 'String',
    });
    const schema = createSchema({
      attributes: {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      },
      cache: {
        userFirstName: {
          type: 'String',
          path: 'user.firstName',
        },
        userLastName: {
          type: 'String',
          path: 'user.lastName',
        },
      },
    });
    const Shop = createTestModel(schema);

    const user = await User.create({
      firstName: 'Frank',
      lastName: 'Reynolds',
    });

    const shop = await Shop.create({
      user,
    });

    expect(shop.userFirstName).toBe('Frank');
    expect(shop.userLastName).toBe('Reynolds');
  });

  it('should cache a deep field', async () => {
    const User = createTestModel({
      name: 'String',
    });

    const Shop = createTestModel({
      user: {
        type: 'ObjectId',
        ref: User.modelName,
      },
    });

    const schema = createSchema({
      attributes: {
        shop: {
          type: 'ObjectId',
          ref: Shop.modelName,
        },
      },
      cache: {
        shopUserName: {
          type: 'String',
          path: 'shop.user.name',
        },
      },
    });

    const Product = createTestModel(schema);

    const user = await User.create({
      name: 'Frank Reynolds',
    });

    const shop = await Shop.create({
      user: user.id,
    });

    const product = await Product.create({
      shop,
    });

    expect(product.shopUserName).toBe('Frank Reynolds');
  });

  it('should cache a final array field', async () => {
    const User = createTestModel({
      names: ['String'],
    });
    const schema = createSchema({
      attributes: {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      },
      cache: {
        userNames: {
          type: ['String'],
          path: 'user.names',
        },
      },
    });
    const Shop = createTestModel(schema);

    const user = await User.create({
      names: ['Frank', 'Reynolds'],
    });

    const shop = await Shop.create({
      user,
    });

    expect(shop.userNames).toEqual(['Frank', 'Reynolds']);
  });

  it('should cache a ref array field', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = createSchema({
      attributes: {
        users: [
          {
            type: 'ObjectId',
            ref: User.modelName,
          },
        ],
      },
      cache: {
        userNames: {
          type: ['String'],
          path: 'users.name',
        },
      },
    });
    const Shop = createTestModel(schema);

    const user1 = await User.create({
      name: 'Frank',
    });

    const user2 = await User.create({
      name: 'Dennis',
    });

    const shop = await Shop.create({
      users: [user1, user2],
    });

    expect(shop.userNames).toEqual(['Frank', 'Dennis']);
  });

  it('should cache a virtual', async () => {
    const userSchema = createSchema({
      attributes: {
        firstName: 'String',
        lastName: 'String',
      },
    });
    userSchema.virtual('name').get(function () {
      return [this.firstName, this.lastName].join(' ');
    });
    const User = createTestModel(userSchema);
    const shopSchema = createSchema({
      attributes: {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      },
      cache: {
        userName: {
          type: 'String',
          path: 'user.name',
        },
      },
    });
    const Shop = createTestModel(shopSchema);

    const user = await User.create({
      firstName: 'Frank',
      lastName: 'Reynolds',
    });

    const shop = await Shop.create({
      user,
    });

    expect(shop.userName).toBe('Frank Reynolds');
  });

  it('should not error on unset foreign field', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = createSchema({
      attributes: {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      },
      cache: {
        userName: {
          type: 'String',
          path: 'user.name',
        },
      },
    });
    const Shop = createTestModel(schema);

    const shop = await Shop.create({});
    expect(shop.userName).toBeUndefined();
  });

  it('should not expose cached field on serialize', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = createSchema({
      attributes: {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      },
      cache: {
        userName: {
          type: 'String',
          path: 'user.name',
          readAccess: 'none',
        },
      },
    });
    const Shop = createTestModel(schema);

    const user = await User.create({
      name: 'Frank',
    });

    const shop = await Shop.create({
      user,
    });

    expect(shop.userName).toBe('Frank');
    expect(shop.toObject().userName).toBeUndefined();
  });

  it('should not interact with models with no definition', async () => {
    createTestModel(new mongoose.Schema());
    const User = createTestModel({
      name: 'String',
    });
    await expect(
      User.create({
        name: 'Frank',
      }),
    ).resolves.not.toThrow();
  });
});

describe('synced fields', () => {
  it('should not sync by default', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = createSchema({
      attributes: {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      },
      cache: {
        userName: {
          type: 'String',
          path: 'user.name',
        },
      },
    });

    const Shop = createTestModel(schema);

    const user = await User.create({
      name: 'Frank',
    });

    let shop = await Shop.create({
      user,
    });

    expect(shop.userName).toBe('Frank');

    user.name = 'Dennis';
    await user.save();

    shop = await Shop.findById(shop.id);

    expect(shop.userName).toBe('Frank');
  });

  it('should sync a single field', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = createSchema({
      attributes: {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      },
      cache: {
        userName: {
          type: 'String',
          path: 'user.name',
          sync: true,
        },
      },
    });

    const Shop = createTestModel(schema);

    const user = await User.create({
      name: 'Frank',
    });

    let shop = await Shop.create({
      user,
    });

    expect(shop.userName).toBe('Frank');

    user.name = 'Dennis';
    await user.save();

    shop = await Shop.findById(shop.id);

    expect(shop.userName).toBe('Dennis');
  });

  it('should sync multiple nested fields conditionally', async () => {
    const User = createTestModel({
      profile: {
        name: 'String',
        age: 'Number',
      },
    });
    const schema = createSchema({
      attributes: {
        details: {
          user: {
            type: 'ObjectId',
            ref: User.modelName,
          },
        },
      },
      cache: {
        userName: {
          type: 'String',
          path: 'details.user.profile.name',
          sync: true,
        },
        userAge: {
          type: 'Number',
          path: 'details.user.profile.age',
        },
      },
    });

    const Shop = createTestModel(schema);

    const user = await User.create({
      profile: {
        name: 'Frank',
        age: 63,
      },
    });

    let shop = await Shop.create({
      details: {
        user,
      },
    });

    expect(shop.userName).toBe('Frank');
    expect(shop.userAge).toBe(63);

    user.profile.name = 'Dennis';
    user.profile.age = 40;
    await user.save();

    shop = await Shop.findById(shop.id);

    expect(shop.userName).toBe('Dennis');
    expect(shop.userAge).toBe(63);
  });

  it('should sync array fields', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = createSchema({
      attributes: {
        users: [
          {
            type: 'ObjectId',
            ref: User.modelName,
          },
        ],
      },
      cache: {
        userNames: {
          type: ['String'],
          path: 'users.name',
          sync: true,
        },
      },
    });

    const Shop = createTestModel(schema);

    const user1 = await User.create({
      name: 'Frank',
    });

    const user2 = await User.create({
      name: 'Dennis',
    });

    let shop = await Shop.create({
      users: [user1, user2],
    });

    expect(shop.userNames).toEqual(['Frank', 'Dennis']);

    user1.name = 'Charlie';
    await user1.save();

    shop = await Shop.findById(shop.id);

    expect(shop.userNames).toEqual(['Charlie', 'Dennis']);
  });
});

describe('syncCacheFields', () => {
  it('should sync cached fields', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = createSchema({
      attributes: {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      },
      cache: {
        userName: {
          type: 'String',
          path: 'user.name',
        },
      },
    });
    const Shop = createTestModel(schema);

    const user = await User.create({
      name: 'Frank',
    });

    let shop = await Shop.create({});

    await shop.updateOne({
      $set: {
        user: user.id,
      },
    });

    expect(shop.userName).toBeUndefined();

    const ret = await Shop.syncCacheFields();

    expect(ret).toMatchObject({
      matchedCount: 1,
      modifiedCount: 1,
    });

    shop = await Shop.findById(shop.id);
    expect(shop.userName).toBe('Frank');
  });

  it('should not overwrite non-synced fields', async () => {
    const User = createTestModel({
      name: 'String',
      age: 'Number',
    });
    const schema = createSchema({
      attributes: {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      },
      cache: {
        userName: {
          type: 'String',
          path: 'user.name',
          sync: true,
        },
        userAge: {
          type: 'Number',
          path: 'user.age',
        },
      },
    });
    const Shop = createTestModel(schema);

    const user = await User.create({
      name: 'Frank',
      age: 63,
    });

    let shop = await Shop.create({});
    await shop.updateOne({
      $set: {
        user: user.id,
      },
    });

    shop = await Shop.findById(shop.id);

    expect(shop.userName).toBeUndefined();
    expect(shop.userAge).toBeUndefined();

    await Shop.syncCacheFields();

    shop = await Shop.findById(shop.id);

    expect(shop.userName).toBe('Frank');
    expect(shop.userAge).toBe(63);

    await user.updateOne({
      $set: {
        name: 'Dennis',
        age: 40,
      },
    });

    await Shop.syncCacheFields();

    shop = await Shop.findById(shop.id);

    expect(shop.userName).toBe('Dennis');
    expect(shop.userAge).toBe(63);
  });

  it('should throw error when no fields to sync', async () => {
    const User = createTestModel({
      name: 'String',
    });

    await expect(async () => {
      await User.syncCacheFields();
    }).rejects.toThrow();
  });

  it('should not error on missing foreign field', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = createSchema({
      attributes: {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      },
      cache: {
        userName: {
          type: 'String',
          path: 'user.name',
        },
      },
    });
    const Shop = createTestModel(schema);

    const shop = await Shop.create({});

    await Shop.syncCacheFields();

    const updated = await Shop.findById(shop.id);
    expect(updated.userName).toBeUndefined();
  });

  it('should not sync a lazy cached field that is already set', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = createSchema({
      attributes: {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      },
      cache: {
        userName: {
          type: 'String',
          path: 'user.name',
          lazy: true,
        },
      },
    });
    const Shop = createTestModel(schema);

    const user = await User.create({
      name: 'Frank',
    });

    let shop = await Shop.create({
      user,
    });

    expect(shop.userName).toBe('Frank');

    user.name = 'Dennis';
    await user.save();

    await Shop.syncCacheFields();

    shop = await Shop.findById(shop.id);
    expect(shop.userName).toBe('Frank');
  });
});

describe('integrations', () => {
  it('should integrate with keyword search', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = createSchema({
      attributes: {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      },
      cache: {
        userName: {
          type: 'String',
          path: 'user.name',
        },
      },
      search: {
        fields: ['userName'],
      },
    });
    const Shop = createTestModel(schema);

    const user1 = await User.create({
      name: 'Frank',
    });

    const shop1 = await Shop.create({
      user: user1,
    });

    const user2 = await User.create({
      name: 'Dennis',
    });

    const shop2 = await Shop.create({
      user: user2,
    });

    let result;

    result = await Shop.search({
      keyword: 'Frank',
    });

    expect(result.meta.total).toBe(1);
    expect(result.data[0].id).toBe(shop1.id);

    result = await Shop.search({
      keyword: 'Dennis',
    });

    expect(result.meta.total).toBe(1);
    expect(result.data[0].id).toBe(shop2.id);

    result = await Shop.search({
      keyword: 'foo',
    });

    expect(result.meta.total).toBe(0);
  });

  it('should not accept cached fields in create validation', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = createSchema({
      attributes: {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      },
      cache: {
        userName: {
          type: 'String',
          path: 'user.name',
        },
      },
      search: {
        fields: ['userName'],
      },
    });
    const Shop = createTestModel(schema);

    const validator = Shop.getCreateValidation();

    await expect(
      validator.validate({
        userName: 'Frank',
      }),
    ).rejects.toThrow();
  });

  it('should accept cached fields in search validation', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const schema = createSchema({
      attributes: {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      },
      cache: {
        userName: {
          type: 'String',
          path: 'user.name',
        },
      },
      search: {
        fields: ['userName'],
      },
    });
    const Shop = createTestModel(schema);

    const validator = Shop.getSearchValidation();

    await expect(
      validator.validate({
        userName: 'Frank',
      }),
    ).resolves.not.toThrow();
  });
});
