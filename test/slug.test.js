import { createTestModel } from '../src/testing';

describe('slug', () => {
  it('should find a document by its slug', async () => {
    const Post = createTestModel({
      slug: 'String',
    });
    const post = await Post.create({
      slug: 'welcome-to-the-jungle',
    });

    const found = await Post.findByIdOrSlug('welcome-to-the-jungle');
    expect(post.id).toBe(found.id);
  });

  it('should find a document by its id', async () => {
    const Post = createTestModel({
      slug: 'String',
    });
    const post = await Post.create({
      slug: 'welcome-to-the-jungle',
    });

    const found = await Post.findByIdOrSlug(post.id);
    expect(post.id).toBe(found.id);
  });

  it('should find a deleted document by slug', async () => {
    const Post = createTestModel({
      slug: 'String',
    });
    await Post.create({
      slug: 'welcome-to-the-jungle',
      deleted: true,
    });

    expect(await Post.findByIdOrSlugDeleted('welcome-to-the-jungle')).not.toBe(
      null,
    );
  });

  it('should find a deleted document by id', async () => {
    const Post = createTestModel({
      slug: 'String',
    });
    const post = await Post.create({
      slug: 'welcome-to-the-jungle',
      deleted: true,
    });

    expect(await Post.findByIdOrSlugDeleted(post.id)).not.toBe(null);
  });

  it('should find all documents by slug', async () => {
    const Post = createTestModel({
      slug: 'String',
    });
    await Post.create({
      slug: 'welcome-to-the-jungle',
      deleted: true,
    });

    await Post.create({
      slug: 'welcome-to-the-bayou',
    });

    expect(
      await Post.findByIdOrSlugWithDeleted('welcome-to-the-jungle'),
    ).not.toBe(null);
    expect(
      await Post.findByIdOrSlugWithDeleted('welcome-to-the-bayou'),
    ).not.toBe(null);
  });

  it('should find by slug with projection', async () => {
    const Post = createTestModel({
      name: 'String',
      slug: 'String',
    });
    const post = await Post.create({
      name: 'GNR',
      slug: 'welcome-to-the-jungle',
    });

    const found = await Post.findByIdOrSlug('welcome-to-the-jungle', {
      name: true,
    });
    expect(found.toObject()).toEqual({
      id: post.id,
      name: 'GNR',
    });
  });

  it('should find by id with projection', async () => {
    const Post = createTestModel({
      name: 'String',
      slug: 'String',
    });
    const post = await Post.create({
      name: 'GNR',
      slug: 'welcome-to-the-jungle',
    });

    const found = await Post.findByIdOrSlug(post.id, {
      name: true,
    });
    expect(found.toObject()).toEqual({
      id: post.id,
      name: 'GNR',
    });
  });
});
