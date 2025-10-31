import { Upload, User } from './mocks';

describe('export', () => {
  it('should export schema fields', async () => {
    const user = await User.create({
      name: 'Frank Reynolds',
      profile: {
        url: 'test url',
      },
      roles: [
        {
          role: 'admin',
        },
      ],
      tags: [],
      friends: [],
      likedProducts: [],
      hidden: 'hidden',
    });

    expect(user.export()).toEqual({
      name: 'Frank Reynolds',
      profile: {
        url: 'test url',
      },
      roles: [
        {
          role: 'admin',
          id: user.roles[0].id,
          _id: user.roles[0]._id,
        },
      ],
      tags: [],
      friends: [],
      likedProducts: [],
      hidden: 'hidden',
      deleted: false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      _id: user._id,
      __v: 0,
    });
  });

  it('should not include undefined fields', async () => {
    const user = await User.create({
      name: 'Frank Reynolds',
    });

    expect(user.export()).toEqual({
      name: 'Frank Reynolds',
      tags: [],
      roles: [],
      friends: [],
      likedProducts: [],
      deleted: false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      _id: user._id,
      __v: 0,
    });
  });

  it('should export unpopulated reference fields as ObjectIds', async () => {
    const upload = await Upload.create({});

    const user = await User.create({
      name: 'Frank Reynolds',
      image: upload._id,
    });

    expect(user.export()).toEqual({
      name: 'Frank Reynolds',
      image: upload._id,
      tags: [],
      roles: [],
      friends: [],
      likedProducts: [],
      deleted: false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      _id: user._id,
      __v: 0,
    });
  });

  it('should export populated reference fields as full documents', async () => {
    const upload = await Upload.create({});

    const user = await User.create({
      name: 'Frank Reynolds',
      image: upload.id,
    });

    await user.populate('image');

    expect(user.export()).toEqual({
      name: 'Frank Reynolds',
      image: upload,
      tags: [],
      roles: [],
      friends: [],
      likedProducts: [],
      deleted: false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      _id: user._id,
      __v: 0,
    });
  });
});
