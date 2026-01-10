import mongoose from 'mongoose';

import { loadModel, loadModelDir, loadSchema } from '../src/load';

describe('loadModel', () => {
  it('should load basic model', async () => {
    expect(!!mongoose.models.Box).toBe(false);
    const Box = loadModel(
      {
        attributes: {
          name: {
            type: 'String',
            validate: /[a-z]/,
          },
        },
      },
      'Box',
    );
    expect(!!mongoose.models.Box).toBe(true);
    const box = new Box({ name: 'foo' });

    expect(box.name).toBe('foo');

    await expect(async () => {
      box.name = 'FOO';
      await box.save();
    }).rejects.toThrow();
  });
});

describe('loadSchema', () => {
  it('should load schema with comments', async () => {
    const schema = loadSchema('test/definitions/model-with-comments');
    expect(schema.obj).toEqual({
      name: {
        trim: true,
        type: 'String',
      },
      createdAt: {
        type: 'Date',
      },
      deleted: {
        default: false,
        type: 'Boolean',
      },
      deletedAt: {
        type: 'Date',
      },
      updatedAt: {
        type: 'Date',
      },
    });
  });

  it('should load with extension', async () => {
    const schema = loadSchema('test/definitions/model-with-comments.jsonc');
    expect(schema.obj).toMatchObject({
      name: {
        trim: true,
        type: 'String',
      },
    });
  });

  it('should error on non-JSON extensions', async () => {
    expect(() => {
      loadSchema('test/definitions/model.js');
    }).toThrow('Schema files must be .json or .jsonc');
  });
});

describe('loadModelDir', () => {
  it('should create models from a folder', async () => {
    expect(!!mongoose.models.SpecialCategory).toBe(false);
    expect(!!mongoose.models.CustomModel).toBe(false);
    expect(!!mongoose.models.ModelWithComments).toBe(false);
    loadModelDir('test/definitions');
    expect(!!mongoose.models.SpecialCategory).toBe(true);
    expect(!!mongoose.models.CustomModel).toBe(true);
    expect(!!mongoose.models.ModelWithComments).toBe(true);
    const { SpecialCategory } = mongoose.models;
    await SpecialCategory.deleteMany({});
    const someRef = new mongoose.Types.ObjectId();
    const category = new SpecialCategory({ name: 'foo', someRef, count: 3 });
    await category.save();
    const foundCategory = await SpecialCategory.findOne();
    expect(foundCategory.name).toBe('foo');
    expect(foundCategory.someRef.toString()).toBe(someRef.toString());
    expect(foundCategory.count).toBe(3);

    delete mongoose.models['SpecialCategory'];
    delete mongoose.models['CustomModel'];
    delete mongoose.models['ModelWithComments'];
  });
});
