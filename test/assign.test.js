import mongoose from 'mongoose';

import { createTestModel } from '../src/testing';

describe('assign', () => {
  describe('setting', () => {
    it('should assign shallow fields', async () => {
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

    it('should assign reference fields', async () => {
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

    it('should assign empty arrays to reference fields', async () => {
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

    it('should replace nested fields', async () => {
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

      expect(user.toObject().profile).toEqual({
        firstName: 'Jane',
      });
    });

    it('should replace array fields', async () => {
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

      expect(shop.toObject().products).toEqual([
        {
          id: shop.products[0].id,
          name: 'conditioner',
        },
        {
          id: shop.products[1].id,
          name: 'body wash',
        },
      ]);
    });

    it('should set 0 on number fields', async () => {
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

    it('should set false on boolean fields', async () => {
      const User = createTestModel({
        active: 'Boolean',
      });

      let user = await User.create({
        active: true,
      });

      user.assign({
        active: false,
      });
      await user.save();

      user = await User.findById(user.id);

      expect(user.active).toBe(false);
    });

    it('should set a mongoose document', async () => {
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

    it('should set a nested mongoose document', async () => {
      const User = createTestModel({
        name: 'String',
        tags: ['String'],
      });
      const Shop = createTestModel({
        profile: {
          owner: {
            type: 'ObjectId',
            ref: User.modelName,
          },
        },
      });
      const user = await User.create({
        name: 'Frank',
        tags: ['foo'],
      });
      const shop = new Shop();
      shop.assign({
        profile: {
          owner: user,
        },
      });
      expect(shop.profile.owner.name).toBe('Frank');
    });
  });

  describe('unsetting', () => {
    it('should unset fields with empty strings', async () => {
      const User = createTestModel({
        name: 'String',
      });
      let user = await User.create({
        name: 'Frank',
      });

      user.assign({
        name: '',
      });
      await user.save();

      user = await User.findById(user.id);
      expect(user.name).toBeUndefined();
    });

    it('should unset nested fields with flat syntax', async () => {
      const User = createTestModel({
        profile: {
          name: 'String',
          age: 'Number',
        },
      });

      let user = await User.create({
        profile: {
          name: 'Frank',
          age: 55,
        },
      });

      user.assign({
        'profile.name': '',
      });
      await user.save();

      user = await User.findById(user.id);
      expect(user.toObject().profile).toEqual({
        age: 55,
      });
    });

    it('should unset nested array fields with flat syntax', async () => {
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
          {
            name: 'Dennis',
            gender: 'male',
          },
        ],
      });

      user.assign({
        'profiles.0.gender': '',
      });
      await user.save();

      user = await User.findById(user.id);
      expect(user.toObject().profiles).toEqual([
        {
          id: user.profiles[0].id,
          name: 'Frank',
        },
        {
          id: user.profiles[1].id,
          name: 'Dennis',
          gender: 'male',
        },
      ]);
    });

    it('should unset array fields with expanded syntax', async () => {
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
          {
            name: 'Dennis',
            gender: 'male',
          },
        ],
      });

      user.assign({
        profiles: [
          {
            name: 'Frank',
            gender: '',
          },
          {
            name: 'Dennis',
            gender: 'male',
          },
        ],
      });
      await user.save();

      user = await User.findById(user.id);
      expect(user.toObject().profiles).toEqual([
        {
          id: user.profiles[0].id,
          name: 'Frank',
        },
        {
          id: user.profiles[1].id,
          name: 'Dennis',
          gender: 'male',
        },
      ]);
    });

    it('should unset array element', async () => {
      const User = createTestModel({
        profiles: [
          {
            name: 'String',
          },
        ],
      });

      let user = await User.create({
        profiles: [
          {
            name: 'Frank',
          },
          {
            name: 'Dennis',
          },
        ],
      });

      user.assign({
        profiles: [
          {
            name: 'Frank',
          },
        ],
      });
      await user.save();

      user = await User.findById(user.id);

      expect(user.toObject().profiles).toEqual([
        {
          id: user.profiles[0].id,
          name: 'Frank',
        },
      ]);
    });

    it('should unset reference fields with empty strings', async () => {
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
      let shop = await Shop.create({
        user: id,
        nested: {
          name: 'fake',
          user: id,
        },
      });

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
          name: 'fake',
          user: '',
        },
      });
      await shop.save();

      shop = await Shop.findById(shop.id);
      data = JSON.parse(JSON.stringify(shop));
      expect(data.user).toBeUndefined();
      expect(data.nested).toEqual({
        name: 'fake',
      });
    });

    it('should unset mixed content fields with null and expanded syntax', async () => {
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
          name: 'Jake',
          age: null,
        },
      });
      expect(user.isModified('profile.age')).toBe(true);
      await user.save();

      user = await User.findById(user.id);

      expect(user.toObject().profile).toEqual({
        name: 'Jake',
      });
    });

    it('should unset mixed content fields with null and flat syntax', async () => {
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
        'profile.age': null,
      });
      expect(user.isModified('profile.age')).toBe(true);
      await user.save();

      user = await User.findById(user.id);

      expect(user.toObject().profile).toEqual({
        name: 'Bob',
      });
    });

    it('should unset fields with undefined', async () => {
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

    it('should unset array fields with extended syntax', async () => {
      const User = createTestModel({
        profiles: [
          {
            name: 'String',
            age: 'Number',
          },
        ],
      });

      let user = await User.create({
        profiles: [
          {
            name: 'Frank',
            age: 55,
          },
          {
            name: 'Dennis',
            age: 30,
          },
        ],
      });

      user.assign({
        profiles: [
          {
            name: 'Frank',
            age: '',
          },
        ],
      });
      await user.save();

      user = await User.findById(user.id);
      expect(user.toObject().profiles).toEqual([
        {
          id: user.profiles[0].id,
          name: 'Frank',
        },
      ]);
    });
  });
});
