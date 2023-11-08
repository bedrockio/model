import { getTestModelName, createTestModel } from '../src/testing';
import { createSchema } from '../src/schema';

describe('delete hooks', () => {
  describe('local references', () => {
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
          delete: {
            local: 'profile',
          },
        })
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

        const userProfiles = await UserProfile.find();
        expect(userProfiles).toEqual([]);
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

        const userProfiles = await UserProfile.find();
        expect(userProfiles).toEqual([]);
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
          delete: {
            local: ['profiles'],
          },
        })
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

        const userProfiles = await UserProfile.find();
        expect(userProfiles).toEqual([]);
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

        const userProfiles = await UserProfile.find();
        expect(userProfiles).toEqual([]);
      });
    });

    describe('errors', () => {
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
            delete: {
              local: ['profilez'],
            },
          });
        }).toThrow();
      });
    });
  });

  describe('foreign references', () => {
    describe('simple', () => {
      const userModelName = getTestModelName();
      const shopModelName = getTestModelName();

      const User = createTestModel(
        userModelName,
        createSchema({
          attributes: {
            name: 'String',
          },
          delete: {
            foreign: {
              [shopModelName]: 'owner',
            },
          },
        })
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
          delete: {
            foreign: {
              [shopModelName]: 'info.owner',
            },
          },
        })
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

        let shops;

        shops = await Shop.find({
          'info.owner': user.id,
        });
        expect(shops.length).toBe(1);

        await user.delete();

        shops = await Shop.find({
          'info.owner': user.id,
        });
        expect(shops.length).toBe(0);
      });
    });

    describe('$and operator', () => {
      const userModelName = getTestModelName();
      const shopModelName = getTestModelName();

      const User = createTestModel(
        userModelName,
        createSchema({
          attributes: {
            name: 'String',
          },
          delete: {
            foreign: {
              [shopModelName]: {
                $and: ['owner', 'administrator'],
              },
            },
          },
        })
      );
      const Shop = createTestModel(shopModelName, {
        name: 'String',
        owner: {
          type: 'ObjectId',
          ref: userModelName,
        },
        administrator: {
          type: 'ObjectId',
          ref: userModelName,
        },
      });

      afterEach(async () => {
        await User.deleteMany({});
        await Shop.deleteMany({});
      });

      it('should only documents that are both owners and administrators', async () => {
        const user = await User.create({
          name: 'Barry',
        });
        await Shop.create({
          name: 'shop1',
          owner: user,
        });
        await Shop.create({
          name: 'shop2',
          administrator: user,
        });
        await Shop.create({
          name: 'shop3',
          owner: user,
          administrator: user,
        });

        await user.delete();

        const shops = await Shop.find().sort({ name: 1 });
        expect(shops).toMatchObject([
          {
            name: 'shop1',
          },
          {
            name: 'shop2',
          },
        ]);
      });
    });

    describe('$or operator', () => {
      const userModelName = getTestModelName();
      const shopModelName = getTestModelName();

      const User = createTestModel(
        userModelName,
        createSchema({
          attributes: {
            name: 'String',
          },
          delete: {
            foreign: {
              [shopModelName]: {
                $or: ['owner', 'administrator'],
              },
            },
          },
        })
      );
      const Shop = createTestModel(shopModelName, {
        name: 'String',
        owner: {
          type: 'ObjectId',
          ref: userModelName,
        },
        administrator: {
          type: 'ObjectId',
          ref: userModelName,
        },
      });

      afterEach(async () => {
        await User.deleteMany({});
        await Shop.deleteMany({});
      });

      it('should delete both documents with $or query', async () => {
        const user = await User.create({
          name: 'Barry',
        });
        await Shop.create({
          name: 'shop1',
          owner: user,
        });
        await Shop.create({
          name: 'shop2',
          administrator: user,
        });

        await user.delete();

        const shops = await Shop.find();
        expect(shops.length).toBe(0);
      });
    });

    describe('errors', () => {
      it('should error if both $and and $or are defined', async () => {
        expect(() => {
          createTestModel(
            createSchema({
              attributes: {
                name: 'String',
              },
              delete: {
                foreign: {
                  Shop: {
                    $and: ['owner'],
                    $or: ['administrator'],
                  },
                },
              },
            })
          );
        }).toThrow();
      });

      it('should not apply delete hooks when ref is misspelled', async () => {
        const userModelName = getTestModelName();
        const shopModelName = getTestModelName();
        const User = createTestModel(
          userModelName,
          createSchema({
            attributes: {
              name: 'String',
            },
            delete: {
              foreign: {
                [shopModelName]: 'ownerz',
              },
            },
          })
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
          delete: {
            errorOnReferenced: true,
          },
        })
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
        }).rejects.toThrow(
          `Refusing to delete ${User.modelName} referenced by ${Shop.modelName}.`
        );

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
          expect(error.references).toEqual([
            {
              model: Shop,
              count: 1,
              ids: [shop.id],
            },
          ]);
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
          delete: {
            errorOnReferenced: {
              except: [auditEntryModelName],
            },
          },
        })
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
        }).rejects.toThrow(
          `Refusing to delete ${User.modelName} referenced by ${Shop.modelName}.`
        );

        await expect(user2.delete()).resolves.not.toThrow();
      });
    });

    describe('errors', () => {
      it('should throw error if except contains unknown model', async () => {
        const User = createTestModel(
          createSchema({
            attributes: {
              name: 'String',
            },
            delete: {
              errorOnReferenced: {
                except: ['BadModelName'],
              },
            },
          })
        );
        const user = await User.create({
          name: 'Barry',
        });
        await expect(user.delete()).rejects.toThrow(
          'Unknown model "BadModelName".'
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
          delete: {
            errorOnReferenced: true,
            foreign: {
              [shopModelName]: 'owner',
            },
          },
        })
      );

      const Shop = createTestModel(shopModelName, {
        name: 'String',
        owner: {
          type: 'ObjectId',
          ref: userModelName,
        },
      });

      const Product = createTestModel(productModelName, {
        name: 'String',
        owner: {
          type: 'ObjectId',
          ref: userModelName,
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

      it('should not have deleted anything if an error was thrown', async () => {
        const user = await User.create({
          name: 'Barry',
        });

        await Shop.create({
          owner: user,
        });

        await Product.create({
          owner: user,
        });

        await expect(async () => {
          await user.delete();
        }).rejects.toThrow();

        expect(await Shop.countDocuments()).toBe(1);
        expect(await Product.countDocuments()).toBe(1);
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
            delete: {
              foreign: {
                [shopModelName]: 'owner',
              },
            },
          })
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
            delete: {
              foreign: {
                [productModelName]: 'shop',
              },
            },
          })
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
            delete: {
              foreign: {
                [shopModelName]: 'owner',
              },
            },
          })
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
            delete: {
              errorOnReferenced: true,
            },
          })
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
            delete: {
              local: 'profile',
            },
          })
        );

        const UserProfile = createTestModel(
          userProfileModelName,
          createSchema({
            attributes: {
              name: 'String',
            },
            delete: {
              errorOnReferenced: true,
            },
          })
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
            delete: {
              local: 'profile',
            },
          })
        );

        const UserProfile = createTestModel(
          userProfileModelName,
          createSchema({
            attributes: {
              name: 'String',
            },
            delete: {
              errorOnReferenced: {
                except: [userModelName],
              },
            },
          })
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
            delete: {
              foreign: {
                [shopModelName]: 'owner',
              },
            },
          })
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
          })
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
            delete: {
              errorOnReferenced: true,
            },
          })
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
          })
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
            delete: {
              foreign: {
                [shopModelName]: 'owner',
              },
            },
          })
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
            delete: {
              errorOnReferenced: true,
            },
          })
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
          delete: {
            foreign: {
              [shopModelName]: 'owner',
            },
          },
        })
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