import mongoose from 'mongoose';

import { createTestModel } from '../src/testing';

const User = createTestModel({
  name: {
    type: 'String',
    required: true,
  },
});
const Shop = createTestModel({
  user: {
    ref: User.modelName,
    type: mongoose.Schema.Types.ObjectId,
  },
});

describe('assertNoReferences', () => {
  it('should throw error if document is referenced externally', async () => {
    const user1 = await User.create({ name: 'foo ' });
    const user2 = await User.create({ name: 'foo ' });
    await Shop.create({ user: user1 });

    await expect(async () => {
      await user1.assertNoReferences();
    }).rejects.toThrow('Refusing to delete.');

    await expect(
      user1.assertNoReferences({
        except: [Shop],
      })
    ).resolves.not.toThrow();

    await expect(
      user1.assertNoReferences({
        except: [Shop.modelName],
      })
    ).resolves.not.toThrow();

    await expect(user2.assertNoReferences()).resolves.not.toThrow();
  });

  it('should expose references on the error object', async () => {
    const user1 = await User.create({ name: 'foo ' });
    await User.create({ name: 'foo ' });
    const shop = await Shop.create({ user: user1 });

    try {
      await user1.assertNoReferences();
    } catch (error) {
      expect(error.references).toEqual([
        {
          model: Shop,
          count: 1,
          ids: [shop.id],
        },
      ]);
    }
  });

  it('should throw error exception is unknown model', async () => {
    const User = createTestModel();
    const user = await User.create({});

    await expect(
      user.assertNoReferences({
        except: ['BadModelName'],
      })
    ).rejects.toThrow('Unknown model "BadModelName".');
  });
});
