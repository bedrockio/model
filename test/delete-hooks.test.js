import { getTestModelName, createTestModel } from '../src/testing';
import { createSchema } from '../src/schema';

describe('delete hooks', () => {
  describe('clean references', () => {
    describe('local', () => {
      describe('simple', () => {
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

        afterEach(async () => {
          await User.deleteMany({});
          await UserProfile.deleteMany({});
        });

        it('should delete document reference on create', async () => {
          const profile = await UserProfile.create({
            name: 'Barry',
          });
          const user = await User.create({
            profile,
          });
          await user.delete();

          expect(await UserProfile.countDocuments()).toBe(0);
        });

        it('should skip if reference does not exist', async () => {
          const user = await User.create({});
          await user.delete();

          expect(await UserProfile.countDocuments()).toBe(0);
        });

        it('should delete document reference after create', async () => {
          let user;

          const profile = await UserProfile.create({
            name: 'Barry',
          });

          user = await User.create({
            profile,
          });

          user = await User.findById(user.id);
          await user.delete();

          expect(await UserProfile.countDocuments()).toBe(0);
        });

        it('should be able to restore local reference', async () => {
          const profile = await UserProfile.create({
            name: 'Barry',
          });

          let user = await User.create({
            profile,
          });

          user = await User.findById(user);
          await user.delete();
          expect(await UserProfile.countDocuments()).toBe(0);

          user = await User.findByIdDeleted(user);
          await user.restore();
          expect(await UserProfile.countDocuments()).toBe(1);
          expect(user.profile._id).toEqual(profile._id);
        });

        it('should restore if local document is not deleted', async () => {
          const profile = await UserProfile.create({
            name: 'Barry',
          });
          const user = await User.create({
            profile,
          });

          // Skip hooks
          await User.deleteOne({
            _id: user.id,
          });

          await expect(user.restore()).resolves.not.toThrow();
        });
      });

      describe('multiple documents', () => {
        const userModelName = getTestModelName();
        const userProfileModelName = getTestModelName();

        const User = createTestModel(
          userModelName,
          createSchema({
            attributes: {
              profiles: [
                {
                  type: 'ObjectId',
                  ref: userProfileModelName,
                },
              ],
            },
            onDelete: {
              clean: [
                {
                  path: 'profiles',
                },
              ],
            },
          }),
        );
        const UserProfile = createTestModel(userProfileModelName, {
          name: 'String',
        });

        afterEach(async () => {
          await User.deleteMany({});
          await UserProfile.deleteMany({});
        });

        it('should delete document reference on create', async () => {
          const profile1 = await UserProfile.create({
            name: 'Barry',
          });
          const profile2 = await UserProfile.create({
            name: 'Larry',
          });
          const user = await User.create({
            profiles: [profile1, profile2],
          });
          await user.delete();

          expect(await UserProfile.countDocuments()).toBe(0);
        });

        it('should delete document reference after create', async () => {
          const profile1 = await UserProfile.create({
            name: 'Barry',
          });
          const profile2 = await UserProfile.create({
            name: 'Larry',
          });
          let user = await User.create({
            profiles: [profile1, profile2],
          });
          user = await User.findById(user.id);
          await user.delete();

          expect(await UserProfile.countDocuments()).toBe(0);
        });

        it('should be able to restore multiple references', async () => {
          const profile1 = await UserProfile.create({
            name: 'Barry',
          });
          const profile2 = await UserProfile.create({
            name: 'Larry',
          });
          const user = await User.create({
            profiles: [profile1, profile2],
          });

          await user.delete();
          expect(await UserProfile.countDocuments()).toBe(0);

          await user.restore();
          expect(await User.countDocuments()).toBe(1);
          expect(await UserProfile.countDocuments()).toBe(2);
        });
      });

      describe('errors', () => {
        it('should error if no paths are defined', async () => {
          expect(() => {
            createSchema({
              attributes: {
                name: 'String',
              },
              onDelete: {
                clean: [
                  {
                    ref: 'Shop',
                  },
                ],
              },
            });
          }).toThrow('Clean hook must define either "path" or "paths".');
        });

        it('should error on misspelling of reference', async () => {
          expect(() => {
            createSchema({
              attributes: {
                profile: [
                  {
                    type: 'ObjectId',
                    ref: 'UserProfile',
                  },
                ],
              },
              onDelete: {
                clean: [
                  {
                    path: ['profilez'],
                  },
                ],
              },
            });
          }).toThrow();
        });
      });
    });

    describe('foreign', () => {
      describe('simple', () => {
        const userModelName = getTestModelName();
        const shopModelName = getTestModelName();

        const User = createTestModel(
          userModelName,
          createSchema({
            attributes: {
              name: 'String',
            },
            onDelete: {
              clean: [
                {
                  ref: shopModelName,
                  path: 'owner',
                },
              ],
            },
          }),
        );
        const Shop = createTestModel(shopModelName, {
          name: 'String',
          owner: {
            type: 'ObjectId',
            ref: userModelName,
          },
        });

        afterEach(async () => {
          await User.deleteMany({});
          await Shop.deleteMany({});
        });

        it('should delete hooked document', async () => {
          const user = await User.create({
            name: 'Barry',
          });
          await Shop.create({
            name: 'shop',
            owner: user,
          });
          await user.delete();

          const shops = await Shop.find();
          expect(shops).toEqual([]);
        });

        it('should delete multiple documents', async () => {
          const user = await User.create({
            name: 'Barry',
          });
          await Shop.create({
            name: 'shop1',
            owner: user,
          });
          await Shop.create({
            name: 'shop2',
            owner: user,
          });

          await user.delete();

          const shops = await Shop.find();

          expect(shops).toEqual([]);
        });

        it('should leave other documents untouched', async () => {
          const user1 = await User.create({
            name: 'Barry',
          });
          const user2 = await User.create({
            name: 'Larry',
          });

          await Shop.create({
            name: 'shop1',
            owner: user1,
          });
          await Shop.create({
            name: 'shop2',
            owner: user2,
          });

          await user1.delete();

          const shops = await Shop.find();

          expect(shops).toMatchObject([
            {
              name: 'shop2',
            },
          ]);
        });

        it('should not apply delete hooks when _id is tampered with', async () => {
          const user1 = await User.create({
            name: 'Barry',
          });
          const user2 = await User.create({
            name: 'Larry',
          });

          await Shop.create({
            name: 'shop1',
            owner: user1,
          });
          await Shop.create({
            name: 'shop2',
            owner: user2,
          });

          // Deleting _id shenanigans
          user1._id = null;

          await expect(async () => {
            await user1.delete();
          }).rejects.toThrow();

          expect(await Shop.countDocuments()).toBe(2);
        });

        it('should contain a list of the deleted refs', async () => {
          let user = await User.create({
            name: 'Barry',
          });
          const shop = await Shop.create({
            name: 'shop',
            owner: user,
          });
          await user.delete();

          expect(await Shop.countDocuments()).toBe(0);

          user = await User.findByIdDeleted(user.id);

          const [obj] = user.deletedRefs;
          expect(obj._id).toEqual(shop._id);
          expect(obj.ref).toEqual(shopModelName);
          expect(user.deletedRefs.length).toBe(1);
        });

        it('should not expose deleted refs list', async () => {
          const user = await User.create({
            name: 'Barry',
          });
          expect(user.toObject().deletedRefs).toBeUndefined();
        });

        it('should restore deleted foreign references', async () => {
          let user = await User.create({
            name: 'Barry',
          });

          await Shop.create({
            name: 'shop',
            owner: user,
          });

          await Shop.create({
            name: 'shop',
            owner: user,
          });

          await user.delete();

          expect(await User.countDocuments()).toBe(0);
          expect(await Shop.countDocuments()).toBe(0);

          await user.restore();

          expect(await User.countDocuments()).toBe(1);
          expect(await Shop.countDocuments()).toBe(2);

          user = await User.findById(user);
          expect(user.deletedRefs.length).toBe(0);
        });

        it('should restore if foreign document is not deleted', async () => {
          let user = await User.create({
            name: 'Barry',
          });

          let shop = await Shop.create({
            name: 'shop',
            owner: user,
          });

          await user.delete();

          expect(await Shop.countDocuments()).toBe(0);

          shop = await Shop.findByIdDeleted(shop.id);
          await shop.restore();

          expect(await Shop.countDocuments()).toBe(1);

          await expect(user.restore()).resolves.not.toThrow();
        });

        it('should not overwrite deleteRefs', async () => {
          let user = await User.create({
            name: 'Barry',
          });

          await Shop.create({
            name: 'shop',
            owner: user,
          });

          await user.delete();
          user = await User.findByIdDeleted(user.id);
          expect(user.deletedRefs.length).toBe(1);

          await user.delete();
          user = await User.findByIdDeleted(user.id);
          expect(user.deletedRefs.length).toBe(1);
        });
      });

      describe('multiple', () => {
        const userModelName = getTestModelName();
        const shopModelName = getTestModelName();

        const User = createTestModel(
          userModelName,
          createSchema({
            attributes: {
              name: 'String',
            },
            onDelete: {
              clean: [
                {
                  ref: shopModelName,
                  paths: ['owner', 'operator'],
                },
              ],
            },
          }),
        );
        const Shop = createTestModel(shopModelName, {
          name: 'String',
          owner: {
            type: 'ObjectId',
            ref: userModelName,
          },
          operator: {
            type: 'ObjectId',
            ref: userModelName,
          },
        });

        afterEach(async () => {
          await User.deleteMany({});
          await Shop.deleteMany({});
        });

        it('should delete referenced documents', async () => {
          const user = await User.create({
            name: 'Barry',
          });
          await Shop.create({
            name: 'shop 1',
            owner: user,
          });
          await Shop.create({
            name: 'shop 2',
            operator: user,
          });
          await user.delete();

          const shops = await Shop.find();
          expect(shops.length).toEqual(0);
        });

        it('should leave other documents untouched', async () => {
          const user1 = await User.create({
            name: 'Barry',
          });
          const user2 = await User.create({
            name: 'Larry',
          });

          await Shop.create({
            name: 'shop1',
            owner: user1,
          });
          await Shop.create({
            name: 'shop2',
            owner: user2,
          });

          await user1.delete();

          const shops = await Shop.find();

          expect(shops).toMatchObject([
            {
              name: 'shop2',
            },
          ]);
        });
      });

      describe('nested field', () => {
        const userModelName = getTestModelName();
        const shopModelName = getTestModelName();

        const User = createTestModel(
          userModelName,
          createSchema({
            attributes: {
              name: 'String',
            },
            onDelete: {
              clean: [
                {
                  ref: shopModelName,
                  path: 'info.owner',
                },
              ],
            },
          }),
        );
        const Shop = createTestModel(shopModelName, {
          name: 'String',
          info: {
            owner: {
              type: 'ObjectId',
              ref: userModelName,
            },
          },
        });

        afterEach(async () => {
          await User.deleteMany({});
          await Shop.deleteMany({});
        });

        it('should delete hooked document for nested field', async () => {
          const user = await User.create({
            name: 'Barry',
          });
          await Shop.create({
            name: 'shop',
            info: {
              owner: user,
            },
          });

          expect(await Shop.countDocuments()).toBe(1);

          await user.delete();
          expect(await Shop.countDocuments()).toBe(0);
        });

        it('should be able to restore deleted document', async () => {
          const user = await User.create({
            name: 'Barry',
          });
          await Shop.create({
            name: 'shop',
            info: {
              owner: user,
            },
          });

          await user.delete();
          expect(await User.countDocuments()).toBe(0);
          expect(await Shop.countDocuments()).toBe(0);

          await user.restore();
          expect(await User.countDocuments()).toBe(1);
          expect(await Shop.countDocuments()).toBe(1);
        });
      });

      describe('other', () => {
        it('should apply additional query fields to multiple paths', async () => {
          const userModelName = getTestModelName();
          const shopModelName = getTestModelName();

          const User = createTestModel(
            userModelName,
            createSchema({
              attributes: {
                name: 'String',
              },
              onDelete: {
                clean: [
                  {
                    ref: shopModelName,
                    paths: ['owner', 'administrator'],
                    query: {
                      status: 'active',
                    },
                  },
                ],
              },
            }),
          );
          const Shop = createTestModel(shopModelName, {
            status: {
              type: 'String',
              enum: ['active', 'inactive'],
            },
            owner: {
              type: 'ObjectId',
              ref: userModelName,
            },
            administrator: {
              type: 'ObjectId',
              ref: userModelName,
            },
          });

          const user = await User.create({
            name: 'Barry',
          });

          await Shop.create({
            status: 'active',
            owner: user,
          });

          await Shop.create({
            name: 'inactive',
            administrator: user,
          });

          await Shop.create({
            name: 'status',
            owner: user,
            administrator: user,
          });

          await Shop.create({
            name: 'inactive',
            owner: user,
            administrator: user,
          });

          await user.delete();

          expect(await Shop.countDocuments()).toBe(3);
        });

        it('should not delete everything in unbounded query', async () => {
          const userModelName = getTestModelName();
          const shopModelName = getTestModelName();

          const User = createTestModel(
            userModelName,
            createSchema({
              attributes: {
                name: 'String',
              },
              onDelete: {
                clean: [
                  {
                    ref: shopModelName,
                    path: 'owner',
                    query: {},
                  },
                ],
              },
            }),
          );

          const Shop = createTestModel(shopModelName, {
            name: 'String',
            owner: {
              type: 'ObjectId',
              ref: userModelName,
            },
          });

          const user1 = await User.create({
            name: 'Barry',
          });

          const user2 = await User.create({
            name: 'Larry',
          });

          await Shop.create({
            owner: user1,
          });

          await Shop.create({
            owner: user2,
          });

          await Shop.create({});

          await user1.delete();

          expect(await Shop.countDocuments()).toBe(2);
        });
      });

      describe('errors', () => {
        it('should not apply delete hooks when ref is misspelled', async () => {
          const userModelName = getTestModelName();
          const shopModelName = getTestModelName();
          const User = createTestModel(
            userModelName,
            createSchema({
              attributes: {
                name: 'String',
              },
              onDelete: {
                clean: [
                  {
                    ref: shopModelName,
                    path: 'ownerz',
                  },
                ],
              },
            }),
          );
          const Shop = createTestModel(shopModelName, {
            name: 'String',
            owner: {
              type: 'ObjectId',
              ref: userModelName,
            },
          });

          const user1 = await User.create({
            name: 'Barry',
          });
          const user2 = await User.create({
            name: 'Larry',
          });

          await Shop.create({
            name: 'shop1',
            owner: user1,
          });
          await Shop.create({
            name: 'shop2',
            owner: user2,
          });

          // Deleting _id shenanigans
          user1._id = null;

          await expect(async () => {
            await user1.delete();
          }).rejects.toThrow();

          expect(await Shop.countDocuments()).toBe(2);
        });
      });
    });
  });

  describe('errorOnReferenced', () => {
    describe('default', () => {
      const User = createTestModel({
        name: {
          type: 'String',
          required: true,
        },
      });

      const Shop = createTestModel({
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      });

      it('should not error if document is referenced externally', async () => {
        const user = await User.create({
          name: 'Barry',
        });
        await Shop.create({
          user,
        });

        await expect(user.delete()).resolves.not.toThrow();
      });
    });

    describe('error on all references', () => {
      const User = createTestModel(
        createSchema({
          attributes: {
            name: 'String',
          },
          onDelete: {
            errorOnReferenced: true,
          },
        }),
      );

      const Shop = createTestModel({
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      });

      it('should throw error if document is referenced externally', async () => {
        const user1 = await User.create({
          name: 'Barry',
        });
        const user2 = await User.create({
          name: 'Larry',
        });
        await Shop.create({
          user: user1,
        });

        await expect(async () => {
          await user1.delete();
        }).rejects.toThrow(`Refusing to delete ${User.modelName}.`);

        await expect(user2.delete()).resolves.not.toThrow();
      });

      it('should expose references on the error object', async () => {
        const user = await User.create({
          name: 'Barry',
        });
        const shop = await Shop.create({
          user,
        });

        try {
          await user.delete();
        } catch (error) {
          const data = JSON.parse(JSON.stringify(error));
          expect(data).toEqual({
            details: [
              {
                ids: [shop.id],
                path: 'user',
                model: Shop.modelName,
                message: `Referenced as "user" by ${Shop.modelName}: ${shop.id}.`,
              },
            ],
          });
        }
      });
    });

    describe('error with exceptions', () => {
      const userModelName = getTestModelName();
      const shopModelName = getTestModelName();
      const auditEntryModelName = getTestModelName();

      const User = createTestModel(
        userModelName,
        createSchema({
          attributes: {
            name: 'String',
          },
          onDelete: {
            errorOnReferenced: {
              except: [auditEntryModelName],
            },
          },
        }),
      );

      const Shop = createTestModel(shopModelName, {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      });

      const AuditEntry = createTestModel(auditEntryModelName, {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      });

      it('should not throw error on excepted references', async () => {
        const user1 = await User.create({
          name: 'Barry',
        });
        const user2 = await User.create({
          name: 'Larry',
        });
        await Shop.create({
          user: user1,
        });
        await AuditEntry.create({
          user: user2,
        });

        await expect(async () => {
          await user1.delete();
        }).rejects.toThrow(`Refusing to delete ${User.modelName}.`);

        await expect(user2.delete()).resolves.not.toThrow();
      });
    });

    describe('error with only', () => {
      const userModelName = getTestModelName();
      const shopModelName = getTestModelName();
      const auditEntryModelName = getTestModelName();

      const User = createTestModel(
        userModelName,
        createSchema({
          attributes: {
            name: 'String',
          },
          onDelete: {
            errorOnReferenced: {
              only: [shopModelName],
            },
          },
        }),
      );

      const Shop = createTestModel(shopModelName, {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      });

      const AuditEntry = createTestModel(auditEntryModelName, {
        user: {
          type: 'ObjectId',
          ref: User.modelName,
        },
      });

      it('should not throw an error on shop references', async () => {
        const user1 = await User.create({
          name: 'Barry',
        });
        const user2 = await User.create({
          name: 'Larry',
        });

        await Shop.create({
          user: user1,
        });

        await AuditEntry.create({
          user: user2,
        });

        await expect(async () => {
          await user1.delete();
        }).rejects.toThrow(`Refusing to delete ${User.modelName}.`);

        await expect(user2.delete()).resolves.not.toThrow();
      });
    });

    describe('validation', () => {
      it('should throw error if except contains unknown model', async () => {
        const User = createTestModel(
          createSchema({
            attributes: {
              name: 'String',
            },
            onDelete: {
              errorOnReferenced: {
                except: ['BadModelName'],
              },
            },
          }),
        );
        const user = await User.create({
          name: 'Barry',
        });
        await expect(user.delete()).rejects.toThrow(
          'Unknown model "BadModelName".',
        );
      });
    });
  });

  describe('other', () => {
    describe('error interop with deletion', () => {
      const userModelName = getTestModelName();
      const shopModelName = getTestModelName();
      const productModelName = getTestModelName();

      const User = createTestModel(
        userModelName,
        createSchema({
          attributes: {
            name: 'String',
          },
          onDelete: {
            errorOnReferenced: true,
            clean: [
              {
                ref: shopModelName,
                path: 'owner',
              },
            ],
          },
        }),
      );

      const Shop = createTestModel(
        shopModelName,
        createSchema({
          attributes: {
            name: 'String',
            owner: {
              type: 'ObjectId',
              ref: userModelName,
            },
          },
          onDelete: {
            errorOnReferenced: true,
          },
        }),
      );

      const Product = createTestModel(productModelName, {
        name: 'String',
        shop: {
          type: 'ObjectId',
          ref: shopModelName,
        },
      });

      it('should not error after foreign reference is deleted', async () => {
        const user = await User.create({
          name: 'Barry',
        });

        await Shop.create({
          owner: user,
        });

        await expect(user.delete()).resolves.not.toThrow();
      });

      it('should not have deleted foreign references if an error was thrown', async () => {
        const user = await User.create({
          name: 'Barry',
        });

        await Shop.create({
          owner: user,
        });

        const shop = await Shop.create({
          owner: user,
        });

        await Product.create({
          shop,
        });

        await expect(async () => {
          await user.delete();
        }).rejects.toThrow();

        expect(await User.countDocuments()).toBe(1);
        expect(await Shop.countDocuments()).toBe(2);
        expect(await Product.countDocuments()).toBe(1);
      });

      it('should not have deleted local references if an error was thrown', async () => {
        const userModelName = getTestModelName();
        const shopModelName = getTestModelName();
        const productModelName = getTestModelName();

        const User = createTestModel(
          userModelName,
          createSchema({
            attributes: {
              name: 'String',
              shops: [
                {
                  type: 'ObjectId',
                  ref: shopModelName,
                },
              ],
            },
            onDelete: {
              clean: [
                {
                  path: 'shops',
                },
              ],
            },
          }),
        );

        const Shop = createTestModel(
          shopModelName,
          createSchema({
            attributes: {
              name: 'String',
            },
            onDelete: {
              errorOnReferenced: true,
            },
          }),
        );

        const Product = createTestModel(productModelName, {
          shop: {
            type: 'ObjectId',
            ref: shopModelName,
          },
        });

        const shop1 = await Shop.create({
          name: 'shop-1',
        });

        const shop2 = await Shop.create({
          name: 'shop-2',
        });

        let user = await User.create({
          name: 'Barry',
          shops: [shop1.id, shop2.id],
        });

        await Product.create({
          shop: shop2,
        });

        await expect(async () => {
          await user.delete();
        }).rejects.toThrow();

        expect(await User.countDocuments()).toBe(1);
        expect(await Shop.countDocuments()).toBe(2);
        expect(await Product.countDocuments()).toBe(1);

        user = await User.findById(user.id);
        expect(user.shops).toEqual([shop1._id, shop2._id]);
      });
    });

    describe('error interop with only', () => {
      const userModelName = getTestModelName();
      const shopModelName = getTestModelName();

      const User = createTestModel(
        userModelName,
        createSchema({
          attributes: {
            name: 'String',
          },
          onDelete: {
            errorOnReferenced: {
              only: [shopModelName],
            },
            clean: [
              {
                ref: shopModelName,
                path: 'owner',
              },
            ],
          },
        }),
      );

      const Shop = createTestModel(
        shopModelName,
        createSchema({
          attributes: {
            name: 'String',
            owner: {
              type: 'ObjectId',
              ref: userModelName,
            },
          },
        }),
      );

      it('should not error if model is going to be cleaned', async () => {
        const user = await User.create({
          name: 'Barry',
        });

        await Shop.create({
          owner: user,
        });

        await expect(user.delete()).resolves.not.toThrow();
      });
    });

    describe('chained deletes', () => {
      it('should delete in a chain', async () => {
        const userModelName = getTestModelName();
        const shopModelName = getTestModelName();
        const productModelName = getTestModelName();

        const User = createTestModel(
          userModelName,
          createSchema({
            attributes: {
              name: 'String',
            },
            onDelete: {
              clean: [
                {
                  ref: shopModelName,
                  path: 'owner',
                },
              ],
            },
          }),
        );

        const Shop = createTestModel(
          shopModelName,
          createSchema({
            attributes: {
              name: 'String',
              owner: {
                type: 'ObjectId',
                ref: userModelName,
              },
            },
            onDelete: {
              clean: [
                {
                  ref: productModelName,
                  path: 'shop',
                },
              ],
            },
          }),
        );

        const Product = createTestModel(productModelName, {
          shop: {
            type: 'ObjectId',
            ref: shopModelName,
          },
        });

        const user = await User.create({
          name: 'Barry',
        });

        const shop = await Shop.create({
          owner: user,
        });

        await Product.create({
          name: 'Product 1',
          shop,
        });

        await Product.create({
          name: 'Product 2',
          shop,
        });

        await user.delete();

        expect(await User.countDocuments()).toBe(0);
        expect(await Shop.countDocuments()).toBe(0);
        expect(await Product.countDocuments()).toBe(0);
      });

      it('should not proceed on nested document error', async () => {
        const userModelName = getTestModelName();
        const shopModelName = getTestModelName();
        const productModelName = getTestModelName();

        const User = createTestModel(
          userModelName,
          createSchema({
            attributes: {
              name: 'String',
            },
            onDelete: {
              clean: [
                {
                  ref: shopModelName,
                  path: 'owner',
                },
              ],
            },
          }),
        );

        const Shop = createTestModel(
          shopModelName,
          createSchema({
            attributes: {
              name: 'String',
              owner: {
                type: 'ObjectId',
                ref: userModelName,
              },
            },
            onDelete: {
              errorOnReferenced: true,
            },
          }),
        );

        const Product = createTestModel(productModelName, {
          shop: {
            type: 'ObjectId',
            ref: shopModelName,
          },
        });

        const user = await User.create({
          name: 'Barry',
        });

        const shop = await Shop.create({
          owner: user,
        });

        await Product.create({
          name: 'Product 1',
          shop,
        });

        await Product.create({
          name: 'Product 2',
          shop,
        });

        await expect(async () => {
          await user.delete();
        }).rejects.toThrow();

        expect(await User.countDocuments()).toBe(1);
        expect(await Shop.countDocuments()).toBe(1);
        expect(await Product.countDocuments()).toBe(2);
      });

      it('should refuse to delete when local document errored', async () => {
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

        const UserProfile = createTestModel(
          userProfileModelName,
          createSchema({
            attributes: {
              name: 'String',
            },
            onDelete: {
              errorOnReferenced: true,
            },
          }),
        );

        const profile = await UserProfile.create({
          name: 'Barry',
        });

        let user = await User.create({
          profile,
        });

        user = await User.findById(user);

        await expect(async () => {
          await user.delete();
        }).rejects.toThrow();

        expect(await User.countDocuments()).toBe(1);
        expect(await UserProfile.countDocuments()).toBe(1);
      });

      it('should allow exception defined on subdocument model', async () => {
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

        const UserProfile = createTestModel(
          userProfileModelName,
          createSchema({
            attributes: {
              name: 'String',
            },
            onDelete: {
              errorOnReferenced: {
                except: [userModelName],
              },
            },
          }),
        );

        const profile = await UserProfile.create({
          name: 'Barry',
        });

        let user = await User.create({
          profile,
        });

        user = await User.findById(user);

        await user.delete();

        expect(await User.countDocuments()).toBe(0);
        expect(await UserProfile.countDocuments()).toBe(0);
      });
    });

    describe('circular references', () => {
      it('should not error on foreign reference cleanup', async () => {
        const userModelName = getTestModelName();
        const shopModelName = getTestModelName();

        const User = createTestModel(
          userModelName,
          createSchema({
            attributes: {
              name: 'String',
              shop: {
                type: 'ObjectId',
                ref: shopModelName,
              },
            },
            onDelete: {
              clean: [
                {
                  ref: shopModelName,
                  path: 'owner',
                },
              ],
            },
          }),
        );

        const Shop = createTestModel(
          shopModelName,
          createSchema({
            attributes: {
              name: 'String',
              owner: {
                type: 'ObjectId',
                ref: userModelName,
              },
            },
          }),
        );

        const user = new User({
          name: 'Barry',
        });

        const shop = new Shop({
          owner: user,
        });

        user.shop = shop;

        await user.save();
        await shop.save();

        await user.delete();

        expect(await User.countDocuments()).toBe(0);
        expect(await Shop.countDocuments()).toBe(0);
      });

      it('should error on foreign references', async () => {
        const userModelName = getTestModelName();
        const shopModelName = getTestModelName();

        const User = createTestModel(
          userModelName,
          createSchema({
            attributes: {
              name: 'String',
              shop: {
                type: 'ObjectId',
                ref: shopModelName,
              },
            },
            onDelete: {
              errorOnReferenced: true,
            },
          }),
        );

        const Shop = createTestModel(
          shopModelName,
          createSchema({
            attributes: {
              name: 'String',
              owner: {
                type: 'ObjectId',
                ref: userModelName,
              },
            },
          }),
        );

        const user = new User({
          name: 'Barry',
        });

        const shop = new Shop({
          owner: user,
        });

        user.shop = shop;

        await user.save();
        await shop.save();

        await expect(async () => {
          await user.delete();
        }).rejects.toThrow();

        expect(await User.countDocuments()).toBe(1);
        expect(await Shop.countDocuments()).toBe(1);
      });

      it('should error on reverse references', async () => {
        const userModelName = getTestModelName();
        const shopModelName = getTestModelName();

        const User = createTestModel(
          userModelName,
          createSchema({
            attributes: {
              name: 'String',
              shop: {
                type: 'ObjectId',
                ref: shopModelName,
              },
            },
            onDelete: {
              clean: [
                {
                  ref: shopModelName,
                  path: 'owner',
                },
              ],
            },
          }),
        );

        const Shop = createTestModel(
          shopModelName,
          createSchema({
            attributes: {
              name: 'String',
              owner: {
                type: 'ObjectId',
                ref: userModelName,
              },
            },
            onDelete: {
              errorOnReferenced: true,
            },
          }),
        );

        const user = new User({
          name: 'Barry',
        });

        const shop = new Shop({
          owner: user,
        });

        user.shop = shop;

        await user.save();
        await shop.save();

        await expect(async () => {
          await user.delete();
        }).rejects.toThrow();

        expect(await User.countDocuments()).toBe(1);
        expect(await Shop.countDocuments()).toBe(1);
      });
    });

    describe('static methods', () => {
      const userModelName = getTestModelName();
      const shopModelName = getTestModelName();

      const User = createTestModel(
        userModelName,
        createSchema({
          attributes: {
            name: 'String',
          },
          onDelete: {
            clean: [
              {
                ref: shopModelName,
                path: 'owner',
              },
            ],
          },
        }),
      );
      const Shop = createTestModel(shopModelName, {
        name: 'String',
        owner: {
          type: 'ObjectId',
          ref: userModelName,
        },
      });

      afterEach(async () => {
        await User.deleteMany({});
        await Shop.deleteMany({});
      });

      it('should not run delete hooks for deleteOne', async () => {
        const user = await User.create({
          name: 'Barry',
        });

        await Shop.create({
          owner: user,
        });

        await User.deleteOne({
          name: 'Barry',
        });

        expect(await User.countDocuments()).toBe(0);
        expect(await Shop.countDocuments()).toBe(1);
      });

      it('should not run delete hooks for deleteMany', async () => {
        const user = await User.create({
          name: 'Barry',
        });

        await Shop.create({
          owner: user,
        });

        await User.deleteMany({
          name: 'Barry',
        });

        expect(await User.countDocuments()).toBe(0);
        expect(await Shop.countDocuments()).toBe(1);
      });
    });
  });
});
