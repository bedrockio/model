import mongoose from 'mongoose';

import { createSchema } from '../src/schema';
import { createTestModel, createSchemaFromAttributes } from '../src/testing';

describe('search', () => {
  it('should search on name', async () => {
    const User = createTestModel({
      name: {
        type: 'String',
        required: true,
      },
    });
    await Promise.all([
      User.create({ name: 'Billy' }),
      User.create({ name: 'Willy' }),
    ]);
    const { data, meta } = await User.search({ name: 'Billy' });
    expect(data).toMatchObject([{ name: 'Billy' }]);
    expect(meta).toEqual({
      total: 1,
      limit: 50,
      skip: 0,
    });
  });

  it('should search on name as a keyword', async () => {
    const schema = createSchemaFromAttributes({
      name: {
        type: 'String',
        required: true,
      },
    });
    schema.index({
      name: 'text',
    });
    const User = createTestModel(schema);
    await User.createIndexes();
    await Promise.all([
      User.create({ name: 'Billy' }),
      User.create({ name: 'Willy' }),
    ]);
    const { data, meta } = await User.search({ keyword: 'billy' });
    expect(data).toMatchObject([{ name: 'Billy' }]);
    expect(meta.total).toBe(1);
  });

  it('should allow partial text match when search fields are defined', async () => {
    let result;
    const schema = createSchema({
      attributes: {
        name: {
          type: 'String',
          required: true,
        },
      },
      search: {
        fields: ['name'],
      },
    });
    schema.index({
      name: 'text',
    });
    const User = createTestModel(schema);
    await Promise.all([
      User.create({ name: 'Billy' }),
      User.create({ name: 'Willy' }),
    ]);

    result = await User.search({
      keyword: 'bil',
      sort: {
        field: 'name',
        order: 'asc',
      },
    });
    expect(result.data).toMatchObject([{ name: 'Billy' }]);
    expect(result.meta.total).toBe(1);

    result = await User.search({
      keyword: 'lly',
      sort: {
        field: 'name',
        order: 'asc',
      },
    });
    expect(result.data).toMatchObject([{ name: 'Billy' }, { name: 'Willy' }]);
    expect(result.meta.total).toBe(2);
  });

  it('should allow partial text match on multiple fields', async () => {
    let result;
    const schema = createSchema({
      attributes: {
        name: {
          type: 'String',
          required: true,
        },
        role: {
          type: 'String',
          required: true,
        },
      },
      search: {
        fields: ['name', 'role'],
      },
    });
    schema.index({
      name: 'text',
    });
    const User = createTestModel(schema);
    await Promise.all([
      User.create({ name: 'Billy', role: 'user' }),
      User.create({ name: 'Willy', role: 'manager' }),
    ]);

    result = await User.search({ keyword: 'use' });
    expect(result.data).toMatchObject([{ name: 'Billy', role: 'user' }]);
    expect(result.meta.total).toBe(1);

    result = await User.search({ keyword: 'man' });
    expect(result.data).toMatchObject([{ name: 'Willy', role: 'manager' }]);
    expect(result.meta.total).toBe(1);
  });

  it('should allow id search with partial text match', async () => {
    let result;
    const schema = createSchema({
      attributes: {
        name: {
          type: 'String',
          required: true,
        },
      },
      search: {
        fields: ['name'],
      },
    });
    const User = createTestModel(schema);
    const [billy] = await Promise.all([
      User.create({ name: 'Billy', role: 'user' }),
      User.create({ name: 'Willy', role: 'manager' }),
    ]);

    result = await User.search({ keyword: billy.id });
    expect(result.data).toMatchObject([{ name: 'Billy' }]);
    expect(result.meta.total).toBe(1);
  });

  it('should search on an array field', async () => {
    const User = createTestModel({
      order: 'Number',
      categories: ['String'],
    });
    const [user1, user2] = await Promise.all([
      User.create({ order: 1, categories: ['owner', 'member'] }),
      User.create({ order: 2, categories: ['owner'] }),
    ]);

    let result;
    result = await User.search({
      categories: ['member'],
    });
    expect(result.data).toMatchObject([{ id: user1.id }]);
    expect(result.meta.total).toBe(1);

    result = await User.search({
      categories: ['owner'],
      sort: {
        field: 'order',
        order: 'asc',
      },
    });
    expect(result.data).toMatchObject([{ id: user1.id }, { id: user2.id }]);
    expect(result.meta.total).toBe(2);
  });

  it('should allow shorthand for a regex query', async () => {
    const User = createTestModel({
      name: 'String',
    });
    await Promise.all([
      User.create({ name: 'Willy' }),
      User.create({ name: 'Billy' }),
    ]);

    let result;

    result = await User.search({
      name: '/bi/i',
    });
    expect(result.data).toMatchObject([{ name: 'Billy' }]);
    expect(result.meta.total).toBe(1);
  });

  it('should behave like $in when empty array passed', async () => {
    const User = createTestModel({
      categories: ['String'],
    });
    await Promise.all([
      User.create({ categories: ['owner', 'member'] }),
      User.create({ categories: ['owner'] }),
    ]);

    const result = await User.search({
      categories: [],
    });
    expect(result.data).toMatchObject([]);
    expect(result.meta.total).toBe(0);
  });

  it('should perform a search on a nested field', async () => {
    const User = createTestModel({
      order: 'Number',
      roles: [
        {
          role: {
            type: 'String',
            required: true,
          },
          scope: {
            type: 'String',
            required: true,
          },
        },
      ],
    });
    const [user1, user2] = await Promise.all([
      User.create({
        order: 1,
        roles: [
          { role: 'owner', scope: 'global' },
          { role: 'member', scope: 'global' },
        ],
      }),
      User.create({
        order: 2,
        roles: [{ role: 'member', scope: 'global' }],
      }),
    ]);

    let result;

    result = await User.search({
      roles: {
        role: 'member',
      },
      sort: {
        field: 'order',
        order: 'asc',
      },
    });
    expect(result.data).toMatchObject([{ id: user1.id }, { id: user2.id }]);
    expect(result.meta.total).toBe(2);

    result = await User.search({
      roles: {
        role: ['owner', 'member'],
      },
      sort: {
        field: 'order',
        order: 'asc',
      },
    });
    expect(result.data).toMatchObject([{ id: user1.id }, { id: user2.id }]);
    expect(result.meta.total).toBe(2);

    result = await User.search({
      roles: {
        role: ['owner'],
      },
      sort: {
        field: 'order',
        order: 'asc',
      },
    });
    expect(result.data).toMatchObject([{ id: user1.id }]);
    expect(result.meta.total).toBe(1);
  });

  it('should perform a search on a complex nested field', async () => {
    const User = createTestModel({
      name: 'String',
      profile: {
        roles: [
          {
            role: {
              functions: ['String'],
            },
          },
        ],
      },
    });
    await Promise.all([
      User.create({
        name: 'Bob',
        profile: {
          roles: [
            {
              role: {
                functions: ['owner', 'spectator'],
              },
            },
          ],
        },
      }),
      User.create({
        name: 'Fred',
        profile: {
          roles: [
            {
              role: {
                functions: ['manager', 'spectator'],
              },
            },
          ],
        },
      }),
    ]);

    let result;
    result = await User.search({
      profile: {
        roles: {
          role: {
            functions: ['owner'],
          },
        },
      },
    });
    expect(result.data).toMatchObject([
      {
        name: 'Bob',
      },
    ]);
  });

  it('should mixin operator queries', async () => {
    let result;

    const User = createTestModel({
      name: 'String',
      age: 'Number',
    });
    await Promise.all([
      User.create({ name: 'Billy', age: 20 }),
      User.create({ name: 'Willy', age: 32 }),
      User.create({ name: 'Chilly', age: 10 }),
    ]);

    result = await User.search({
      $or: [{ name: 'Billy' }, { age: 10 }],
      sort: {
        field: 'name',
        order: 'asc',
      },
    });
    expect(result.data).toMatchObject([
      { name: 'Billy', age: 20 },
      { name: 'Chilly', age: 10 },
    ]);

    result = await User.search({
      name: { $ne: 'Billy' },
      sort: {
        field: 'name',
        order: 'asc',
      },
    });
    expect(result.data).toMatchObject([
      { name: 'Chilly', age: 10 },
      { name: 'Willy', age: 32 },
    ]);
  });

  it('should mixin nested operator queries', async () => {
    const User = createTestModel({
      name: 'String',
    });
    await Promise.all([
      User.create({ name: 'Billy' }),
      User.create({ name: 'Willy' }),
    ]);
    const { data, meta } = await User.search({ name: { $ne: 'Billy' } });
    expect(data).toMatchObject([
      {
        name: 'Willy',
      },
    ]);
    expect(meta).toEqual({
      total: 1,
      limit: 50,
      skip: 0,
    });
  });

  it('should allow custom dot path in query', async () => {
    const User = createTestModel({
      roles: [
        {
          role: {
            type: 'String',
            required: true,
          },
          scope: {
            type: 'String',
            required: true,
          },
          scopeRef: {
            type: 'ObjectId',
            ref: 'Organization',
          },
        },
      ],
    });
    const ref1 = mongoose.Types.ObjectId();
    const ref2 = mongoose.Types.ObjectId();

    await User.create(
      {
        roles: [
          {
            role: 'admin',
            scope: 'organization',
            scopeRef: ref1,
          },
        ],
      },
      {
        roles: [
          {
            role: 'admin',
            scope: 'organization',
            scopeRef: ref2,
          },
        ],
      }
    );
    const { data } = await User.search({
      'roles.scope': 'organization',
      'roles.scopeRef': ref1,
    });

    expect(data.length).toBe(1);
  });

  it('should allow date range search', async () => {
    let result;
    const schema = createSchemaFromAttributes({
      name: 'String',
      archivedAt: 'Date',
    });
    const User = createTestModel(schema);
    await Promise.all([
      User.create({ name: 'Billy', archivedAt: '2020-01-01' }),
      User.create({ name: 'Willy', archivedAt: '2021-01-01' }),
    ]);

    result = await User.search({ archivedAt: { lte: '2020-06-01' } });
    expect(result.data).toMatchObject([{ name: 'Billy' }]);
    expect(result.meta.total).toBe(1);

    result = await User.search({ archivedAt: { gte: '2020-06-01' } });
    expect(result.data).toMatchObject([{ name: 'Willy' }]);
    expect(result.meta.total).toBe(1);

    result = await User.search({
      archivedAt: { gte: '2019-06-01' },
      sort: {
        field: 'name',
        order: 'asc',
      },
    });
    expect(result.data).toMatchObject([{ name: 'Billy' }, { name: 'Willy' }]);
    expect(result.meta.total).toBe(2);

    result = await User.search({
      archivedAt: {},
      sort: {
        field: 'name',
        order: 'asc',
      },
    });
    expect(result.data).toMatchObject([{ name: 'Billy' }, { name: 'Willy' }]);
    expect(result.meta.total).toBe(2);
  });

  it('should allow date range search on dot path', async () => {
    let result;
    const schema = createSchemaFromAttributes({
      user: {
        name: 'String',
        archivedAt: 'Date',
      },
    });
    const User = createTestModel(schema);
    await Promise.all([
      User.create({ user: { name: 'Billy', archivedAt: '2020-01-01' } }),
      User.create({ user: { name: 'Willy', archivedAt: '2021-01-01' } }),
    ]);

    result = await User.search({ 'user.archivedAt': { lte: '2020-06-01' } });
    expect(result.data).toMatchObject([{ user: { name: 'Billy' } }]);
    expect(result.meta.total).toBe(1);
  });

  it('should allow number range search', async () => {
    let result;
    const schema = createSchemaFromAttributes({
      name: 'String',
      age: 'Number',
    });
    const User = createTestModel(schema);
    await Promise.all([
      User.create({ name: 'Billy', age: 22 }),
      User.create({ name: 'Willy', age: 54 }),
    ]);

    result = await User.search({ age: { lte: 25 } });
    expect(result.data).toMatchObject([{ name: 'Billy' }]);
    expect(result.meta.total).toBe(1);

    result = await User.search({ age: { gte: 25 } });
    expect(result.data).toMatchObject([{ name: 'Willy' }]);
    expect(result.meta.total).toBe(1);

    result = await User.search({
      age: { gte: 10 },
      sort: {
        field: 'name',
        order: 'asc',
      },
    });
    expect(result.data).toMatchObject([{ name: 'Billy' }, { name: 'Willy' }]);
    expect(result.meta.total).toBe(2);

    result = await User.search({
      age: {},
      sort: {
        field: 'name',
        order: 'asc',
      },
    });
    expect(result.data).toMatchObject([{ name: 'Billy' }, { name: 'Willy' }]);
    expect(result.meta.total).toBe(2);
  });

  it('should return the query to allow population', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const Shop = createTestModel({
      user: {
        ref: User.modelName,
        type: mongoose.Schema.Types.ObjectId,
      },
    });

    const user = await User.create({ name: 'Billy' });
    await Shop.create({
      user: user.id,
    });

    const { data, meta } = await Shop.search().populate('user');

    expect(data).toMatchObject([{ user: { name: 'Billy' } }]);
    expect(meta).toEqual({
      total: 1,
      limit: 50,
      skip: 0,
    });
  });

  it('should error on bad queries', async () => {
    const User = createTestModel({
      name: 'String',
    });
    await expect(async () => {
      await User.search({ _id: 'bad' });
    }).rejects.toThrow();
  });

  it('should allow model-level override of search defaults', async () => {
    const schema = createSchema({
      attributes: {
        name: {
          type: 'String',
          required: true,
        },
      },
      search: {
        limit: 2,
        sort: {
          field: 'name',
          order: 'asc',
        },
      },
    });
    const User = createTestModel(schema);
    await Promise.all([
      User.create({ name: 'Welly' }),
      User.create({ name: 'Willy' }),
      User.create({ name: 'Chilly' }),
      User.create({ name: 'Smelly' }),
      User.create({ name: 'Billy' }),
    ]);
    const { data, meta } = await User.search();
    expect(data).toMatchObject([{ name: 'Billy' }, { name: 'Chilly' }]);
    expect(data.length).toBe(2);
    expect(meta.total).toBe(5);
  });

  it('should allow sorting on multiple fields', async () => {
    const User = createTestModel({
      name: 'String',
      age: 'Number',
    });
    await Promise.all([
      User.create({ name: 'Billy', age: 5 }),
      User.create({ name: 'Billy', age: 6 }),
      User.create({ name: 'Willy', age: 7 }),
      User.create({ name: 'Willy', age: 8 }),
    ]);

    const result = await User.search({
      sort: [
        {
          field: 'name',
          order: 'asc',
        },
        {
          field: 'age',
          order: 'desc',
        },
      ],
    });
    expect(result.data).toMatchObject([
      {
        name: 'Billy',
        age: 6,
      },
      {
        name: 'Billy',
        age: 5,
      },
      {
        name: 'Willy',
        age: 8,
      },
      {
        name: 'Willy',
        age: 7,
      },
    ]);
  });
});
