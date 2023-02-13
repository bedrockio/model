import { Types } from 'mongoose';

import { getIncludes } from '../src/include';
import { createTestModel, getTestModelName } from '../src/testing';

const userModelName = getTestModelName();

const Shop = createTestModel({
  name: 'String',
  email: 'String',
  tags: ['String'],
  user: {
    ref: userModelName,
    type: 'ObjectId',
  },
  customers: [
    {
      ref: userModelName,
      type: 'ObjectId',
    },
  ],
  deep: {
    user: {
      ref: userModelName,
      type: 'ObjectId',
    },
  },
});

const Product = createTestModel({
  name: 'String',
  email: 'String',
  tags: ['String'],
  shop: {
    ref: Shop.modelName,
    type: 'ObjectId',
  },
});

const userSchema = {
  name: 'String',
  email: 'String',
  tags: ['String'],
  address: {
    line1: 'String',
    line2: 'String',
  },
  likedProducts: [
    {
      ref: Product.modelName,
      type: 'ObjectId',
    },
  ],
  self: {
    ref: userModelName,
    type: 'ObjectId',
  },
};

const User = createTestModel(userModelName, userSchema);

const Comment = createTestModel({
  body: 'String',
  product: {
    ref: Product.modelName,
    type: 'ObjectId',
  },
});

Product.schema.virtual('comments', {
  ref: Comment.modelName,
  localField: '_id',
  foreignField: 'product',
  justOne: false,
});

