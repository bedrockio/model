import { Comment, Product, Shop, Upload, User } from './mocks';
import { createSchema } from '../src/schema';
import { createTestModel, getTestModelName } from '../src/testing';

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

    await expect(user.reload()).rejects.toThrow('Document does not exist');
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

  it('should reload fields that were not present initially', async () => {
    const user = await User.create({
      name: 'Frank Reynolds',
      email: 'frank@test.com',
    });

    expect(user.image).toBeUndefined();

    const upload = await Upload.create({});
    await User.updateOne(
      {
        _id: user._id,
      },
      {
        $set: { image: upload._id },
      },
    );

    await user.reload();

    expect(user.image).toEqual(upload._id);
  });

  it('should work with fields that have no read access', async () => {
    const user = await User.create({
      name: 'Frank Reynolds',
      profile: {
        url: 'test url',
      },
    });

    await User.updateOne(
      {
        _id: user._id,
      },
      {
        $set: {
          name: 'Dennis Reynolds',
          hidden: 'hidden',
          'profile.url': 'new url',
        },
      },
    );

    await user.reload();

    expect(user.name).toBe('Dennis Reynolds');
    expect(user.hidden).toBe('hidden');
    expect(user.profile.url).toBe('new url');
  });

  it('should unset fields that were removed', async () => {
    const user = await User.create({
      name: 'Frank Reynolds',
      email: 'frank@test.com',
    });

    expect(user.email).toBe('frank@test.com');

    await User.updateOne({ _id: user._id }, { $unset: { email: 1 } });
    await user.reload();

    expect(user.email).toBeUndefined();
  });

  it('should throw error when document is not saved yet', async () => {
    const user = new User({
      name: 'Frank Reynolds',
    });

    await expect(user.reload()).rejects.toThrow('Document does not exist');
  });

  it('should reload array of populated references', async () => {
    const friend1 = await User.create({ name: 'Friend 1' });
    const friend2 = await User.create({ name: 'Friend 2' });

    const user = await User.create({
      name: 'Frank',
      friends: [friend1, friend2],
    });

    friend1.name = 'Updated Friend 1';
    await friend1.save();

    await user.reload();

    expect(user.friends[0].name).toBe('Updated Friend 1');
    expect(user.friends[1].name).toBe('Friend 2');
  });

  it('should reload nested populated paths', async () => {
    const owner = await User.create({ name: 'Owner' });

    const product = await Product.create({
      name: 'Product 1',
      owner,
    });

    owner.name = 'Updated Owner';
    await owner.save();

    await product.reload();

    expect(product.owner.name).toBe('Updated Owner');
  });

  it('should reload virtual populates', async () => {
    const product = await Product.create({ name: 'Product 1' });

    const comment1 = await Comment.create({
      body: 'Comment 1',
      product: product._id,
    });

    await Comment.create({
      body: 'Comment 2',
      product: product._id,
    });

    await product.include('comments');

    comment1.body = 'Updated Comment 1';
    await comment1.save();

    await product.reload();

    expect(product.comments).toHaveLength(2);
    expect(product.comments[0].body).toBe('Updated Comment 1');
  });

  it('should reload nested virtual populates', async () => {
    const product = await Product.create({
      name: 'Product',
    });

    const shop = await Shop.create({
      name: 'Shop',
      inventory: [
        {
          product,
          quantity: 100,
        },
      ],
    });

    const comment1 = await Comment.create({
      body: 'Comment 1',
      product,
    });

    await Comment.create({
      body: 'Comment 2',
      product,
    });

    await shop.include('inventory.product.comments');

    comment1.body = 'Updated Comment 1';
    await comment1.save();

    await shop.reload();

    expect(shop.inventory).toMatchObject([
      {
        quantity: 100,
        product: {
          name: 'Product',
          comments: [
            {
              body: 'Updated Comment 1',
            },
            {
              body: 'Comment 2',
            },
          ],
        },
      },
    ]);
  });
});

describe('delete-hooks', () => {
  it('should work with delete hooks', async () => {
    const userModelName = getTestModelName();
    const userProfileModelName = getTestModelName();

    const User = createTestModel(
      userModelName,
      createSchema({
        attributes: {
          profile: {
            type: 'ObjectId',
            ref: userProfileModelName,
          },
        },
        onDelete: {
          clean: [
            {
              path: 'profile',
            },
          ],
        },
      }),
    );

    const UserProfile = createTestModel(userProfileModelName, {
      name: 'String',
    });

    const profile = await UserProfile.create({
      name: 'Barry',
    });

    const user = await User.create({
      profile,
    });

    profile.name = 'Larry';
    await profile.save();

    await user.reload();

    expect(user.profile.name).toBe('Larry');
    await User.deleteMany({});
    await UserProfile.deleteMany({});
  });
});
