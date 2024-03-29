import { createTestModel } from '../src/testing';

describe('disallowed', () => {
  it('should not allow remove on document', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const user = await User.create({
      name: 'foo',
    });
    await user.delete();

    expect(() => {
      user.remove();
    }).toThrow();
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
    }).toThrow();
  });

  it('should not allow update on document', async () => {
    const User = createTestModel({
      name: 'String',
    });
    const user = await User.create({
      name: 'foo',
    });

    expect(() => {
      user.update();
    }).toThrow();
  });

  it('should not allow remove on model', async () => {
    const User = createTestModel({
      name: 'String',
    });
    expect(() => {
      User.remove();
    }).toThrow();
  });

  it('should not allow update on model', async () => {
    const User = createTestModel({
      name: 'String',
    });
    expect(() => {
      User.update();
    }).toThrow();
  });

  it('should not allow findOneAndRemove on model', async () => {
    const User = createTestModel({
      name: 'String',
    });
    expect(() => {
      User.findOneAndRemove();
    }).toThrow();
  });

  it('should not allow findByIdAndRemove on model', async () => {
    const User = createTestModel({
      name: 'String',
    });
    expect(() => {
      User.findByIdAndRemove();
    }).toThrow();
  });

  it('should not allow count on model', async () => {
    const User = createTestModel({
      name: 'String',
    });
    expect(() => {
      User.count();
    }).toThrow();
  });
});
