import { createTestModel } from '../src/testing';

describe('soft delete', () => {
  describe('delete', () => {
    it('should soft delete a document', async () => {
      const User = createTestModel({
        name: 'String',
      });
      const user = await User.create({
        name: 'foo',
      });
      await user.delete();
      expect(await user.deletedAt).toBeInstanceOf(Date);
    });

    it('should soft delete with deleteOne', async () => {
      const User = createTestModel({
        name: 'String',
      });
      await User.create({
        name: 'foo',
      });
      await User.create({
        name: 'bar',
      });
      const res = await User.deleteOne({
        name: 'foo',
      });
      expect(res).toEqual({
        acknowledged: true,
        deletedCount: 1,
      });
      expect(await User.countDocuments()).toBe(1);
      expect(await User.countDocumentsWithDeleted()).toBe(2);
    });

    it('should soft delete with deleteMany', async () => {
      const User = createTestModel({
        name: 'String',
      });
      await User.create({
        name: 'foo',
      });
      await User.create({
        name: 'bar',
      });
      const res = await User.deleteMany();
      expect(res).toEqual({
        acknowledged: true,
        deletedCount: 2,
      });
      expect(await User.countDocuments()).toBe(0);
      expect(await User.countDocumentsWithDeleted()).toBe(2);
    });

    it('should soft delete with findOneAndDelete', async () => {
      const User = createTestModel({
        name: 'String',
      });
      await User.create({
        name: 'foo',
      });
      expect(await User.countDocuments()).toBe(1);
      expect(await User.countDocumentsWithDeleted()).toBe(1);
      const user = await User.findOneAndDelete({
        name: 'foo',
      });
      expect(user.name).toBe('foo');
      expect(await User.countDocuments()).toBe(0);
      expect(await User.countDocumentsWithDeleted()).toBe(1);
    });

    it('should soft delete with findByIdAndDelete', async () => {
      const User = createTestModel({
        name: 'String',
      });
      let user = await User.create({
        name: 'foo',
      });
      user = await User.findByIdAndDelete(user.id);
      expect(user.name).toBe('foo');
      expect(await User.countDocuments()).toBe(0);
      expect(await User.countDocumentsWithDeleted()).toBe(1);
    });
  });

  describe('restore', () => {
    it('should restore a document', async () => {
      const User = createTestModel({
        name: 'String',
      });
      const user = await User.create({
        name: 'foo',
      });
      await user.delete();
      expect(await user.deletedAt).toBeInstanceOf(Date);
      await user.restore();
      expect(await user.deletedAt).toBeUndefined();
    });

    it('should restore with restoreOne', async () => {
      const User = createTestModel({
        name: 'String',
      });
      await User.create({
        name: 'foo',
      });
      await User.create({
        name: 'bar',
      });
      await User.deleteOne({
        name: 'foo',
      });
      expect(await User.countDocuments()).toBe(1);
      expect(await User.countDocumentsWithDeleted()).toBe(2);

      const res = await User.restoreOne({
        name: 'foo',
      });
      expect(res).toEqual({
        acknowledged: true,
        restoredCount: 1,
      });
      expect(await User.countDocuments()).toBe(2);
      expect(await User.countDocumentsWithDeleted()).toBe(2);
    });

    it('should restore with restoreMany', async () => {
      let users;
      const User = createTestModel({
        name: 'String',
      });
      await User.create({
        name: 'foo',
      });
      await User.create({
        name: 'bar',
      });
      await User.deleteMany({});
      expect(await User.countDocuments()).toBe(0);
      expect(await User.countDocumentsWithDeleted()).toBe(2);
      users = await User.findWithDeleted();
      expect(users[0].deleted).toBe(true);
      expect(users[0].deletedAt).not.toBeUndefined();
      expect(users[1].deleted).toBe(true);
      expect(users[1].deletedAt).not.toBeUndefined();

      const res = await User.restoreMany({});
      expect(res).toEqual({
        acknowledged: true,
        restoredCount: 2,
      });
      expect(await User.countDocuments()).toBe(2);
      expect(await User.countDocumentsWithDeleted()).toBe(2);
      users = await User.findWithDeleted();
      expect(users[0].deleted).toBe(false);
      expect(users[0].deletedAt).toBeUndefined();
      expect(users[1].deleted).toBe(false);
      expect(users[1].deletedAt).toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('should hard delete a document', async () => {
      const User = createTestModel({
        name: 'String',
      });
      const user = await User.create({
        name: 'foo',
      });
      await User.create({
        name: 'foo2',
      });
      await user.destroy();
      expect(await User.countDocumentsWithDeleted()).toBe(1);
    });

    it('should hard delete with destroyOne', async () => {
      const User = createTestModel({
        name: 'String',
      });
      await User.create({
        name: 'foo',
      });
      await User.create({
        name: 'bar',
      });
      const res = await User.destroyOne({
        name: 'foo',
      });
      expect(res).toEqual({
        acknowledged: true,
        destroyedCount: 1,
      });
      expect(await User.countDocuments()).toBe(1);
      expect(await User.countDocumentsWithDeleted()).toBe(1);
    });

    it('should hard delete with destroyMany', async () => {
      const User = createTestModel({
        name: 'String',
      });
      await User.create({
        name: 'foo',
      });
      await User.create({
        name: 'bar',
      });
      const res = await User.destroyMany();
      expect(res).toEqual({
        acknowledged: true,
        destroyedCount: 2,
      });
      expect(await User.countDocuments()).toBe(0);
      expect(await User.countDocumentsWithDeleted()).toBe(0);
    });
  });

  describe('query existing', () => {
    it('should not query deleted documents by default', async () => {
      const User = createTestModel({
        name: 'String',
      });
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
  });

  describe('query deleted', () => {
    it('should still query deleted documents', async () => {
      const User = createTestModel({
        name: 'String',
      });
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
  });

  describe('query with deleted', () => {
    it('should still query with deleted documents', async () => {
      const User = createTestModel({
        name: 'String',
      });
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
  });

  describe('soft unique', () => {
    it('should enforce uniqueness', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      await User.create({
        email: 'foo@bar.com',
      });

      await expect(
        User.create({
          email: 'foo@bar.com',
        })
      ).rejects.toThrow(
        `Cannot create ${User.modelName}. Duplicate fields exist: email.`
      );

      await expect(
        User.create({
          email: 'foo2@bar.com',
        })
      ).resolves.not.toThrow();
    });

    it('should enforce uniqueness on multiple fields', async () => {
      const User = createTestModel({
        name: {
          type: 'String',
          unique: true,
        },
        email: {
          type: 'String',
          unique: true,
        },
      });
      await User.create({
        name: 'Foo',
        email: 'foo@bar.com',
      });

      await expect(
        User.create({
          name: 'Foo',
          email: 'foo@bar.com',
        })
      ).rejects.toThrow(
        `Cannot create ${User.modelName}. Duplicate fields exist: name, email.`
      );

      await expect(
        User.create({
          name: 'Charlie',
          email: 'foo@bar.com',
        })
      ).rejects.toThrow(
        `Cannot create ${User.modelName}. Duplicate fields exist: email.`
      );

      await expect(
        User.create({
          name: 'Foo',
          email: 'foo2@bar.com',
        })
      ).rejects.toThrow(
        `Cannot create ${User.modelName}. Duplicate fields exist: name.`
      );

      // User 2 created. Has no name.
      await expect(
        User.create({
          email: 'foo2@bar.com',
        })
      ).resolves.not.toThrow();

      await expect(
        User.create({
          email: 'foo2@bar.com',
        })
      ).rejects.toThrow(
        `Cannot create ${User.modelName}. Duplicate fields exist: email.`
      );

      // User 3 created. Allowed to have no name but different email.
      await expect(
        User.create({
          email: 'foo3@bar.com',
        })
      ).resolves.not.toThrow();

      await expect(
        User.create({
          name: 'Bar',
          email: 'bar@bar.com',
        })
      ).resolves.not.toThrow();
    });

    it('should enforce uniqueness on nested field', async () => {
      const User = createTestModel({
        profile: {
          email: {
            type: 'String',
            unique: true,
          },
        },
      });
      await User.create({
        profile: {
          email: 'foo@bar.com',
        },
      });

      await expect(
        User.create({
          profile: {
            email: 'foo@bar.com',
          },
        })
      ).rejects.toThrow(
        `Cannot create ${User.modelName}. Duplicate fields exist: profile.email.`
      );

      await expect(
        User.create({
          profile: {
            email: 'foo2@bar.com',
          },
        })
      ).resolves.not.toThrow();
    });

    it('should enforce uniqueness on array field', async () => {
      const User = createTestModel({
        profiles: [
          {
            email: {
              type: 'String',
              unique: true,
            },
          },
        ],
      });
      await User.create({
        profiles: [
          {
            email: 'foo@bar.com',
          },
        ],
      });

      await expect(
        User.create({
          profiles: [
            {
              email: 'foo@bar.com',
            },
          ],
        })
      ).rejects.toThrow(
        `Cannot create ${User.modelName}. Duplicate fields exist: profiles.email.`
      );

      await expect(
        User.create({
          profiles: [
            {
              email: 'foo2@bar.com',
            },
          ],
        })
      ).resolves.not.toThrow();
    });

    it('should error on save and update', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      let user = await User.create({
        email: 'foo@bar.com',
      });
      await User.create({
        email: 'bar@bar.com',
      });

      user.email = 'bar@bar.com';
      await expect(user.save()).rejects.toThrow(
        `Cannot update ${User.modelName}. Duplicate fields exist: email.`
      );

      await expect(
        user.updateOne({
          email: 'bar@bar.com',
        })
      ).rejects.toThrow(
        `Cannot update ${User.modelName}. Duplicate fields exist: email.`
      );
    });

    it('should exclude self on save', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      let user = await User.create({
        email: 'foo@bar.com',
      });

      await user.save();

      user = await User.findById(user.id);
      expect(user.email).toBe('foo@bar.com');

      user.email = 'foo2@bar.com';
      await user.save();
      user = await User.findById(user.id);
      expect(user.email).toBe('foo2@bar.com');
    });

    it('should no consider deleted documents', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      const user = await User.create({
        email: 'foo@bar.com',
      });
      await user.delete();

      await expect(
        User.create({
          email: 'foo@bar.com',
        })
      ).resolves.not.toThrow();
    });

    it('should error when attempting to restore', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      const user = await User.create({
        email: 'foo@bar.com',
      });
      await user.delete();

      await User.create({
        email: 'foo@bar.com',
      });

      await expect(user.restore()).rejects.toThrow(
        `Cannot update ${User.modelName}. Duplicate fields exist: email.`
      );
    });

    it('should error when using updateOne', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      const user = await User.create({
        email: 'user1@foo.com',
      });

      await User.create({
        email: 'user2@foo.com',
      });

      await expect(
        User.updateOne(
          {
            _id: user.id,
          },
          {
            email: 'user2@foo.com',
          }
        )
      ).rejects.toThrow(
        `Cannot update ${User.modelName}. Duplicate fields exist: email.`
      );
    });

    it('should not error when using updateOne on a non-unique field', async () => {
      const User = createTestModel({
        name: 'String',
        email: {
          type: 'String',
          unique: true,
        },
      });
      const user = await User.create({
        name: 'Foo',
        email: 'user@foo.com',
      });

      await expect(
        User.updateOne(
          {
            _id: user.id,
          },
          {
            name: 'Bar',
          }
        )
      ).resolves.not.toThrow();
    });

    it('should error when using updateOne on a unique field', async () => {
      // This is a known and intentional restriction.
      // See README for more.
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      const user = await User.create({
        email: 'user@foo.com',
      });

      await expect(
        User.updateOne(
          {
            _id: user.id,
          },
          {
            email: 'user@foo.com',
          }
        )
      ).rejects.toThrow(
        `Cannot update ${User.modelName}. Duplicate fields exist: email.`
      );
    });

    it('should error when using updateMany', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      const user1 = await User.create({
        email: 'user1@foo.com',
      });

      const user2 = await User.create({
        email: 'user2@foo.com',
      });

      await expect(
        User.updateOne(
          {
            _id: { $in: [user1.id, user2.id] },
          },
          {
            email: 'user2@foo.com',
          }
        )
      ).rejects.toThrow(
        `Cannot update ${User.modelName}. Duplicate fields exist: email.`
      );
    });

    it('should error when using restoreOne', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      const user = await User.create({
        email: 'user@foo.com',
      });
      await user.delete();

      await User.create({
        email: 'user@foo.com',
      });

      await expect(
        User.restoreOne({
          _id: user.id,
        })
      ).rejects.toThrow(
        `Cannot restore ${User.modelName}. Duplicate fields exist: email.`
      );
    });

    it('should error when using restoreMany', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      const user1 = await User.create({
        email: 'user1@foo.com',
      });
      const user2 = await User.create({
        email: 'user2@foo.com',
      });
      await user1.delete();
      await user2.delete();

      await User.create({
        email: 'user1@foo.com',
      });

      await expect(
        User.restoreMany({
          _id: { $in: [user1.id, user2.id] },
        })
      ).rejects.toThrow(
        `Cannot restore ${User.modelName}. Duplicate fields exist: email.`
      );
    });

    it('should error when using insertMany', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      await User.create({
        email: 'user@foo.com',
      });

      await expect(
        User.insertMany({
          email: 'user@foo.com',
        })
      ).rejects.toThrow(
        `Cannot create ${User.modelName}. Duplicate fields exist: email.`
      );
    });

    it('should error when using replaceOne', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
      });
      const user = await User.create({
        email: 'user@foo.com',
      });

      await expect(
        User.replaceOne(
          {
            _id: user.id,
          },
          {
            email: 'user@foo.com',
          }
        )
      ).rejects.toThrow(
        `Cannot update ${User.modelName}. Duplicate fields exist: email.`
      );
    });
  });

  describe('other', () => {
    it('should not allow remove method', async () => {
      const User = createTestModel({
        name: 'String',
      });
      const user = await User.create({
        name: 'foo',
      });
      await user.delete();

      expect(() => {
        user.remove();
      }).toThrow('Method not allowed.');
    });

    it('should not allow deleteOne on document', async () => {
      const User = createTestModel({
        name: 'String',
      });
      const user = await User.create({
        name: 'foo',
      });

      expect(() => {
        user.deleteOne();
      }).toThrow('Method not allowed.');
    });

    it('should not allow remove on model', async () => {
      const User = createTestModel({
        name: 'String',
      });
      expect(() => {
        User.remove();
      }).toThrow('Method not allowed.');
    });

    it('should not allow findOneAndRemove on model', async () => {
      const User = createTestModel({
        name: 'String',
      });
      expect(() => {
        User.findOneAndRemove();
      }).toThrow('Method not allowed.');
    });

    it('should not allow findByIdAndRemove on model', async () => {
      const User = createTestModel({
        name: 'String',
      });
      expect(() => {
        User.findByIdAndRemove();
      }).toThrow('Method not allowed.');
    });
  });
});