describe('getIncludes', () => {
  it('should have select for single field', async () => {
    const data = getIncludes(Shop.modelName, 'name');
    expect(data).toEqual({
      select: ['name'],
      populate: [],
    });
  });

  it('should have select for multiple fields', async () => {
    const data = getIncludes(Shop.modelName, ['name', 'email']);
    expect(data).toEqual({
      select: ['name', 'email'],
      populate: [],
    });
  });

  it('should have populate for single foreign field', async () => {
    const data = getIncludes(Shop.modelName, 'user');
    expect(data).toEqual({
      select: [],
      populate: [
        {
          path: 'user',
          select: [],
          populate: [],
        },
      ],
    });
  });

  it('should have populate for multiple foreign fields', async () => {
    const data = getIncludes(Shop.modelName, ['user', 'deep.user']);
    expect(data).toEqual({
      select: [],
      populate: [
        {
          path: 'user',
          select: [],
          populate: [],
        },
        {
          path: 'deep.user',
          select: [],
          populate: [],
        },
      ],
    });
  });

  it('should be correct for combining selection and population', async () => {
    const data = getIncludes(Shop.modelName, [
      'name',
      'email',
      'user',
      'deep.user',
    ]);
    expect(data).toEqual({
      select: ['name', 'email'],
      populate: [
        {
          path: 'user',
          select: [],
          populate: [],
        },
        {
          path: 'deep.user',
          select: [],
          populate: [],
        },
      ],
    });
  });

  it('should select a populated field', async () => {
    const data = getIncludes(Shop.modelName, 'user.name');
    expect(data).toEqual({
      select: [],
      populate: [
        {
          path: 'user',
          select: ['name'],
          populate: [],
        },
      ],
    });
  });

  it('should select a nested populated field', async () => {
    const data = getIncludes(Shop.modelName, 'user.address.line1');
    expect(data).toEqual({
      select: [],
      populate: [
        {
          path: 'user',
          select: ['address.line1'],
          populate: [],
        },
      ],
    });
  });

  it('should select double nested populated field', async () => {
    const data = getIncludes(Shop.modelName, 'deep.user.address.line1');
    expect(data).toEqual({
      select: [],
      populate: [
        {
          path: 'deep.user',
          select: ['address.line1'],
          populate: [],
        },
      ],
    });
  });

  it('should not override previously selected fields', async () => {
    const data = getIncludes(Shop.modelName, ['user.name', 'user.email']);
    expect(data).toEqual({
      select: [],
      populate: [
        {
          path: 'user',
          select: ['name', 'email'],
          populate: [],
        },
      ],
    });
  });

  it('should override root with select', async () => {
    const data = getIncludes(Shop.modelName, ['user', 'user.name']);
    expect(data).toEqual({
      select: [],
      populate: [
        {
          path: 'user',
          select: ['name'],
          populate: [],
        },
      ],
    });
  });

  it('should override root with select reversed', async () => {
    const data = getIncludes(Shop.modelName, ['user.name', 'user']);
    expect(data).toEqual({
      select: [],
      populate: [
        {
          path: 'user',
          select: ['name'],
          populate: [],
        },
      ],
    });
  });

  it('should select an array field', async () => {
    const data = getIncludes(Shop.modelName, 'tags');
    expect(data).toEqual({
      select: ['tags'],
      populate: [],
    });
  });

  it('should select a foreign array field', async () => {
    const data = getIncludes(Shop.modelName, 'user.tags');
    expect(data).toEqual({
      select: [],
      populate: [
        {
          path: 'user',
          select: ['tags'],
          populate: [],
        },
      ],
    });
  });

  it('should populate an array field', async () => {
    const data = getIncludes(Shop.modelName, 'customers');
    expect(data).toEqual({
      select: [],
      populate: [
        {
          path: 'customers',
          select: [],
          populate: [],
        },
      ],
    });
  });

  it('should populate a foreign array field', async () => {
    const data = getIncludes(Product.modelName, 'shop.customers');
    expect(data).toEqual({
      select: [],
      populate: [
        {
          path: 'shop',
          select: [],
          populate: [
            {
              path: 'customers',
              select: [],
              populate: [],
            },
          ],
        },
      ],
    });
  });

  it('should populate and select a foreign array field', async () => {
    const data = getIncludes(Product.modelName, 'shop.customers.address.line1');
    expect(data).toEqual({
      select: [],
      populate: [
        {
          path: 'shop',
          select: [],
          populate: [
            {
              path: 'customers',
              select: ['address.line1'],
              populate: [],
            },
          ],
        },
      ],
    });
  });

  it('should select deeply populated field', async () => {
    const data = getIncludes(Product.modelName, 'shop.user.address.line1');
    expect(data).toEqual({
      select: [],
      populate: [
        {
          path: 'shop',
          select: [],
          populate: [
            {
              path: 'user',
              select: ['address.line1'],
              populate: [],
            },
          ],
        },
      ],
    });
  });

  it('should select a shallow and deeply populated field', async () => {
    const data = getIncludes(Product.modelName, [
      'name',
      'shop.user.address.line1',
    ]);
    expect(data).toEqual({
      select: ['name'],
      populate: [
        {
          path: 'shop',
          select: [],
          populate: [
            {
              path: 'user',
              select: ['address.line1'],
              populate: [],
            },
          ],
        },
      ],
    });
  });

  it('should handle complex population of many fields', async () => {
    const data = getIncludes(Product.modelName, [
      'name',
      'shop.email',
      'shop.user.name',
      'shop.user.address.line1',
      'shop.customers.self.self.tags',
    ]);
    expect(data).toEqual({
      select: ['name'],
      populate: [
        {
          path: 'shop',
          select: ['email'],
          populate: [
            {
              path: 'user',
              select: ['name', 'address.line1'],
              populate: [],
            },
            {
              path: 'customers',
              select: [],
              populate: [
                {
                  path: 'self',
                  select: [],
                  populate: [
                    {
                      path: 'self',
                      select: ['tags'],
                      populate: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('should populate recursive field', async () => {
    const data = getIncludes(User.modelName, 'self.self.self');
    expect(data).toEqual({
      select: [],
      populate: [
        {
          path: 'self',
          select: [],
          populate: [
            {
              path: 'self',
              select: [],
              populate: [
                {
                  path: 'self',
                  select: [],
                  populate: [],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('should populate a virtual', async () => {
    const data = getIncludes(Product.modelName, 'comments');
    expect(data).toEqual({
      select: [],
      populate: [
        {
          path: 'comments',
          select: [],
          populate: [],
        },
      ],
    });
  });

  it('should throw an error on unknown path', async () => {
    expect(() => {
      getIncludes(User.modelName, 'name.foo');
    }).toThrow(`Unknown path on ${User.modelName}: name.foo.`);
  });

  it('should error on massive recusrion', async () => {
    const include = 'self'.repeat(6).match(/.{4}/g).join('.');
    expect(() => {
      getIncludes(User.modelName, include);
    }).toThrow('Cannot populate more than 5 levels.');
  });

  it('should allow trailing wildcards in includes', async () => {
    const User = createTestModel({
      name: 'String',
      name1: 'String',
      name2: 'String',
      nameFirst: 'String',
      nameLast: 'String',
      naming: 'String',
      deep: {
        deep: {
          name: 'String',
          name1: 'String',
          name2: 'String',
        },
      },
      nam: 'String',
    });
    const data = getIncludes(User.modelName, ['name*', 'deep.deep.name*']);
    expect(data).toEqual({
      select: [
        'name1',
        'name2',
        'nameFirst',
        'nameLast',
        'deep.deep.name1',
        'deep.deep.name2',
      ],
      populate: [],
    });
  });

  it('should allow leading wildcards in includes', async () => {
    const User = createTestModel({
      nam: 'String',
      name: 'String',
      Name: 'String',
      fName: 'String',
      FName: 'String',
      firstName: 'String',
      lastName: 'String',
      aname: 'String',
      name1: 'String',
      name2: 'String',
      deep: {
        deep: {
          nam: 'String',
          name: 'String',
          Name: 'String',
          fName: 'String',
          FName: 'String',
          firstName: 'String',
          lastName: 'String',
          aname: 'String',
          name1: 'String',
          name2: 'String',
        },
      },
    });
    const data = getIncludes(User.modelName, ['*Name', 'deep.deep.*Name']);
    expect(data).toEqual({
      select: [
        'fName',
        'FName',
        'firstName',
        'lastName',
        'deep.deep.fName',
        'deep.deep.FName',
        'deep.deep.firstName',
        'deep.deep.lastName',
      ],
      populate: [],
    });
  });

  it('should not choke on recursion', async () => {
    const data = getIncludes(User.modelName, '**');
    expect(data).toEqual({
      select: [
        'name',
        'email',
        'tags',
        'address.line1',
        'address.line2',
        'createdAt',
        'updatedAt',
        'deletedAt',
        'deleted',
      ],
      populate: [
        {
          path: 'likedProducts',
          select: [],
          populate: [],
        },
        {
          path: 'self',
          select: [],
          populate: [],
        },
      ],
    });
  });

  it('should allow wildcards across deep paths', async () => {
    const data = getIncludes(Product.modelName, 'shop.**');
    expect(data).toEqual({
      select: [],
      populate: [
        {
          path: 'shop',
          select: [
            'name',
            'email',
            'tags',
            'createdAt',
            'updatedAt',
            'deletedAt',
            'deleted',
          ],
          populate: [
            {
              path: 'user',
              populate: [],
              select: [],
            },
            {
              path: 'customers',
              populate: [],
              select: [],
            },
            {
              path: 'deep.user',
              populate: [],
              select: [],
            },
          ],
        },
      ],
    });
  });
});

describe('query includes', () => {
  it('should allow query chaining with include', async () => {
    const user = await User.create({
      name: 'Bob',
    });
    let shop = await Shop.create({
      name: 'foo',
      user: user.id,
    });

    shop = await Shop.findById(shop.id);
    expect(shop.user).toBeInstanceOf(Types.ObjectId);

    shop = await Shop.findById(shop.id).include('user');
    expect(shop.user.id).toBe(user.id);
  });

  it('should allow includes by filter', async () => {
    const user = await User.create({
      name: 'Bob',
    });
    let shop = await Shop.create({
      name: 'foo',
      user: user.id,
    });

    [shop] = await Shop.find({
      _id: shop.id,
    });
    expect(shop.user).toBeInstanceOf(Types.ObjectId);

    [shop] = await Shop.find({
      _id: shop.id,
      include: 'user',
    });
    expect(shop.user.id).toBe(user.id);
  });
});

describe('document includes', () => {
  it('should include after create', async () => {
    const user = await User.create({
      name: 'Bob',
    });
    const shop = await Shop.create({
      name: 'foo',
      user: user.id,
      include: ['user'],
    });
    expect(shop.user.name).toBe('Bob');
  });

  it('should include after save assign', async () => {
    const user = await User.create({
      name: 'Bob',
    });
    const shop = new Shop({
      name: 'foo',
    });
    shop.assign({
      user: user.id,
      include: 'user',
    });
    await shop.save();
    expect(shop.user.name).toBe('Bob');
  });

  it('should include after manual update', async () => {
    const user = await User.create({
      name: 'Bob',
    });
    const shop = await Shop.create({
      name: 'foo',
    });
    shop.name = 'butts';
    shop.user = user.id;
    shop.include = 'user';
    await shop.save();
    expect(shop.user.name).toBe('Bob');
  });

  it('should populate after insert', async () => {
    const user = await User.create({
      name: 'Bob',
    });
    const shop = new Shop({
      name: 'foo',
      user: user.id,
      include: 'user',
    });
    await shop.save();
    expect(shop.user.name).toBe('Bob');
  });

  it('should perform complex populate after insert', async () => {
    const user = await User.create({
      name: 'Bob',
    });
    const shop = await Shop.create({
      name: 'Shop',
      user: user.id,
    });
    const product = await Product.create({
      name: 'Product',
      shop: shop.id,
      include: ['name', 'shop.user'],
    });
    const data = JSON.parse(JSON.stringify(product));
    expect(data).toEqual({
      id: product.id,
      name: 'Product',
      shop: {
        id: shop.id,
        name: 'Shop',
        tags: [],
        customers: [],
        user: {
          id: user.id,
          name: 'Bob',
          tags: [],
          likedProducts: [],
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
        createdAt: shop.createdAt.toISOString(),
        updatedAt: shop.updatedAt.toISOString(),
      },
    });
  });

  it('should virtually project fields on a created document', async () => {
    const user = await User.create({
      name: 'Bob',
      email: 'bob@bar.com',
    });
    const shop = await Shop.create({
      name: 'foo',
      email: 'foo@bar.com',
      user: user.id,
      include: ['name', 'user'],
    });
    const data = JSON.parse(JSON.stringify(shop));
    expect(data).toEqual({
      id: shop.id,
      name: 'foo',
      user: {
        id: user.id,
        name: 'Bob',
        email: 'bob@bar.com',
        tags: [],
        likedProducts: [],
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    });
  });

  it('should exclude fields', async () => {
    const user = await User.create({
      name: 'Bob',
      email: 'foo@bar.com',
      tags: ['a', 'b', 'c'],
      include: ['-name', '-tags'],
    });
    const data = JSON.parse(JSON.stringify(user));
    expect(data).toEqual({
      id: user.id,
      email: 'foo@bar.com',
      likedProducts: [],
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  });

  it('should exclude a populated field', async () => {
    const user = await User.create({
      name: 'Bob',
      email: 'foo@bar.com',
    });
    const shop = await Shop.create({
      name: 'Shop',
      email: 'shop@bar.com',
      user: user.id,
      include: ['-name', '-user'],
    });
    const data = JSON.parse(JSON.stringify(shop));
    expect(data).toEqual({
      id: shop.id,
      email: 'shop@bar.com',
      tags: [],
      customers: [],
      createdAt: shop.createdAt.toISOString(),
      updatedAt: shop.updatedAt.toISOString(),
    });
  });

  it('should exclude a deep field', async () => {
    const user = await User.create({
      name: 'Bob',
      email: 'foo@bar.com',
      address: {
        line1: 'line1',
        line2: 'line2',
      },
    });
    const shop = await Shop.create({
      name: 'Shop',
      user: user.id,
      include: ['user', '-user.name', '-user.address.line1'],
    });
    const data = JSON.parse(JSON.stringify(shop));
    expect(data).toEqual({
      id: shop.id,
      name: 'Shop',
      user: {
        id: user.id,
        tags: [],
        email: 'foo@bar.com',
        address: {
          line2: 'line2',
        },
        likedProducts: [],
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      tags: [],
      customers: [],
      createdAt: shop.createdAt.toISOString(),
      updatedAt: shop.updatedAt.toISOString(),
    });
  });
});

describe('access control', () => {
  const User = createTestModel({
    name: 'String',
    password: {
      type: 'String',
      readAccess: 'none',
    },
  });

  const Shop = createTestModel({
    name: 'String',
    user: {
      ref: User.modelName,
      type: 'ObjectId',
    },
  });

  it('should not allow read access', async () => {
    let user = await User.create({
      password: 'fake password',
    });
    user = await User.findById(user.id).include('password');
    expect(user.password).toBe('fake password');
    expect(user.toObject().password).toBeUndefined();
  });

  it('should not allow read access with wildcard', async () => {
    let user = await User.create({
      password: 'fake password',
    });
    user = await User.findById(user.id).include('*');
    expect(user.password).toBe('fake password');
    expect(user.toObject().password).toBeUndefined();
  });

  it('should not allow read access with exclusion', async () => {
    let user = await User.create({
      password: 'fake password',
    });
    user = await User.findById(user.id).include('-name');
    expect(user.password).toBe('fake password');
    expect(user.toObject().password).toBeUndefined();
  });

  it('should not allow deep read access', async () => {
    const user = await User.create({
      password: 'fake password',
    });
    let shop = await Shop.create({
      name: 'foo',
      user,
    });
    shop = await Shop.findById(shop.id).include('user');
    expect(shop.user.password).toBe('fake password');
    expect(shop.toObject().user.password).toBeUndefined();
  });
});

describe('other', () => {
  it('should not populate a deleted document', async () => {
    const user = await User.create({
      password: 'fake password',
    });
    let shop = await Shop.create({
      name: 'foo',
      user,
    });
    await user.delete();
    shop = await Shop.findById(shop.id).include('user');
    expect(shop.user).toBe(null);
  });
});
