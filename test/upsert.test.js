import { createTestModel } from '../src/testing';
import { createSchema } from '../src/schema';

const schema = createSchema({
  attributes: {
    name: 'String',
    email: 'String',
    generated: 'String',
  },
});

schema.pre('save', function () {
  this.generated = 'generated';
});

const User = createTestModel(schema);

afterEach(async () => {
  await User.deleteMany({});
});

describe('findOrCreate', () => {
  it('should create a new document', async () => {
    const user = await User.findOrCreate({
      name: 'foo',
    });
    expect(user.name).toBe('foo');
  });

  it('should find existing document', async () => {
    const user1 = await User.create({
      name: 'foo',
    });

    const user2 = await User.findOrCreate({
      name: 'foo',
    });

    expect(user1.id).toBe(user2.id);
  });

  it('should allow passing extra fields on upsert', async () => {
    const user = await User.findOrCreate(
      {
        name: 'foo',
      },
      {
        name: 'foo',
        email: 'foo@bar.com',
      },
    );
    expect(user.name).toBe('foo');
    expect(user.email).toBe('foo@bar.com');
  });

  it('should find existing document with additional fields', async () => {
    const user1 = await User.create({
      name: 'foo',
      email: 'foo1@bar.com',
    });

    const user2 = await User.findOrCreate(
      {
        name: 'foo',
      },
      {
        name: 'foo',
        email: 'foo2@bar.com',
      },
    );
    expect(user1.id).toBe(user2.id);
    expect(user1.name).toBe('foo');
    expect(user1.email).toBe('foo1@bar.com');
  });

  it('should run hooks', async () => {
    const user = await User.findOrCreate({
      name: 'foo',
    });
    expect(user.generated).toBe('generated');
  });
});
