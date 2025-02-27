import { createTestModel } from '../src/testing';

const User = createTestModel({
  name: 'String',
  email: {
    type: 'String',
    unique: true,
  },
  image: {
    type: 'ObjectId',
    ref: 'Upload',
  },
  roles: [
    {
      role: 'String',
      scope: 'String',
      scopeRef: 'String',
    },
  ],
});

const Upload = createTestModel({
  owner: {
    type: 'ObjectId',
    ref: User.modelName,
  },
});

describe('clone', () => {
  it('should not fail on a unique field', async () => {
    const user = await User.create({
      name: 'Frank Reynolds',
      email: 'foo@bar.com',
    });

    const clone = await user.clone();

    expect(clone.id).not.toBe(user.id);
    expect(clone.name).toBe(user.name);
    expect(clone.email).toBe('foo1@bar.com');
  });

  it('should not fail on a populated document', async () => {
    const user = await User.create({
      name: 'Frank Reynolds',
    });

    const upload = await Upload.create({
      owner: user,
    });
    await upload.include('owner');

    const clone = await upload.clone();

    expect(clone.id).not.toBe(upload.id);
    expect(clone.owner).toBe(upload.owner);
  });

  it('should clone a self-referencing document', async () => {
    const user = await User.create({
      name: 'Frank Reynolds',
    });
    const upload = await Upload.create({
      owner: user,
    });
    user.image = upload;
    await user.save();

    const clone = await user.clone();

    expect(clone.id).not.toBe(user.id);
    expect(clone.name).toBe(user.name);
    expect(clone.image).toBe(user.image);
    expect(clone.createdAt).toBe(user.createdAt);
    expect(clone.updatedAt).not.toBe(user.updatedAt);
  });
});
