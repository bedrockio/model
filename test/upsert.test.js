import { createSchema } from '../src/schema';
import { createTestModel } from '../src/testing';

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

describe('upsert', () => {
  it('should create a new document', async () => {
    const user = await User.upsert({
      name: 'foo',
    });
    expect(user.name).toBe('foo');
  });

  it('should find existing document', async () => {
    const user1 = await User.create({
      name: 'foo',
    });

    const user2 = await User.upsert({
      name: 'foo',
    });

    expect(user2.id).toBe(user1.id);
  });

  it('should pass all fields on create', async () => {
    const user = await User.upsert(
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

  it('should update existing document', async () => {
    const user1 = await User.create({
      name: 'foo',
      email: 'foo1@bar.com',
    });

    const user2 = await User.upsert(
      {
        name: 'foo',
      },
      {
        name: 'foo',
        email: 'foo2@bar.com',
      },
    );

    expect(user2.id).toBe(user1.id);
    expect(user2.name).toBe('foo');
    expect(user2.email).toBe('foo2@bar.com');
  });

  it('should not pass the query into insert fields', async () => {
    const user = await User.upsert(
      {
        name: { $ne: 'foo' },
      },
      {
        email: 'foo2@bar.com',
      },
    );
    expect(user.email).toBe('foo2@bar.com');
  });

  it('should run hooks', async () => {
    const user = await User.upsert({
      name: 'foo',
    });
    expect(user.generated).toBe('generated');
  });
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

    expect(user2.id).toBe(user1.id);
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

  it('should not update existing document', async () => {
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
    expect(user2.id).toBe(user1.id);
    expect(user2.name).toBe('foo');
    expect(user2.email).toBe('foo1@bar.com');
  });

  it('should not pass the query into insert fields', async () => {
    const user = await User.findOrCreate(
      {
        name: { $ne: 'foo' },
      },
      {
        email: 'foo2@bar.com',
      },
    );
    expect(user.email).toBe('foo2@bar.com');
  });

  it('should run hooks', async () => {
    const user = await User.findOrCreate({
      name: 'foo',
    });
    expect(user.generated).toBe('generated');
  });
});
