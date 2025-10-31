import { User } from './mocks';

describe('upsert', () => {
  it('should create a new document', async () => {
    const user = await User.upsert({
      name: 'Frank Reynolds',
    });
    expect(user.name).toBe('Frank Reynolds');
  });

  it('should find existing document', async () => {
    const user1 = await User.create({
      name: 'Frank Reynolds',
    });

    const user2 = await User.upsert({
      name: 'Frank Reynolds',
    });

    expect(user2.id).toBe(user1.id);
  });

  it('should pass all fields on create', async () => {
    const user = await User.upsert(
      {
        name: 'Frank Reynolds',
      },
      {
        name: 'Frank Reynolds',
        email: 'foo@bar.com',
      },
    );
    expect(user.name).toBe('Frank Reynolds');
    expect(user.email).toBe('foo@bar.com');
  });

  it('should update existing document', async () => {
    const user1 = await User.create({
      name: 'Frank Reynolds',
      email: 'foo1@bar.com',
    });

    const user2 = await User.upsert(
      {
        name: 'Frank Reynolds',
      },
      {
        name: 'Frank Reynolds',
        email: 'foo2@bar.com',
      },
    );

    expect(user2.id).toBe(user1.id);
    expect(user2.name).toBe('Frank Reynolds');
    expect(user2.email).toBe('foo2@bar.com');
  });

  it('should not pass the query into insert fields', async () => {
    const user = await User.upsert(
      {
        name: { $ne: 'Frank Reynolds' },
      },
      {
        name: 'Frank Reynolds',
        email: 'foo2@bar.com',
      },
    );
    expect(user.email).toBe('foo2@bar.com');
  });

  it('should run hooks', async () => {
    const user = await User.upsert({
      name: 'Generate',
    });
    expect(user.generated).toBe('generated');
  });
});

describe('findOrCreate', () => {
  it('should create a new document', async () => {
    const user = await User.findOrCreate({
      name: 'Frank Reynolds',
    });
    expect(user.name).toBe('Frank Reynolds');
  });

  it('should find existing document', async () => {
    const user1 = await User.create({
      name: 'Frank Reynolds',
    });

    const user2 = await User.findOrCreate({
      name: 'Frank Reynolds',
    });

    expect(user2.id).toBe(user1.id);
  });

  it('should allow passing extra fields on upsert', async () => {
    const user = await User.findOrCreate(
      {
        name: 'Frank Reynolds',
      },
      {
        name: 'Frank Reynolds',
        email: 'foo@bar.com',
      },
    );
    expect(user.name).toBe('Frank Reynolds');
    expect(user.email).toBe('foo@bar.com');
  });

  it('should not update existing document', async () => {
    const user1 = await User.create({
      name: 'Frank Reynolds',
      email: 'foo1@bar.com',
    });

    const user2 = await User.findOrCreate(
      {
        name: 'Frank Reynolds',
      },
      {
        name: 'Frank Reynolds',
        email: 'foo2@bar.com',
      },
    );
    expect(user2.id).toBe(user1.id);
    expect(user2.name).toBe('Frank Reynolds');
    expect(user2.email).toBe('foo1@bar.com');
  });

  it('should not pass the query into insert fields', async () => {
    const user = await User.findOrCreate(
      {
        name: { $ne: 'Frank Reynolds' },
      },
      {
        name: 'Frank Reynolds',
        email: 'foo2@bar.com',
      },
    );
    expect(user.email).toBe('foo2@bar.com');
  });

  it('should run hooks', async () => {
    const user = await User.findOrCreate({
      name: 'Generate',
    });
    expect(user.generated).toBe('generated');
  });
});
