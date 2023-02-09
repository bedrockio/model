import mongoose from 'mongoose';

import { createTestModel } from '../src/testing';

describe('assertNoReferences', () => {
  it('should throw error if document is referenced externally', async () => {
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
    const user1 = await User.create({ name: 'foo ' });
    const user2 = await User.create({ name: 'foo ' });
    await Shop.create({ user: user1 });

    await expect(async () => {
      await user1.assertNoReferences();
    }).rejects.toThrow();

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
});
