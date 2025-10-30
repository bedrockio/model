import mongoose from 'mongoose';

import { createSchema } from '../src/schema';
import { createTestModel } from '../src/testing';

const schema = createSchema({
  attributes: {
    name: {
      type: 'String',
      required: true,
    },
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
      },
    ],
  },
});

schema.virtual('firstName').get(function () {
  return this.name.split(' ')[0];
});

const User = createTestModel(schema);

const Upload = createTestModel({
  owner: {
    type: 'ObjectId',
    ref: User.modelName,
  },
});

afterEach(async () => {
  await User.deleteMany({});
});

describe('reload', () => {
  it('should reload basic field', async () => {
    const user = await User.create({
      name: 'Frank Reynolds',
      email: 'foo@bar.com',
    });

    await User.updateOne(
      {
        email: 'foo@bar.com',
      },
      {
        $set: {
          name: 'Dennis Reynolds',
        },
      },
    );

    const ret = await user.reload();

    expect(user.name).toBe('Dennis Reynolds');
    expect(user.firstName).toBe('Dennis');
    expect(ret).toBeUndefined();
  });

  it('should discard nested field modifications', async () => {
    const user = await User.create({
      name: 'Frank',
      roles: [{ role: 'admin', scope: 'global' }],
    });

    user.roles[0].role = 'user';
    await user.reload();

    expect(user.roles[0].role).toBe('admin');
  });

  it('should discard array modifications', async () => {
    const user = await User.create({
      name: 'Frank',
      roles: [{ role: 'admin', scope: 'global' }],
    });

    user.roles.push({ role: 'user', scope: 'local' });
    await user.reload();

    expect(user.roles).toHaveLength(1);
  });

  it('should error when document has been deleted', async () => {
    const user = await User.create({
      name: 'Frank Reynolds',
      email: 'foo@bar.com',
    });

    await User.deleteOne({
      email: 'foo@bar.com',
    });

    await expect(user.reload()).rejects.toThrow('Document deleted');
  });

  it('should be identical to a fresh document', async () => {
    const user = await User.create({
      name: 'Frank Reynolds',
      email: 'foo@bar.com',
    });

    user.set('name', 'Dennis Reynolds');

    await user.reload();

    expect(user.name).toBe('Frank Reynolds');
    expect(user.isModified()).toBe(false);
    expect(user.isNew).toBe(false);
  });

  it('should reload a document set on create', async () => {
    const user = await User.create({
      name: 'Frank Reynolds',
    });

    const upload = await Upload.create({
      owner: user,
    });

    user.name = 'Dennis Reynolds';
    await user.save();

    await upload.reload();

    expect(upload.owner.name).toBe('Dennis Reynolds');
  });

  it('should reload a populated document', async () => {
    const user = await User.create({
      name: 'Frank Reynolds',
    });

    let upload = await Upload.create({
      owner: user.id,
    });

    upload = await Upload.findById(upload.id).populate('owner');

    user.name = 'Dennis Reynolds';
    await user.save();

    await upload.reload();

    expect(upload.owner.name).toBe('Dennis Reynolds');
  });

  it('should not reload an unpopulated document', async () => {
    const user = await User.create({
      name: 'Frank Reynolds',
    });

    const upload = await Upload.create({
      owner: user.id,
    });

    await upload.reload();

    expect(upload.owner).toEqual(user._id);
  });

  it('should populate a null reference field set externally', async () => {
    const user = await User.create({
      name: 'Frank',
      image: null,
    });

    const upload = await Upload.create({});
    await User.updateOne(
      {
        _id: user.id,
      },
      {
        image: upload.id,
      },
    );

    await user.reload();
    expect(user.image).toEqual(upload._id);
  });

  it('should a populated document deleted externally', async () => {
    const upload = await Upload.create({});
    const user = await User.create({
      name: 'Frank',
      image: upload.id,
    });

    await User.updateOne({ _id: user.id }, { image: null });
    await user.reload();

    expect(user.image).toBeNull();
  });

  it('should clear validation errors', async () => {
    const user = await User.create({
      name: 'Frank Reynolds',
      email: 'frank@test.com',
    });

    user.name = null;
    await expect(user.save()).rejects.toThrow();

    await user.reload();

    expect(user.validateSync()).toBe(null);
  });
});
