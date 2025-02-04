import { Types } from 'mongoose';

import { getParams, getDocumentParams } from '../src/include';
import { createSchema } from '../src/schema';
import { createTestModel, getTestModelName } from '../src/testing';

const userModelName = getTestModelName();
const productModelName = getTestModelName();

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
  inventory: {
    type: 'Array',
    attributes: {
      quantity: 'Number',
      product: {
        ref: productModelName,
        type: 'ObjectId',
      },
    },
  },
  deep: {
    type: 'Object',
    attributes: {
      user: {
        ref: userModelName,
        type: 'ObjectId',
      },
    },
  },
});

const Product = createTestModel(productModelName, {
  name: 'String',
  email: 'String',
  tags: ['String'],
  shop: {
    ref: Shop.modelName,
    type: 'ObjectId',
  },
});

const User = createTestModel(userModelName, {
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
});

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

afterEach(async () => {
  await User.deleteMany({});
  await Shop.deleteMany({});
  await Product.deleteMany({});
  await Comment.deleteMany({});
});

describe('getParams', () => {
  describe('inclusive', () => {
    it('should do nothing on a top-level field', async () => {
      const params = getParams(Shop.modelName, 'name');
      expect(params).toEqual({
        select: [],
        populate: [],
      });
    });

    it('should do nothing on multiple top-level fields', async () => {
      const params = getParams(Shop.modelName, ['name', 'email']);
      expect(params).toEqual({
        select: [],
        populate: [],
      });
    });

    it('should populate single foreign field', async () => {
      const params = getParams(Shop.modelName, 'user');
      expect(params).toEqual({
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

    it('should populate multiple foreign fields', async () => {
      const params = getParams(Shop.modelName, ['user', 'deep.user']);
      expect(params).toEqual({
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

    it('should not select on populated field', async () => {
      const params = getParams(Shop.modelName, 'user.name');
      expect(params).toEqual({
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

    it('should not select on a nested populated field', async () => {
      const params = getParams(Shop.modelName, 'user.address.line1');
      expect(params).toEqual({
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

    it('should not select within double nested populated field', async () => {
      const params = getParams(Shop.modelName, 'deep.user.address.line1');
      expect(params).toEqual({
        select: [],
        populate: [
          {
            path: 'deep.user',
            select: [],
            populate: [],
          },
        ],
      });
    });

    it('should populate an array field', async () => {
      const params = getParams(Shop.modelName, 'customers');
      expect(params).toEqual({
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
      const params = getParams(Product.modelName, 'shop.customers');
      expect(params).toEqual({
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

    it('should not perform select on a deep populated foreign array field', async () => {
      const params = getParams(
        Product.modelName,
        'shop.customers.address.line1',
      );
      expect(params).toEqual({
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

    it('should populate recursive field', async () => {
      const params = getParams(User.modelName, 'self.self.self');
      expect(params).toEqual({
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
      const params = getParams(Product.modelName, 'comments');
      expect(params).toEqual({
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

    it('should populate into virtual nested fields', async () => {
      const params = getParams(Product.modelName, 'comments.product');
      expect(params).toEqual({
        select: [],
        populate: [
          {
            path: 'comments',
            select: [],
            populate: [
              {
                path: 'product',
                select: [],
                populate: [],
              },
            ],
          },
        ],
      });
    });

    it('should have populate for nested ref field on array', async () => {
      const params = getParams(Shop.modelName, 'inventory.product');
      expect(params).toEqual({
        select: [],
        populate: [
          {
            path: 'inventory.product',
            populate: [],
            select: [],
          },
        ],
      });
    });
  });

  describe('exclusive', () => {
    it('should select a top-level field', async () => {
      const params = getParams(Shop.modelName, '^name');
      expect(params).toEqual({
        select: ['name'],
        populate: [],
      });
    });

    it('should select multiple fields', async () => {
      const params = getParams(Shop.modelName, ['^name', '^email']);
      expect(params).toEqual({
        select: ['name', 'email'],
        populate: [],
      });
    });

    it('should select single foreign field', async () => {
      const params = getParams(Shop.modelName, '^user');
      expect(params).toEqual({
        select: ['user'],
        populate: [
          {
            path: 'user',
            select: [],
            populate: [],
          },
        ],
      });
    });

    it('should select multiple foreign fields', async () => {
      const params = getParams(Shop.modelName, ['^user', '^deep.user']);
      expect(params).toEqual({
        select: ['user', 'deep.user'],
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

    it('should combine selection and inclusion', async () => {
      const params = getParams(Shop.modelName, [
        '^name',
        '^email',
        'user',
        'deep.user',
      ]);
      expect(params).toEqual({
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

    it('should select within populated field', async () => {
      const params = getParams(Shop.modelName, '^user.name');
      expect(params).toEqual({
        select: ['user'],
        populate: [
          {
            path: 'user',
            select: ['name'],
            populate: [],
          },
        ],
      });
    });

    it('should select within a nested populated field', async () => {
      const params = getParams(Shop.modelName, '^user.address.line1');
      expect(params).toEqual({
        select: ['user'],
        populate: [
          {
            path: 'user',
            select: ['address.line1'],
            populate: [],
          },
        ],
      });
    });

    it('should select within double nested populated field', async () => {
      const params = getParams(Shop.modelName, '^deep.user.address.line1');
      expect(params).toEqual({
        select: ['deep.user'],
        populate: [
          {
            path: 'deep.user',
            select: ['address.line1'],
            populate: [],
          },
        ],
      });
    });

    it('should exclusively select multiple fields', async () => {
      const params = getParams(Shop.modelName, ['^user.name', '^user.email']);
      expect(params).toEqual({
        select: ['user'],
        populate: [
          {
            path: 'user',
            select: ['name', 'email'],
            populate: [],
          },
        ],
      });
    });

    it('should not override root include with select', async () => {
      const params = getParams(Shop.modelName, ['user', '^user.name']);
      expect(params).toEqual({
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

    it('should not override root with select reversed', async () => {
      const params = getParams(Shop.modelName, ['^user.name', 'user']);
      expect(params).toEqual({
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
      const params = getParams(Shop.modelName, '^tags');
      expect(params).toEqual({
        select: ['tags'],
        populate: [],
      });
    });

    it('should select a foreign array field', async () => {
      const params = getParams(Shop.modelName, '^user.tags');
      expect(params).toEqual({
        select: ['user'],
        populate: [
          {
            path: 'user',
            select: ['tags'],
            populate: [],
          },
        ],
      });
    });

    it('should select deeply populated field', async () => {
      const params = getParams(Product.modelName, '^shop.user.address.line1');
      expect(params).toEqual({
        select: ['shop'],
        populate: [
          {
            path: 'shop',
            select: ['user'],
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

    it('should select both a shallow and deeply populated field', async () => {
      const params = getParams(Product.modelName, [
        '^name',
        '^shop.user.address.line1',
      ]);
      expect(params).toEqual({
        select: ['name', 'shop'],
        populate: [
          {
            path: 'shop',
            select: ['user'],
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
      const params = getParams(Product.modelName, [
        '^name',
        '^shop.email',
        '^shop.user.name',
        '^shop.user.address.line1',
        '^shop.customers.self.self.tags',
      ]);
      expect(params).toEqual({
        select: ['name', 'shop'],
        populate: [
          {
            path: 'shop',
            select: ['email', 'user', 'customers'],
            populate: [
              {
                path: 'user',
                select: ['name', 'address.line1'],
                populate: [],
              },
              {
                path: 'customers',
                select: ['self'],
                populate: [
                  {
                    path: 'self',
                    select: ['self'],
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

    it('should select recursive field', async () => {
      const params = getParams(User.modelName, '^self.self.self');
      expect(params).toEqual({
        select: ['self'],
        populate: [
          {
            path: 'self',
            select: ['self'],
            populate: [
              {
                path: 'self',
                select: ['self'],
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

    it('should select a virtual', async () => {
      const params = getParams(Product.modelName, '^comments');
      expect(params).toEqual({
        select: ['comments'],
        populate: [
          {
            path: 'comments',
            select: [],
            populate: [],
          },
        ],
      });
    });

    describe('subpaths', () => {
      it('should exclusively select populated field', async () => {
        const params = getParams(Shop.modelName, 'user.^name');
        expect(params).toEqual({
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

      it('should exclusively select deep populated field', async () => {
        const params = getParams(Shop.modelName, 'deep.user.^name');
        expect(params).toEqual({
          select: [],
          populate: [
            {
              path: 'deep.user',
              select: ['name'],
              populate: [],
            },
          ],
        });
      });

      it('should exclusively select populated array field', async () => {
        const params = getParams(Shop.modelName, 'user.^tags');
        expect(params).toEqual({
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

      it('should select mid-level nested field', async () => {
        const params = getParams(Product.modelName, 'shop.^user.address.line1');
        expect(params).toEqual({
          select: [],
          populate: [
            {
              path: 'shop',
              select: ['user'],
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

      it('should select final nested field', async () => {
        const params = getParams(Product.modelName, 'shop.user.^address.line1');
        expect(params).toEqual({
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

      it('should select synonymous final nested field', async () => {
        const params = getParams(Product.modelName, 'shop.user.address.^line1');
        expect(params).toEqual({
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

      it('should handle mid-level recursion', async () => {
        const params = getParams(User.modelName, 'self.^self.self');
        expect(params).toEqual({
          select: [],
          populate: [
            {
              path: 'self',
              select: ['self'],
              populate: [
                {
                  path: 'self',
                  select: ['self'],
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

      it('should handle final recursion', async () => {
        const params = getParams(User.modelName, 'self.self.^self');
        expect(params).toEqual({
          select: [],
          populate: [
            {
              path: 'self',
              select: [],
              populate: [
                {
                  path: 'self',
                  select: ['self'],
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
    });

    describe('wildcards', () => {
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
        const params = getParams(User.modelName, ['name*', 'deep.deep.name*']);
        expect(params).toEqual({
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
        const params = getParams(User.modelName, ['*Name', 'deep.deep.*Name']);
        expect(params).toEqual({
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
        const params = getParams(User.modelName, '**');
        expect(params).toEqual({
          select: [
            'name',
            'email',
            'tags',
            'address.line1',
            'address.line2',
            'likedProducts',
            'self',
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
        const params = getParams(Product.modelName, 'shop.**');
        expect(params).toEqual({
          select: [],
          populate: [
            {
              path: 'shop',
              select: [
                'name',
                'email',
                'tags',
                'user',
                'customers',
                'inventory.quantity',
                'inventory.product',
                'deep.user',
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
                  path: 'inventory.product',
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
  });

  describe('exclude', () => {
    it('should exclude top-level field', async () => {
      const params = getParams(Shop.modelName, '-name');
      expect(params).toEqual({
        select: ['-name'],
        populate: [],
      });
    });

    it('should exclude multiple top-level fields', async () => {
      const params = getParams(Shop.modelName, ['-name', '-email']);
      expect(params).toEqual({
        select: ['-name', '-email'],
        populate: [],
      });
    });

    it('should exclude single foreign field', async () => {
      const params = getParams(Shop.modelName, '-user');
      expect(params).toEqual({
        select: ['-user'],
        populate: [],
      });
    });

    it('should exclude multiple foreign fields', async () => {
      const params = getParams(Shop.modelName, ['-user', '-deep.user']);
      expect(params).toEqual({
        select: ['-user', '-deep.user'],
        populate: [],
      });
    });

    it('should imply population but exclude populated field', async () => {
      const params = getParams(Shop.modelName, '-user.name');
      expect(params).toEqual({
        select: [],
        populate: [
          {
            path: 'user',
            select: ['-name'],
            populate: [],
          },
        ],
      });
    });

    it('should imply population but exclude nested field', async () => {
      const params = getParams(Shop.modelName, '-user.address.line1');
      expect(params).toEqual({
        select: [],
        populate: [
          {
            path: 'user',
            select: ['-address.line1'],
            populate: [],
          },
        ],
      });
    });

    it('should exclude double nested field', async () => {
      const params = getParams(Shop.modelName, '-deep.user.address.line1');
      expect(params).toEqual({
        select: [],
        populate: [
          {
            path: 'deep.user',
            select: ['-address.line1'],
            populate: [],
          },
        ],
      });
    });

    it('should exclude an array field', async () => {
      const params = getParams(Shop.modelName, '-customers');
      expect(params).toEqual({
        select: ['-customers'],
        populate: [],
      });
    });

    it('should exclude a foreign array field', async () => {
      const params = getParams(Product.modelName, '-shop.customers');
      expect(params).toEqual({
        select: [],
        populate: [
          {
            path: 'shop',
            select: ['-customers'],
            populate: [],
          },
        ],
      });
    });

    it('should exclude a deep populated foreign array field', async () => {
      const params = getParams(
        Product.modelName,
        '-shop.customers.address.line1',
      );
      expect(params).toEqual({
        select: [],
        populate: [
          {
            path: 'shop',
            select: [],
            populate: [
              {
                path: 'customers',
                select: ['-address.line1'],
                populate: [],
              },
            ],
          },
        ],
      });
    });

    it('should exclude recursive field', async () => {
      const params = getParams(User.modelName, '-self.self.self');
      expect(params).toEqual({
        select: [],
        populate: [
          {
            path: 'self',
            select: [],
            populate: [
              {
                path: 'self',
                select: ['-self'],
                populate: [],
              },
            ],
          },
        ],
      });
    });

    it('should exclude a virtual', async () => {
      const params = getParams(Product.modelName, '-comments');
      expect(params).toEqual({
        select: ['-comments'],
        populate: [],
      });
    });

    it('should exclude a virtual nested fields', async () => {
      const params = getParams(Product.modelName, '-comments.product');
      expect(params).toEqual({
        select: [],
        populate: [
          {
            path: 'comments',
            select: ['-product'],
            populate: [],
          },
        ],
      });
    });

    it('should exclude nested ref field on array', async () => {
      const params = getParams(Shop.modelName, '-inventory.product');
      expect(params).toEqual({
        select: ['-inventory.product'],
        populate: [],
      });
    });

    describe('wildcards', () => {
      it('should allow trailing wildcards in exclude', async () => {
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
        const params = getParams(User.modelName, [
          '-name*',
          '-deep.deep.name*',
        ]);
        expect(params).toEqual({
          select: [
            '-name1',
            '-name2',
            '-nameFirst',
            '-nameLast',
            '-deep.deep.name1',
            '-deep.deep.name2',
          ],
          populate: [],
        });
      });

      it('should allow leading wildcards in excludes', async () => {
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
        const params = getParams(User.modelName, [
          '-*Name',
          '-deep.deep.*Name',
        ]);
        expect(params).toEqual({
          select: [
            '-fName',
            '-FName',
            '-firstName',
            '-lastName',
            '-deep.deep.fName',
            '-deep.deep.FName',
            '-deep.deep.firstName',
            '-deep.deep.lastName',
          ],
          populate: [],
        });
      });

      it('should not choke on recursion', async () => {
        const params = getParams(User.modelName, '-**');
        expect(params).toEqual({
          select: [
            '-name',
            '-email',
            '-tags',
            '-address.line1',
            '-address.line2',
            '-likedProducts',
            '-self',
            '-createdAt',
            '-updatedAt',
            '-deletedAt',
            '-deleted',
          ],
          populate: [],
        });
      });

      it('should allow wildcards across deep paths', async () => {
        const params = getParams(Product.modelName, '-shop.**');
        expect(params).toEqual({
          select: [],
          populate: [
            {
              path: 'shop',
              select: [
                '-name',
                '-email',
                '-tags',
                '-user',
                '-customers',
                '-inventory.quantity',
                '-inventory.product',
                '-deep.user',
                '-createdAt',
                '-updatedAt',
                '-deletedAt',
                '-deleted',
              ],
              populate: [],
            },
          ],
        });
      });
    });
  });

  describe('other', () => {
    it('should throw an error on unknown path', async () => {
      expect(() => {
        getParams(User.modelName, 'name.foo');
      }).toThrow(`Unknown path on ${User.modelName}: name.foo.`);
    });

    it('should error on massive recursion', async () => {
      const include = 'self'.repeat(6).match(/.{4}/g).join('.');
      expect(() => {
        getParams(User.modelName, include);
      }).toThrow('Cannot populate more than 5 levels.');
    });
  });
});

describe('getDocumentParams', () => {
  describe('basic', () => {
    it('should not populate fields that have already been populated', async () => {
      const user = await User.create({
        name: 'Bob',
      });
      const shop = await Shop.create({
        name: 'foo',
        user,
      });

      const params = getDocumentParams(shop, 'user');
      expect(params).toEqual({
        select: [],
        populate: [],
      });
    });

    it('should populate fields that have not been populated', async () => {
      const user = await User.create({
        name: 'Bob',
      });
      const shop = await Shop.create({
        name: 'foo',
        user: user.id,
      });

      const params = getDocumentParams(shop, 'user');
      expect(params).toEqual({
        select: [],
        populate: [
          {
            path: 'user',
            populate: [],
            select: [],
          },
        ],
      });
    });

    it('should have correct populates for array population', async () => {
      let shop;

      const user1 = await User.create({
        name: 'Bob',
      });
      const user2 = await User.create({
        name: 'Jake',
      });

      shop = await Shop.create({
        name: 'foo',
        customers: [user1.id, user2.id],
      });

      expect(getDocumentParams(shop, 'customers')).toEqual({
        select: [],
        populate: [
          {
            path: 'customers',
            populate: [],
            select: [],
          },
        ],
      });

      shop = await Shop.create({
        name: 'foo',
        customers: [user1, user2.id],
      });

      expect(getDocumentParams(shop, 'customers')).toEqual({
        select: [],
        populate: [
          {
            path: 'customers',
            populate: [],
            select: [],
          },
        ],
      });

      shop = await Shop.create({
        name: 'foo',
        customers: [user1, user2],
      });

      expect(getDocumentParams(shop, 'customers')).toEqual({
        select: [],
        populate: [],
      });
    });
  });

  describe('complex', () => {
    it('should be correct for populated inner', async () => {
      const user = await User.create({
        name: 'Bob',
      });

      const shop = await Shop.create({
        name: 'foo',
        user,
      });

      const product = await Product.create({
        name: 'Product',
        shop,
      });

      expect(getDocumentParams(product, 'shop.user')).toEqual({
        select: [],
        populate: [],
      });
    });

    it('should be correct for non-populated inner', async () => {
      const user = await User.create({
        name: 'Bob',
      });

      const shop = await Shop.create({
        name: 'foo',
        user: user.id,
      });

      const product = await Product.create({
        name: 'Product',
        shop,
      });

      expect(getDocumentParams(product, 'shop.user')).toEqual({
        select: [],
        populate: [
          {
            path: 'shop',
            populate: [
              {
                path: 'user',
                populate: [],
                select: [],
              },
            ],
            select: [],
          },
        ],
      });
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

  it('should not fail if nothing passed', async () => {
    const user = await User.create({
      name: 'Bob',
    });
    let shop = await Shop.create({
      name: 'foo',
      user: user.id,
    });

    shop = await Shop.findById(shop.id).include(undefined);
    expect(shop.user).toBeInstanceOf(Types.ObjectId);
  });

  it('should disregard include in exists', async () => {
    const user = await User.create({
      name: 'Bob',
    });
    let shop = await Shop.create({
      name: 'foo',
      user: user.id,
    });

    const found = await Shop.exists({
      name: 'foo',
      include: 'user',
    });

    expect(found._id.toString()).toBe(shop.id);
  });
});

describe('instance methods', () => {
  describe('include', () => {
    it('should have include method that performs a populate', async () => {
      const user = await User.create({
        name: 'Bob',
      });
      const shop = await Shop.create({
        name: 'foo',
        user: user.id,
      });
      await shop.include('user');
      expect(shop.user.name).toBe('Bob');
    });

    it('should allow a set', async () => {
      const user = await User.create({
        name: 'Bob',
      });
      const shop = await Shop.create({
        name: 'foo',
        user: user.id,
      });
      const includes = new Set();
      includes.add('user');
      await shop.include(includes);
      expect(shop.user.name).toBe('Bob');
    });

    it('should perform no actions if passed undefined', async () => {
      const user = await User.create({
        name: 'Bob',
      });
      const shop = await Shop.create({
        name: 'foo',
        user: user.id,
      });
      await shop.include(undefined);
      expect(shop.user.name).toBeUndefined();
    });

    it('should functionally perform a select on serialize', async () => {
      const user = await User.create({
        name: 'Bob',
        email: 'bob@bar.com',
      });
      await user.include('^name');
      expect(user.toObject().email).toBeUndefined();
    });

    it('should not refresh if already populated', async () => {
      const user = await User.create({
        name: 'Bob',
      });
      const shop = await Shop.create({
        name: 'foo',
        user,
      });

      await user.updateOne({
        name: 'Jack',
      });

      await shop.include('user');
      expect(shop.user.name).toBe('Bob');
    });

    it('should force refresh even if already populated', async () => {
      const user = await User.create({
        name: 'Bob',
      });
      const shop = await Shop.create({
        name: 'foo',
        user,
      });

      await user.updateOne({
        name: 'Jack',
      });

      await shop.include('user', {
        force: true,
      });

      expect(shop.user.name).toBe('Jack');
    });
  });
});

describe('static methods', () => {
  describe('createWithInclude', () => {
    it('should include after create', async () => {
      const user = await User.create({
        name: 'Bob',
      });
      const shop = await Shop.createWithInclude({
        name: 'foo',
        user: user.id,
        include: ['user'],
      });
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
      const product = await Product.createWithInclude({
        name: 'Product',
        shop: shop.id,
        include: ['^name', 'shop.user'],
      });
      const params = JSON.parse(JSON.stringify(product));
      expect(params).toEqual({
        id: product.id,
        name: 'Product',
        shop: {
          id: shop.id,
          name: 'Shop',
          tags: [],
          customers: [],
          inventory: [],
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
      const shop = await Shop.createWithInclude({
        name: 'foo',
        email: 'foo@bar.com',
        user: user.id,
        include: ['^name', '^user'],
      });
      const params = JSON.parse(JSON.stringify(shop));
      expect(params).toEqual({
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
      const user = await User.createWithInclude({
        name: 'Bob',
        email: 'foo@bar.com',
        tags: ['a', 'b', 'c'],
        include: ['-name', '-tags'],
      });
      const params = JSON.parse(JSON.stringify(user));
      expect(params).toEqual({
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
      const shop = await Shop.createWithInclude({
        name: 'Shop',
        email: 'shop@bar.com',
        user: user.id,
        include: ['-name', '-user'],
      });
      const params = JSON.parse(JSON.stringify(shop));
      expect(params).toEqual({
        id: shop.id,
        email: 'shop@bar.com',
        tags: [],
        customers: [],
        inventory: [],
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
      const shop = await Shop.createWithInclude({
        name: 'Shop',
        user: user.id,
        include: ['user', '-user.name', '-user.address.line1'],
      });
      const params = JSON.parse(JSON.stringify(shop));
      expect(params).toEqual({
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
        inventory: [],
        createdAt: shop.createdAt.toISOString(),
        updatedAt: shop.updatedAt.toISOString(),
      });
    });
  });

  describe('assignWithInclude', () => {
    it('should include after save assign', async () => {
      const user = await User.create({
        name: 'Bob',
      });
      const shop = new Shop({
        name: 'foo',
      });
      shop.assignWithInclude({
        user: user.id,
        include: 'user',
      });
      await shop.save();
      expect(shop.user.name).toBe('Bob');
    });

    it('should include on an unmodified path', async () => {
      const user = await User.create({
        name: 'Bob',
      });
      const shop = new Shop({
        user: user.id,
      });
      shop.assignWithInclude({
        name: 'Jack',
        include: 'user',
      });
      await shop.save();
      expect(shop.user.name).toBe('Bob');
    });

    it('should virtually project fields on an updated document', async () => {
      const user = await User.create({
        name: 'Bob',
        email: 'bob@bar.com',
      });

      const shop = new Shop({
        user: user.id,
      });

      shop.assignWithInclude({
        name: 'Jack',
        email: 'foo@bar.com',
        include: ['^name', '^user'],
      });

      await shop.save();

      const params = JSON.parse(JSON.stringify(shop));
      expect(params).toEqual({
        id: shop.id,
        name: 'Jack',
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

describe('search integration', () => {
  it('should allow include field in search', async () => {
    const user = await User.create({
      name: 'Bob',
    });
    await Shop.create({
      name: 'foo',
      user: user.id,
    });

    const { data } = await Shop.search({
      name: 'foo',
      include: 'user',
    });
    expect(data.length).toBe(1);
    expect(data[0].user.name).toBe('Bob');
  });

  it('should allow exclusion in search', async () => {
    const user = await User.create({
      name: 'Bob',
      email: 'bob@bob.com',
    });
    const shop = await Shop.create({
      name: 'foo',
      email: 'shop@shop.com',
      user: user.id,
    });

    const { data } = await Shop.search({
      name: 'foo',
      include: '^user.name',
    });
    expect(data.length).toBe(1);
    expect(data[0].toObject()).toEqual({
      id: shop.id,
      user: {
        id: user.id,
        name: 'Bob',
      },
    });
  });

  it('should allow include field as array in search', async () => {
    const user = await User.create({
      name: 'Bob',
    });
    await Shop.create({
      name: 'foo',
      user: user.id,
    });

    const { data } = await Shop.search({
      name: 'foo',
      include: ['user'],
    });
    expect(data.length).toBe(1);
    expect(data[0].user.name).toBe('Bob');
  });

  it('should allow include field as set in search', async () => {
    const include = new Set();
    include.add('user');

    const user = await User.create({
      name: 'Bob',
    });
    await Shop.create({
      name: 'foo',
      user: user.id,
    });

    const { data } = await Shop.search({
      name: 'foo',
      include,
    });
    expect(data.length).toBe(1);
    expect(data[0].user.name).toBe('Bob');
  });

  it('should report appropriate totals with include', async () => {
    const user = await User.create({
      name: 'Bob',
    });
    await Shop.create({
      name: 'foo',
      user: user.id,
    });

    const { meta } = await Shop.search({
      name: 'foo',
      include: 'user',
    });
    expect(meta.total).toBe(1);
  });
});

describe('validation integration', () => {
  describe('getCreateValidation', () => {
    it('should not have include by default', async () => {
      const schema = Shop.getCreateValidation();
      await expect(async () => {
        await schema.validate({
          name: 'foo',
          include: 'user',
        });
      }).rejects.toThrow();
    });

    it('should optionally allow include', async () => {
      const schema = Shop.getCreateValidation({
        allowInclude: true,
      });
      const result = await schema.validate({
        name: 'foo',
        include: 'user',
      });
      expect(result).toMatchObject({
        name: 'foo',
        include: 'user',
      });
    });

    it('should allow include as array', async () => {
      const schema = Shop.getCreateValidation({
        allowInclude: true,
      });
      const result = await schema.validate({
        name: 'foo',
        include: ['user'],
      });
      expect(result).toMatchObject({
        name: 'foo',
        include: ['user'],
      });
    });
  });

  describe('getUpdateValidation', () => {
    it('should not have include by default', async () => {
      const schema = Shop.getUpdateValidation();
      const result = await schema.validate({
        name: 'foo',
        include: ['user'],
      });
      expect(result).toMatchObject({
        name: 'foo',
      });
    });

    it('should optionally allow includes', async () => {
      const schema = Shop.getUpdateValidation({
        allowInclude: true,
      });
      const result = await schema.validate({
        name: 'foo',
        include: ['user'],
      });
      expect(result).toMatchObject({
        name: 'foo',
        include: ['user'],
      });
    });
  });

  describe('getSearchValidation', () => {
    it('should allow include as string', async () => {
      const schema = Shop.getSearchValidation();
      const result = await schema.validate({
        name: 'foo',
        include: 'user',
      });
      expect(result).toMatchObject({
        name: 'foo',
        include: 'user',
      });
    });

    it('should allow include as array', async () => {
      const schema = Shop.getSearchValidation();
      const result = await schema.validate({
        name: 'foo',
        include: ['user'],
      });
      expect(result).toMatchObject({
        name: 'foo',
        include: ['user'],
      });
    });
  });

  describe('getIncludeValidation', () => {
    it('should allow include as string', async () => {
      const schema = Shop.getIncludeValidation();
      const result = await schema.validate({
        include: 'user',
      });
      expect(result).toMatchObject({
        include: 'user',
      });
    });

    it('should allow include as array', async () => {
      const schema = Shop.getSearchValidation();
      const result = await schema.validate({
        include: ['user'],
      });
      expect(result).toMatchObject({
        include: ['user'],
      });
    });
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

  it('should not interfere with countDocuments', async () => {
    const user = await User.create({
      name: 'Bob',
    });
    await Shop.create({
      name: 'foo',
      user: user.id,
    });

    const count = await Shop.countDocuments({
      name: 'foo',
      include: 'user',
    });

    expect(count).toBe(1);
  });

  it('should not interfere with estimatedDocumentCount', async () => {
    const user = await User.create({
      name: 'Bob',
    });
    await Shop.create({
      name: 'foo',
      user: user.id,
    });

    const count = await Shop.estimatedDocumentCount({
      name: 'foo',
      include: 'user',
    });

    expect(count).toBeGreaterThan(0);
  });

  it('should not fail on including a getter virtual', async () => {
    const schema = createSchema({
      attributes: {
        firstName: 'String',
        lastName: 'String',
      },
    });
    schema.virtual('name').get(function () {
      return [this.firstName, this.lastName].join(' ');
    });
    const User = await createTestModel(schema);
    let user = await User.create({
      firstName: 'Frank',
      lastName: 'Reynolds',
    });

    // Document includes
    await user.include('name');
    expect(user.name).toBe('Frank Reynolds');

    // Query includes
    user = await User.findById(user.id).include('name');
    expect(user.name).toBe('Frank Reynolds');
  });
});
