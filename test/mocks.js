import { createSchema } from '../src/schema';
import { createTestModel, getTestModelName } from '../src/testing';

const userModelName = getTestModelName();
const shopModelName = getTestModelName();
const uploadModelName = getTestModelName();
const productModelName = getTestModelName();
const commentModelName = getTestModelName();

const userSchema = createSchema({
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
      ref: uploadModelName,
    },
    address: {
      line1: 'String',
      line2: 'String',
    },
    profile: {
      url: {
        type: 'String',
      },
    },
    friends: [
      {
        type: 'ObjectId',
        ref: userModelName,
      },
    ],
    likedProducts: [
      {
        ref: productModelName,
        type: 'ObjectId',
      },
    ],
    tags: ['String'],
    roles: [
      {
        role: 'String',
        scope: 'String',
      },
    ],
    self: {
      ref: userModelName,
      type: 'ObjectId',
    },
    hidden: {
      type: 'String',
      readAccess: 'none',
    },
  },
});

userSchema.virtual('firstName').get(function () {
  if (this.name) {
    return this.name.split(' ')[0];
  }
});

userSchema.pre('save', function () {
  if (this.name === 'Generate') {
    this.generated = 'generated';
  }
});

const shopSchema = createSchema({
  attributes: {
    name: 'String',
    email: 'String',
    tags: ['String'],
    user: {
      ref: userModelName,
      type: 'ObjectId',
    },
    customers: [
      {
        ref: userModelName,
        type: 'ObjectId',
      },
    ],
    inventory: [
      {
        quantity: 'Number',
        product: {
          ref: productModelName,
          type: 'ObjectId',
        },
      },
    ],
    // inventory: {
    //   type: 'Array',
    //   attributes: {
    //     quantity: 'Number',
    //     product: {
    //       ref: productModelName,
    //       type: 'ObjectId',
    //     },
    //   },
    // },
    deep: {
      type: 'Object',
      attributes: {
        user: {
          ref: userModelName,
          type: 'ObjectId',
        },
      },
    },
  },
});

const productSchema = createSchema({
  attributes: {
    name: 'String',
    email: 'String',
    tags: ['String'],
    shop: {
      type: 'ObjectId',
      ref: shopModelName,
    },
    owner: {
      type: 'ObjectId',
      ref: userModelName,
    },
  },
});

productSchema.virtual('comments', {
  ref: commentModelName,
  localField: '_id',
  foreignField: 'product',
  justOne: false,
});

const commentSchema = createSchema({
  attributes: {
    body: 'String',
    product: {
      ref: productModelName,
      type: 'ObjectId',
    },
  },
});

const uploadSchema = createSchema({
  attributes: {
    owner: {
      type: 'ObjectId',
      ref: userModelName,
    },
  },
});

afterEach(async () => {
  await User.deleteMany({});
  await Shop.deleteMany({});
  await Upload.deleteMany({});
  await Product.deleteMany({});
  await Comment.deleteMany({});
});

export const User = createTestModel(userModelName, userSchema);
export const Shop = createTestModel(shopModelName, shopSchema);
export const Upload = createTestModel(uploadModelName, uploadSchema);
export const Product = createTestModel(productModelName, productSchema);
export const Comment = createTestModel(commentModelName, commentSchema);
