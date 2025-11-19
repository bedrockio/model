import { Upload, User } from './mocks';

describe('clone', () => {
  it('should not fail on a unique field', async () => {
    const user = await User.create({
      name: 'Frank Reynolds',
      email: 'foo@bar.com',
    });

    const clone = user.clone();

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

    const clone = upload.clone();

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

    const clone = user.clone();

    expect(clone.id).not.toBe(user.id);
    expect(clone.name).toBe(user.name);
    expect(clone.image).toBe(user.image);
    expect(clone.createdAt).toBe(user.createdAt);
    expect(clone.updatedAt).toBe(user.updatedAt);
  });
});
