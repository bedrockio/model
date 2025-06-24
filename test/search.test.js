import mongoose from 'mongoose';

import { createSchema } from '../src/schema';
import { createTestModel } from '../src/testing';

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

  it('should search on any in an array field', async () => {
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

  it('should not match an empty array field', async () => {
    const User = createTestModel({
      order: 'Number',
      categories: ['String'],
    });

    await User.create({
      order: 1,
      categories: [],
    });

    await User.create({
      order: 2,
      categories: ['owner'],
    });

    const result = await User.search({
      categories: [],
    });
    expect(result.meta.total).toBe(0);
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
    const ref1 = new mongoose.Types.ObjectId();
    const ref2 = new mongoose.Types.ObjectId();

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
      },
    );
    const { data } = await User.search({
      'roles.scope': 'organization',
      'roles.scopeRef': ref1,
    });

    expect(data.length).toBe(1);
  });

  it('should return the query to allow population', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const Shop = createTestModel({
      user: {
        type: 'ObjectId',
        ref: User.modelName,
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

  it('should error on unknown sort field', async () => {
    const User = createTestModel({
      name: 'String',
    });
    expect(() => {
      User.search({
        sort: {
          field: 'foo',
          order: 'asc',
        },
      });
    }).toThrow('Unknown sort field "foo".');
  });

  it('should error on incorrect sort format', async () => {
    const User = createTestModel({
      name: 'String',
    });
    expect(() => {
      User.search({
        sort: {
          name: 'foo',
          order: 'asc',
        },
      });
    }).toThrow('Sort property "name" is not allowed. Use "field" instead.');
  });

  it('should not error on null sort field', async () => {
    const User = createTestModel({
      name: 'String',
    });
    await User.create({
      name: 'foo',
    });
    await User.create({
      name: 'bar',
    });
    const users = await User.search({
      sort: null,
    });
    expect(users.data.length).toBe(2);
  });

  it('should error if foreign fields referenced', async () => {
    const User = createTestModel({
      firstName: 'String',
      lastName: 'String',
    });
    expect(() => {
      createSchema({
        attributes: {
          user: {
            type: 'ObjectId',
            ref: User.modelName,
          },
        },
        search: {
          fields: ['user.firstName', 'user.lastName'],
        },
      });
    }).toThrow('Foreign field "user.firstName" not allowed in search.');
  });

  describe('ranges', () => {
    it('should allow date range search', async () => {
      let result;
      const User = createTestModel({
        name: 'String',
        archivedAt: 'Date',
      });
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
      const User = createTestModel({
        user: {
          name: 'String',
          archivedAt: 'Date',
        },
      });
      await Promise.all([
        User.create({ user: { name: 'Billy', archivedAt: '2020-01-01' } }),
        User.create({ user: { name: 'Willy', archivedAt: '2021-01-01' } }),
      ]);

      result = await User.search({ 'user.archivedAt': { lte: '2020-06-01' } });
      expect(result.data).toMatchObject([{ user: { name: 'Billy' } }]);
      expect(result.meta.total).toBe(1);
    });

    it('should still allow a date range query with mongo operators', async () => {
      let result;
      const User = createTestModel({
        name: 'String',
        archivedAt: 'Date',
      });
      await Promise.all([
        User.create({ name: 'Billy', archivedAt: '2020-01-01' }),
        User.create({ name: 'Willy', archivedAt: '2021-01-01' }),
      ]);

      result = await User.search({ archivedAt: { $lte: '2020-06-01' } });
      expect(result.data).toMatchObject([{ name: 'Billy' }]);
      expect(result.meta.total).toBe(1);
    });

    it('should allow number range search', async () => {
      let result;
      const User = createTestModel({
        name: 'String',
        age: 'Number',
      });
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

    it('should allow string range search', async () => {
      let result;
      const User = createTestModel({
        name: 'String',
      });
      await Promise.all([
        User.create({ name: 'Billy' }),
        User.create({ name: 'Willy' }),
      ]);

      result = await User.search({ name: { gte: 'Billy' } });
      expect(result.data).toMatchObject([
        {
          name: 'Billy',
        },
        {
          name: 'Willy',
        },
      ]);

      result = await User.search({ name: { gt: 'Billy' } });
      expect(result.data).toMatchObject([
        {
          name: 'Willy',
        },
      ]);
    });

    it('should perform a range search on a date-only field', async () => {
      let result;
      const User = createTestModel({
        dob: 'String',
      });
      await Promise.all([
        User.create({ dob: '2025-06-29' }),
        User.create({ dob: '2025-06-30' }),
        User.create({ dob: '2025-07-01' }),
      ]);

      result = await User.search({ dob: { gte: '2025-06-30' } });
      expect(result.data).toMatchObject([
        {
          dob: '2025-06-30',
        },
        {
          dob: '2025-07-01',
        },
      ]);

      result = await User.search({ dob: { lt: '2025-06-30' } });
      expect(result.data).toMatchObject([
        {
          dob: '2025-06-29',
        },
      ]);

      result = await User.search({ dob: { lte: '2025-06-29' } });
      expect(result.data).toMatchObject([
        {
          dob: '2025-06-29',
        },
      ]);

      result = await User.search({ dob: { lt: '2025-06-29' } });
      expect(result.data).toMatchObject([]);
    });

    it('should not perform a range-based query for a partial date', async () => {
      // This test is mostly a note that "partial date queries" as
      // a feature were considered but disregarded due to ambiguity
      // with time zones. For example the query:
      //
      // User.search({ dob: '2025-06-30' })
      //
      // could be expanded into:
      //
      // {
      //   $gte: ISODate('2025-06-30T00:00:00.000Z'),
      //   $lte: ISODate('2025-06-30T23:59:59.999Z'),
      // }
      //
      // however this would be of limited value as the expanded range
      // would be in UTC time. Also considered was providing an offset
      // in ISO-8601 format, for example `{dob: '2025-06-30+09:00' }`.
      // This also would be obtuse and inefficient as it would require
      // both knowing the offset (which is not the same thing as an
      // IANA designation) and being able to construct the format.
      //
      // Given this complexity, it is simpler to construct the range
      // object leaning on date libraries for help. For example:
      //
      // import { DateTime, Interval } from '@bedrockio/chrono';
      //
      // const dt = new DateTime('2025-06-30T00:00:00.000Z', {
      //   timeZone: 'America/New_York',
      // });
      //
      // const day = Interval.getDay(dt);
      //
      // User.search({
      //   dob: day.toQuery()
      // })

      const User = createTestModel({
        dob: 'Date',
      });
      await Promise.all([
        User.create({ dob: new Date('2025-06-30T01:00:00.000Z') }),
        User.create({ dob: new Date('2025-07-01T01:00:00.000Z') }),
      ]);

      const result = await User.search({ dob: '2025-06-30' });
      expect(result.data).toMatchObject([]);
    });
  });

  describe('null', () => {
    it('should allow null in search', async () => {
      const User = createTestModel({
        name: 'String',
        age: 'Number',
      });
      await User.create({
        name: 'foo',
        age: 24,
      });
      await User.create({
        name: 'bar',
      });
      const users = await User.search({
        age: null,
      });
      expect(users.data.length).toBe(1);
    });

    it('should allow null search on dot path', async () => {
      const User = createTestModel({
        profile: {
          name: 'String',
          age: 'Number',
        },
      });
      await User.create({
        profile: {
          name: 'foo',
          age: 24,
        },
      });
      await User.create({
        profile: {
          name: 'bar',
        },
      });

      const users = await User.search({
        'profile.age': null,
      });
      expect(users.data.length).toBe(1);
    });

    it('should search empty array fields with null', async () => {
      const User = createTestModel({
        tags: ['String'],
      });
      await User.create({
        tags: [],
      });
      await User.create({
        tags: ['foo'],
      });

      const users = await User.search({
        tags: null,
      });
      expect(users.data.length).toBe(1);
    });
  });

  describe('defaults', () => {
    it('should default to insert order', async () => {
      const User = createTestModel({
        name: 'String',
      });

      await User.create({ name: 'Billy', createdAt: '2025-03-25' });
      await User.create({ name: 'Willy', createdAt: '2025-03-26' });
      const { data } = await User.search();

      expect(data).toMatchObject([
        {
          name: 'Billy',
        },
        {
          name: 'Willy',
        },
      ]);
    });

    it('should allow reverse insert order without specifying field', async () => {
      const User = createTestModel({
        name: 'String',
      });

      await User.create({ name: 'Billy', createdAt: '2025-03-25' });
      await User.create({ name: 'Willy', createdAt: '2025-03-26' });
      const { data } = await User.search({
        sort: {
          order: 'desc',
        },
      });

      expect(data).toMatchObject([
        {
          name: 'Willy',
        },
        {
          name: 'Billy',
        },
      ]);
    });

    it('should still allow $natural sort order', async () => {
      const User = createTestModel({
        name: 'String',
      });

      await User.create({ name: 'Billy', createdAt: '2025-03-25' });
      await User.create({ name: 'Willy', createdAt: '2025-03-26' });

      const { data } = await User.search({
        sort: {
          field: '$natural',
          order: 'asc',
        },
      });

      expect(data).toMatchObject([
        {
          name: 'Billy',
        },
        {
          name: 'Willy',
        },
      ]);
    });
  });
});

describe('keyword search', () => {
  it('should search on name as a keyword', async () => {
    const User = createTestModel({
      name: {
        type: 'String',
        required: true,
      },
    });
    User.schema.index({
      name: 'text',
    });
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

  it('should error when no fields are defined', async () => {
    const User = createTestModel({
      name: {
        type: 'String',
        required: true,
      },
    });
    await Promise.all([
      User.create({ name: 'Billy', role: 'user' }),
      User.create({ name: 'Willy', role: 'manager' }),
    ]);

    await expect(async () => {
      await User.search({ keyword: 'Billy' });
    }).rejects.toThrow('Could not compose keyword query.');
  });

  it('should not error on regex tokens', async () => {
    const schema = createSchema({
      attributes: {
        name: 'String',
      },
      search: {
        fields: ['name'],
      },
    });
    const User = createTestModel(schema);

    await expect(
      User.search({
        keyword: 'billy(*$?.^|',
      }),
    ).resolves.not.toThrow();
  });

  it('should not override incoming $or query', async () => {
    const schema = createSchema({
      attributes: {
        name: 'String',
        email: 'String',
        age: 'Number',
      },
      search: {
        fields: ['name', 'email'],
      },
    });
    const User = createTestModel(schema);

    await User.create({
      name: 'Frank',
      email: 'frank@gmail.com',
      age: 15,
    });

    await User.create({
      name: 'William',
      email: 'billy-2@gmail.com',
      age: 15,
    });

    await User.create({
      name: 'Billy',
      email: 'billy@gmail.com',
      age: 20,
    });

    const { data, meta } = await User.search({
      keyword: 'billy',
      $or: [
        {
          age: 15,
        },
        {
          age: 20,
        },
      ],
      sort: {
        field: 'name',
        order: 'asc',
      },
    });
    expect(data).toMatchObject([
      {
        name: 'Billy',
        age: 20,
      },
      {
        name: 'William',
        age: 15,
      },
    ]);
    expect(meta.total).toBe(2);
  });

  it('should search on subdocument fields', async () => {
    const schema = createSchema({
      attributes: {
        address: {
          zipcode: {
            type: 'String',
          },
        },
      },
      search: {
        fields: ['address.zipcode'],
      },
    });
    const User = createTestModel(schema);

    await User.create({
      address: {
        zipcode: '80906',
      },
    });

    await User.create({
      address: {
        zipcode: '10011',
      },
    });

    const { data, meta } = await User.search({
      keyword: '10011',
    });

    expect(meta.total).toBe(1);
    expect(data).toMatchObject([
      {
        address: {
          zipcode: '10011',
        },
      },
    ]);
  });

  describe('decomposition', () => {
    it('should decompose a structured name', async () => {
      const schema = createSchema({
        attributes: {
          firstName: 'String',
          lastName: 'String',
        },
        search: {
          decompose: '{firstName} {lastName...}',
          fields: ['firstName', 'lastName'],
        },
      });

      const User = createTestModel(schema);
      const user1 = await User.create({
        firstName: 'Frank',
        lastName: 'Reynolds',
      });
      const user2 = await User.create({
        firstName: 'Maarten',
        lastName: 'Van der Weenhof',
      });

      async function assertMatch(keyword, user) {
        const { data } = await User.search({
          keyword,
        });
        expect(data[0].id).toBe(user.id);
      }

      await assertMatch('Frank Reynolds', user1);
      await assertMatch('Maarten Van', user2);
      await assertMatch('Maarten Van der', user2);
      await assertMatch('Maarten Van der Weenhof', user2);
      await assertMatch('Maar der', user2);
      await assertMatch('der Weenhof', user2);

      // Falling back to non-decomposed query
      await assertMatch('Maart', user2);
    });
  });
});

describe('aggregations', () => {
  it('should support search with aggregation pipeline', async () => {
    const User = createTestModel({
      name: 'String',
    });
    await Promise.all([
      User.create({ name: 'Billy' }),
      User.create({ name: 'Willy' }),
    ]);
    const { data, meta } = await User.search([
      {
        $match: {
          name: 'Billy',
        },
      },
    ]);

    expect(data).toMatchObject([
      {
        name: 'Billy',
      },
    ]);

    expect(meta).toEqual({
      total: 1,
      skip: 0,
      limit: 50,
    });
  });

  it('should support standard search params', async () => {
    const User = createTestModel({
      name: 'String',
    });
    await Promise.all([
      User.create({ name: 'Billy' }),
      User.create({ name: 'Willy' }),
      User.create({ name: 'Sally' }),
      User.create({ name: 'Milly' }),
      User.create({ name: 'Molly' }),
      User.create({ name: 'Polly' }),
      User.create({ name: 'Holly' }),
      User.create({ name: 'Kelly' }),
      User.create({ name: 'Nelly' }),
      User.create({ name: 'Shelly' }),
      User.create({ name: 'Dolly' }),
    ]);
    const { data, meta } = await User.search(
      [
        {
          $match: {
            name: /lly$/,
          },
        },
      ],
      {
        skip: 3,
        limit: 3,
        sort: {
          field: 'name',
          order: 'desc',
        },
      },
    );

    expect(data).toMatchObject([
      { name: 'Polly' },
      { name: 'Nelly' },
      { name: 'Molly' },
    ]);

    expect(meta).toEqual({
      total: 11,
      skip: 3,
      limit: 3,
    });
  });

  it('should not error when no results', async () => {
    const User = createTestModel({
      name: 'String',
    });
    await Promise.all([
      User.create({ name: 'Billy' }),
      User.create({ name: 'Willy' }),
    ]);
    const { data, meta } = await User.search([
      {
        $match: {
          name: 'Zilly',
        },
      },
    ]);

    expect(data).toMatchObject([]);
    expect(meta).toEqual({
      total: 0,
      skip: 0,
      limit: 50,
    });
  });
});

describe('integrations', () => {
  it('should not fail on validations', async () => {
    const schema = createSchema({
      attributes: {
        name: 'String',
      },
      search: {
        fields: ['name'],
      },
    });
    const User = createTestModel(schema);

    expect(() => {
      User.getCreateValidation();
    }).not.toThrow();

    expect(() => {
      User.getUpdateValidation();
    }).not.toThrow();

    expect(() => {
      User.getSearchValidation();
    }).not.toThrow();
  });
});
