import { createTestModel, createSchemaFromAttributes } from './helpers';

describe('soft delete', () => {
  it('should soft delete a document', async () => {
    const User = createTestModel(
      createSchemaFromAttributes({
        name: 'String',
      })
    );
    const user = await User.create({
      name: 'foo',
    });
    await user.delete();
    expect(await user.deletedAt).toBeInstanceOf(Date);
  });

  it('should restore a document', async () => {
    const User = createTestModel(
      createSchemaFromAttributes({
        name: 'String',
      })
    );
    const user = await User.create({
      name: 'foo',
    });
    await user.delete();
    expect(await user.deletedAt).toBeInstanceOf(Date);
    await user.restore();
    expect(await user.deletedAt).toBeUndefined();
  });

  it('should not query deleted documents by default', async () => {
    const User = createTestModel(
      createSchemaFromAttributes({
        name: 'String',
      })
    );
    const deletedUser = await User.create({
      name: 'foo',
      deletedAt: new Date(),
      deleted: true,
    });
    expect(await User.find()).toEqual([]);
    expect(await User.findOne()).toBe(null);
    expect(await User.findById(deletedUser.id)).toBe(null);
    expect(await User.exists()).toBe(null);
    expect(await User.countDocuments()).toBe(0);
  });

  it('should still query deleted documents', async () => {
    const User = createTestModel(
      createSchemaFromAttributes({
        name: 'String',
      })
    );
    const deletedUser = await User.create({
      name: 'foo',
      deletedAt: new Date(),
      deleted: true,
    });
    expect(await User.findDeleted()).not.toBe(null);
    expect(await User.findOneDeleted()).not.toBe(null);
    expect(await User.findByIdDeleted(deletedUser.id)).not.toBe(null);
    expect(await User.existsDeleted()).toStrictEqual({
      _id: deletedUser._id,
    });
    expect(await User.countDocumentsDeleted()).toBe(1);
  });

  it('should still query with deleted documents', async () => {
    const User = createTestModel(
      createSchemaFromAttributes({
        name: 'String',
      })
    );
    await User.create({
      name: 'foo',
    });
    const deletedUser = await User.create({
      name: 'bars',
      deletedAt: new Date(),
      deleted: true,
    });
    expect((await User.findWithDeleted()).length).toBe(2);
    expect(await User.findOneWithDeleted({ name: 'bars' })).not.toBe(null);
    expect(await User.findByIdWithDeleted(deletedUser.id)).not.toBe(null);
    expect(await User.existsWithDeleted({ name: 'bars' })).not.toBe(null);
    expect(await User.countDocumentsWithDeleted()).toBe(2);
  });

  it('should hard delete a document', async () => {
    const User = createTestModel(
      createSchemaFromAttributes({
        name: 'String',
      })
    );
    const user = await User.create({
      name: 'foo',
    });
    await User.create({
      name: 'foo2',
    });
    await user.destroy();
    expect(await User.countDocumentsWithDeleted()).toBe(1);
  });
});
