import mongoose from 'mongoose';

import { createTestModel } from '../src/testing';

describe('assign', () => {
  it('should allow assignment of fields', async () => {
    const User = createTestModel({
      date: 'Date',
      name: 'String',
      number: 'Number',
    });
    const user = new User();
    const now = Date.now();
    user.assign({
      name: 'fake name',
      number: 5,
      date: new Date(now),
    });
    expect(user.name).toBe('fake name');
    expect(user.number).toBe(5);
    expect(user.date.getTime()).toBe(now);
  });

  it('should delete falsy values for reference fields', async () => {
    const User = createTestModel();
    const Shop = createTestModel({
      user: {
        type: 'ObjectId',
        ref: User.modelName,
      },
      nested: {
        name: 'String',
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      },
    });
    const id = new mongoose.Types.ObjectId().toString();
    const shop = new Shop({
      user: id,
      nested: {
        name: 'fake',
        user: id,
      },
    });
    await shop.save();

    let data = JSON.parse(JSON.stringify(shop));
    expect(data).toMatchObject({
      user: id,
      nested: {
        name: 'fake',
        user: id,
      },
    });
    shop.assign({
      user: '',
      nested: {
        user: '',
      },
    });
    await shop.save();

    data = JSON.parse(JSON.stringify(shop));
    expect(data.user).toBeUndefined();
    expect(data.nested).toEqual({
      name: 'fake',
    });
  });

  it('should be able to set reference fields', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const Shop = createTestModel({
      user: {
        type: 'ObjectId',
        ref: User.modelName,
      },
    });

    const user = await User.create({
      name: 'Frank',
    });
    let shop = new Shop();

    shop.assign({
      user,
    });
    await shop.save();

    shop = await Shop.findById(shop.id);
    expect(shop.user.toString()).toEqual(user.id);
  });

  it('should still allow assignment of empty arrays for multi-reference fields', async () => {
    const User = createTestModel();
    const Shop = createTestModel({
      users: [
        {
          type: 'ObjectId',
          ref: User.modelName,
        },
      ],
    });
    const shop = new Shop({
      users: ['5f63b1b88f09266f237e9d29', '5f63b1b88f09266f237e9d29'],
    });
    await shop.save();

    let data = JSON.parse(JSON.stringify(shop));
    expect(data.users).toEqual([
      '5f63b1b88f09266f237e9d29',
      '5f63b1b88f09266f237e9d29',
    ]);
    shop.assign({
      users: [],
    });
    await shop.save();
    data = JSON.parse(JSON.stringify(shop));
    expect(data.users).toEqual([]);
  });

  it('should allow partial assignment of nested fields', async () => {
    const User = createTestModel({
      profile: {
        firstName: 'String',
        lastName: 'String',
      },
    });

    const user = await User.create({
      profile: {
        firstName: 'John',
        lastName: 'Doe',
      },
    });

    user.assign({
      profile: {
        firstName: 'Jane',
      },
    });
    await user.save();

    expect(user.profile.firstName).toEqual('Jane');
    expect(user.profile.lastName).toEqual('Doe');
  });

  it('should naively set nested array fields', async () => {
    const Shop = createTestModel({
      products: [
        {
          name: 'String',
        },
      ],
    });
    const shop = await Shop.create({
      products: [
        {
          name: 'shampoo',
        },
      ],
    });

    shop.assign({
      products: [
        {
          name: 'conditioner',
        },
        {
          name: 'body wash',
        },
      ],
    });
    await shop.save();

    expect(shop.products[0].name).toBe('conditioner');
    expect(shop.products[1].name).toBe('body wash');
  });

  it('should not overwrite mixed content fields', async () => {
    const User = createTestModel({
      profile: 'Object',
    });

    const user = await User.create({
      profile: {
        foo: 'foo',
      },
    });

    user.assign({
      profile: {
        bar: 'bar',
      },
    });
    await user.save();

    expect(user.profile).toEqual({
      foo: 'foo',
      bar: 'bar',
    });
  });

  it('should delete mixed content fields with null', async () => {
    const User = createTestModel({
      profile: 'Object',
    });

    let user = await User.create({
      profile: {
        name: 'Bob',
        age: 30,
      },
    });

    user.assign({
      profile: {
        age: null,
      },
    });
    expect(user.isModified('profile.age')).toBe(true);
    await user.save();

    user = await User.findById(user.id);

    expect(user.profile.name).toBe('Bob');
    expect('age' in user.profile).toBe(false);
  });

  it('should delete mixed content fields with undefined', async () => {
    const User = createTestModel({
      name: 'String',
    });

    let user = await User.create({
      name: 'Frank',
    });

    user.assign({
      name: undefined,
    });
    expect(user.isModified('name')).toBe(true);
  });

  it('should allow 0 to be set on number fields', async () => {
    const User = createTestModel({
      age: 'Number',
    });

    let user = await User.create({
      age: 30,
    });

    user.assign({
      age: 0,
    });
    await user.save();

    user = await User.findById(user.id);

    expect(user.age).toBe(0);
  });

  it('should not fail on a mongoose document', async () => {
    const User = createTestModel({
      name: 'String',
      tags: ['String'],
    });
    const Shop = createTestModel({
      owner: {
        type: 'ObjectId',
        ref: User.modelName,
      },
    });
    const user = await User.create({
      name: 'Frank',
      tags: ['foo'],
    });
    const shop = new Shop();
    shop.assign({
      owner: user,
    });
    expect(shop.owner.name).toBe('Frank');
  });

  it('should strip out fields with empty strings', async () => {
    const User = createTestModel({
      name: 'String',
    });
    let user = new User();
    user.assign({
      name: '',
    });
    await user.save();

    user = await User.findById(user.id);
    expect(user.name).toBeUndefined();
  });

  it('should unset nested array fields', async () => {
    const User = createTestModel({
      profiles: [
        {
          name: 'String',
          gender: {
            type: 'String',
            enum: ['male', 'female', 'other'],
          },
        },
      ],
    });

    let user = await User.create({
      profiles: [
        {
          name: 'Frank',
          gender: 'male',
        },
      ],
    });

    user.assign({
      profiles: [
        {
          name: 'Dennis',
          gender: '',
        },
      ],
    });
    await user.save();

    user = await User.findById(user.id);
    expect(user.profiles.toObject()).toEqual([
      {
        id: user.profiles[0].id,
        _id: user.profiles[0]._id,
        name: 'Dennis',
      },
    ]);
  });
});
