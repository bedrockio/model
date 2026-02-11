import mongoose from 'mongoose';

import { createSchema } from '../src/schema';
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

    it('should only match non-deleted items', async () => {
      const User = createTestModel({
        name: 'String',
      });
      const user = await User.create({
        name: 'foo',
      });
      await user.delete();
      const res = await User.deleteMany();
      expect(res).toEqual({
        acknowledged: true,
        deletedCount: 0,
      });
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

    it('should not validate on delete', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          validate: 'email',
        },
      });

      let user = new User();
      user.email = 'foo@bar';
      await user.save({
        validateBeforeSave: false,
      });

      user = await User.findById(user.id);
      await user.delete();
      expect(await user.deletedAt).toBeInstanceOf(Date);
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

    it('should only match deleted documents', async () => {
      const User = createTestModel({
        name: 'String',
      });
      await User.create({
        name: 'foo',
      });

      const res = await User.restoreOne({
        name: 'foo',
      });
      expect(res).toEqual({
        acknowledged: true,
        restoredCount: 0,
      });
    });

    it('should validate on restore', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          validate: 'email',
        },
      });

      let user = new User();
      user.email = 'foo@bar';
      await user.save({
        validateBeforeSave: false,
      });
      await user.delete();

      user = await User.findByIdDeleted(user.id);
      await expect(user.restore()).rejects.toThrow(
        `${User.modelName} validation failed: email: Validation failed.`,
      );
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
        }),
      ).rejects.toThrow('"email" already exists.');

      await expect(
        User.create({
          email: 'foo2@bar.com',
        }),
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
        }),
      ).rejects.toThrow('"name" already exists.');

      await expect(
        User.create({
          name: 'Charlie',
          email: 'foo@bar.com',
        }),
      ).rejects.toThrow('"email" already exists.');

      await expect(
        User.create({
          name: 'Foo',
          email: 'foo2@bar.com',
        }),
      ).rejects.toThrow('"name" already exists.');

      // User 2 created. Has no name.
      await expect(
        User.create({
          email: 'foo2@bar.com',
        }),
      ).resolves.not.toThrow();

      await expect(
        User.create({
          email: 'foo2@bar.com',
        }),
      ).rejects.toThrow('"email" already exists.');

      // User 3 created. Allowed to have no name but different email.
      await expect(
        User.create({
          email: 'foo3@bar.com',
        }),
      ).resolves.not.toThrow();

      await expect(
        User.create({
          name: 'Bar',
          email: 'bar@bar.com',
        }),
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
        }),
      ).rejects.toThrow('"profile.email" already exists.');

      await expect(
        User.create({
          profile: {
            email: 'foo2@bar.com',
          },
        }),
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
        }),
      ).rejects.toThrow('"profiles.email" already exists.');

      await expect(
        User.create({
          profiles: [
            {
              email: 'foo2@bar.com',
            },
          ],
        }),
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
      await expect(user.save()).rejects.toThrow('"email" already exists.');

      await expect(
        user.updateOne({
          email: 'bar@bar.com',
        }),
      ).rejects.toThrow('"email" already exists.');
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
        }),
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

      await expect(user.restore()).rejects.toThrow('"email" already exists.');
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
          },
        ),
      ).rejects.toThrow('"email" already exists.');
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
          },
        ),
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
          },
        ),
      ).rejects.toThrow('"email" already exists.');
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
          },
        ),
      ).rejects.toThrow('"email" already exists.');
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
        }),
      ).rejects.toThrow('"email" already exists.');
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
        }),
      ).rejects.toThrow('"email" already exists.');
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
        User.insertMany([
          { email: 'usernew@foo.com' },
          { email: 'user@foo.com' },
        ]),
      ).rejects.toThrow('"email" already exists.');
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
          },
        ),
      ).rejects.toThrow('"email" already exists.');
    });

    it('should work with access control', async () => {
      const User = createTestModel({
        email: {
          type: 'String',
          unique: true,
        },
        password: {
          type: 'String',
          readAccess: 'admin',
        },
      });

      await User.create({
        email: 'foo@bar.com',
        password: '12345',
      });

      await expect(
        User.create({
          email: 'foo@bar.com',
        }),
      ).rejects.toThrow('"email" already exists.');

      await expect(
        User.create({
          email: 'foo2@bar.com',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('query chaining', () => {
    const User = createTestModel({
      name: 'String',
    });

    it('deleteOne', async () => {
      const query = User.deleteOne({
        name: 'foo',
      });
      expect(query.getFilter()).toEqual({
        name: 'foo',
        deleted: false,
      });
    });

    it('deleteMany', async () => {
      const query = User.deleteMany({
        name: 'foo',
      });
      expect(query.getFilter()).toEqual({
        name: 'foo',
        deleted: false,
      });
    });

    it('findOneAndDelete', async () => {
      const query = User.findOneAndDelete({
        name: 'foo',
      });
      expect(query.getFilter()).toEqual({
        name: 'foo',
        deleted: false,
      });
    });

    it('restoreOne', async () => {
      const query = User.restoreOne({
        name: 'foo',
      });
      expect(query.getFilter()).toEqual({
        name: 'foo',
        deleted: true,
      });
    });

    it('restoreMany', async () => {
      const query = User.restoreMany({
        name: 'foo',
      });
      expect(query.getFilter()).toEqual({
        name: 'foo',
        deleted: true,
      });
    });

    it('destroyOne', async () => {
      const query = User.destroyOne({
        name: 'foo',
      });
      expect(query.getFilter()).toEqual({
        name: 'foo',
      });
    });

    it('destroyMany', async () => {
      const query = User.destroyMany({
        name: 'foo',
      });
      expect(query.getFilter()).toEqual({
        name: 'foo',
      });
    });

    it('findDeleted', async () => {
      const query = User.findDeleted({
        name: 'foo',
      });
      expect(query.getFilter()).toEqual({
        name: 'foo',
        deleted: true,
      });
    });

    it('findOneDeleted', async () => {
      const query = User.findOneDeleted({
        name: 'foo',
      });
      expect(query.getFilter()).toEqual({
        name: 'foo',
        deleted: true,
      });
    });

    it('findByIdDeleted', async () => {
      const query = User.findByIdDeleted('id');
      expect(query.getFilter()).toEqual({
        _id: 'id',
        deleted: true,
      });
    });

    it('existsDeleted', async () => {
      const query = User.existsDeleted({
        name: 'foo',
      });
      expect(query.getFilter()).toEqual({
        name: 'foo',
        deleted: true,
      });
    });

    it('countDocumentsDeleted', async () => {
      const query = User.countDocumentsDeleted({
        name: 'foo',
      });
      expect(query.getFilter()).toEqual({
        name: 'foo',
        deleted: true,
      });
    });

    it('findWithDeleted', async () => {
      const query = User.findWithDeleted({
        name: 'foo',
      });
      expect(query.getFilter()).toEqual({
        name: 'foo',
        deleted: {
          $in: [true, false],
        },
      });
    });

    it('findWithOneDeleted', async () => {
      const query = User.findOneWithDeleted({
        name: 'foo',
      });
      expect(query.getFilter()).toEqual({
        name: 'foo',
        deleted: {
          $in: [true, false],
        },
      });
    });

    it('findWithByIdDeleted', async () => {
      const query = User.findByIdWithDeleted('id');
      expect(query.getFilter()).toEqual({
        _id: 'id',
        deleted: {
          $in: [true, false],
        },
      });
    });

    it('existsWithDeleted', async () => {
      const query = User.existsWithDeleted({
        name: 'foo',
      });
      expect(query.getFilter()).toEqual({
        name: 'foo',
        deleted: {
          $in: [true, false],
        },
      });
    });

    it('countDocumentsWithDeleted', async () => {
      const query = User.countDocumentsWithDeleted({
        name: 'foo',
      });
      expect(query.getFilter()).toEqual({
        name: 'foo',
        deleted: {
          $in: [true, false],
        },
      });
    });
  });

  describe('hooks', () => {
    describe('document', () => {
      function setupHook(hook) {
        const calls = {
          pre: 0,
          post: 0,
        };

        const schema = createSchema({
          name: 'String',
        });

        schema.pre(hook, async function () {
          expect(this).toBeInstanceOf(mongoose.Document);
          calls.pre += 1;
        });

        schema.post(hook, async function () {
          expect(this).toBeInstanceOf(mongoose.Document);
          calls.post += 1;
        });

        const User = createTestModel(schema);

        return {
          User,
          calls,
          schema,
        };
      }

      it('should run delete hooks', async () => {
        const { User, calls } = setupHook('delete');

        const user = await User.create({
          name: 'Barry',
        });

        expect(calls.pre).toBe(0);
        expect(calls.post).toBe(0);

        await user.delete();

        expect(calls.pre).toBe(1);
        expect(calls.post).toBe(1);
      });

      it('should run restore hooks', async () => {
        const { User, calls } = setupHook('restore');

        const user = await User.create({
          name: 'Barry',
        });

        await user.delete();

        expect(calls.pre).toBe(0);
        expect(calls.post).toBe(0);

        await user.restore();

        expect(calls.pre).toBe(1);
        expect(calls.post).toBe(1);
      });

      it('should run destroy hooks', async () => {
        const { User, calls, schema } = setupHook('destroy');

        const otherCalls = {
          delete: {
            pre: 0,
            post: 0,
          },
          remove: {
            pre: 0,
            post: 0,
          },
        };

        schema.pre('delete', function () {
          otherCalls.delete.pre += 1;
        });

        schema.post('delete', function () {
          otherCalls.delete.post += 1;
        });

        schema.pre('remove', function () {
          otherCalls.remove.pre += 1;
        });

        schema.post('remove', function () {
          otherCalls.remove.post += 1;
        });

        const user = await User.create({
          name: 'Barry',
        });

        expect(calls.pre).toBe(0);
        expect(calls.post).toBe(0);

        await user.destroy();

        expect(calls.pre).toBe(1);
        expect(calls.post).toBe(1);

        expect(otherCalls.delete.pre).toBe(0);
        expect(otherCalls.delete.post).toBe(0);
        expect(otherCalls.remove.pre).toBe(0);
        expect(otherCalls.remove.post).toBe(0);
      });
    });

    describe('query', () => {
      // Note that hooks do not exist for:
      // - exists
      // - findById

      function setupHook(hook) {
        const calls = {
          pre: 0,
          post: 0,
        };

        const schema = createSchema({
          name: 'String',
        });

        schema.pre(hook, async function () {
          expect(this).toBeInstanceOf(mongoose.Query);
          calls.pre += 1;
        });

        schema.post(hook, async function () {
          expect(this).toBeInstanceOf(mongoose.Query);
          calls.post += 1;
        });

        const User = createTestModel(schema);

        return {
          User,
          calls,
        };
      }

      describe('delete', () => {
        it('should run deleteOne hooks', async () => {
          const { User, calls } = setupHook('deleteOne');

          await User.create({
            name: 'Barry',
          });

          await User.deleteOne({
            name: 'Barry',
          });

          expect(calls.pre).toBe(1);
          expect(calls.post).toBe(1);
        });

        it('should run deleteMany hooks', async () => {
          const { User, calls } = setupHook('deleteMany');

          await User.create({
            name: 'Barry',
          });

          await User.deleteMany({
            name: 'Barry',
          });

          expect(calls.pre).toBe(1);
          expect(calls.post).toBe(1);
        });

        it('should run findOneAndDelete hooks', async () => {
          const { User, calls } = setupHook('findOneAndDelete');

          await User.create({
            name: 'Barry',
          });

          await User.findOneAndDelete({
            name: 'Barry',
          });

          expect(calls.pre).toBe(1);
          expect(calls.post).toBe(1);
        });
      });

      describe('restore', () => {
        it('should run restoreOne hooks', async () => {
          const { User, calls } = setupHook('restoreOne');

          await User.create({
            name: 'Barry',
          });

          await User.deleteOne({
            name: 'Barry',
          });

          expect(calls.pre).toBe(0);
          expect(calls.post).toBe(0);

          await User.restoreOne({
            name: 'Barry',
          });

          expect(calls.pre).toBe(1);
          expect(calls.post).toBe(1);
        });

        it('should run restoreMany hooks', async () => {
          const { User, calls } = setupHook('restoreMany');

          await User.create({
            name: 'Barry',
          });

          await User.deleteMany({
            name: 'Barry',
          });

          expect(calls.pre).toBe(0);
          expect(calls.post).toBe(0);

          await User.restoreMany({
            name: 'Barry',
          });

          expect(calls.pre).toBe(1);
          expect(calls.post).toBe(1);
        });
      });

      describe('destroy', () => {
        it('should run destroyOne hooks', async () => {
          const { User, calls } = setupHook('destroyOne');

          await User.create({
            name: 'Barry',
          });

          await User.destroyOne({
            name: 'Barry',
          });

          expect(calls.pre).toBe(1);
          expect(calls.post).toBe(1);
        });

        it('should run destroyMany hooks', async () => {
          const { User, calls } = setupHook('destroyMany');

          await User.create({
            name: 'Barry',
          });

          await User.destroyMany({
            name: 'Barry',
          });

          expect(calls.pre).toBe(1);
          expect(calls.post).toBe(1);
        });
      });

      describe('findDeleted', () => {
        it('should run findDeleted hooks', async () => {
          const { User, calls } = setupHook('findDeleted');

          await User.findDeleted({
            name: 'Barry',
          });

          expect(calls.pre).toBe(1);
          expect(calls.post).toBe(1);
        });

        it('should run findOneDeleted hooks', async () => {
          const { User, calls } = setupHook('findOneDeleted');

          await User.findOneDeleted({
            name: 'Barry',
          });

          expect(calls.pre).toBe(1);
          expect(calls.post).toBe(1);
        });

        it('should run countDocumentsDeleted hooks', async () => {
          const { User, calls } = setupHook(
            'countDocumentsDeleted',
            mongoose.Query,
          );

          await User.countDocumentsDeleted({
            name: 'Barry',
          });

          expect(calls.pre).toBe(1);
          expect(calls.post).toBe(1);
        });
      });

      describe('findWithDeleted', () => {
        it('should run findWithDeleted hooks', async () => {
          const { User, calls } = setupHook('findWithDeleted');

          await User.findWithDeleted({
            name: 'Barry',
          });

          expect(calls.pre).toBe(1);
          expect(calls.post).toBe(1);
        });

        it('should run findOneWithDeleted hooks', async () => {
          const { User, calls } = setupHook('findOneWithDeleted');

          await User.findOneWithDeleted({
            name: 'Barry',
          });

          expect(calls.pre).toBe(1);
          expect(calls.post).toBe(1);
        });

        it('should run countDocumentsWithDeleted hooks', async () => {
          const { User, calls } = setupHook(
            'countDocumentsWithDeleted',
            mongoose.Query,
          );

          await User.countDocumentsWithDeleted({
            name: 'Barry',
          });

          expect(calls.pre).toBe(1);
          expect(calls.post).toBe(1);
        });
      });

      describe('deleteMany', () => {
        it('should not hang on a non-async hook that does not call next', async () => {
          const schema = createSchema({
            name: 'String',
          });

          let calls = 0;

          schema.pre('deleteMany', function () {
            calls += 1;
          });

          schema.post('deleteMany', function () {
            calls += 1;
          });

          const User = createTestModel(schema);

          await User.deleteMany({});

          expect(calls).toBe(2);
        });
      });

      describe('other', () => {
        it('should work with non-async hooks', async () => {
          const calls = { pre: 0, post: 0 };

          const schema = createSchema({
            name: 'String',
          });

          schema.pre('deleteOne', function () {
            expect(this).toBeInstanceOf(mongoose.Query);
            calls.pre += 1;
          });

          schema.post('deleteOne', function () {
            expect(this).toBeInstanceOf(mongoose.Query);
            calls.post += 1;
          });

          const User = createTestModel(schema);

          await User.deleteOne({
            name: 'Barry',
          });

          expect(calls.pre).toBe(1);
          expect(calls.post).toBe(1);
        });
      });
    });
  });
});
