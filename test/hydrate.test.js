import { createTestModel } from '../src/testing';

describe('hydrate', () => {
  it('should not over hydrate', async () => {
    const User = createTestModel({
      name: 'String',
      tags: ['String'],
      profile: {
        address: 'String',
        zipcode: 'String',
      },
    });

    const user = User.hydrate({
      _id: '65ad77bdb5fa7c9a0e1f8d61',
      tags: ['foo', 'bar'],
      bad: 'bad!',
      profile: {
        address: '3008 Chestnut St, Philadelphia',
        zipcode: '19106',
        bad: 'bad!',
      },
      createdAt: '2024-06-28T00:00:00.000Z',
      updatedAt: '2024-06-28T00:00:00.000Z',
      deletedAt: '2024-06-28T00:00:00.000Z',
      deleted: false,
      __v: 2,
    });

    expect(user.toObject()).toEqual({
      id: '65ad77bdb5fa7c9a0e1f8d61',
      tags: ['foo', 'bar'],
      profile: {
        address: '3008 Chestnut St, Philadelphia',
        zipcode: '19106',
      },
      createdAt: new Date('2024-06-28T00:00:00.000Z'),
      updatedAt: new Date('2024-06-28T00:00:00.000Z'),
      deletedAt: new Date('2024-06-28T00:00:00.000Z'),
    });
  });
});
