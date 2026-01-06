import type { HydratedDocument } from 'mongoose';

declare module 'mongoose' {
  interface Model<
    TRawDocType,
    TQueryHelpers = {},
    TInstanceMethods = {},
    TVirtuals = {},
    THydratedDocumentType = HydratedDocument<
      TRawDocType,
      TVirtuals & TInstanceMethods,
      TQueryHelpers,
      TVirtuals
    >,
    TSchema = any,
  > {
    /**
     * Finds a document by either its ObjectId or slug field. Automatically detects if the string is a valid 24-character ObjectId.
     *
     * @param {string} str - Either an ObjectId or a slug
     * @param {Object} [projection] - Fields to include/exclude
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Document|null>} - The document or null
     *
     * @example
     * ```js
     * const user = await User.findByIdOrSlug('john-doe');
     * const sameUser = await User.findByIdOrSlug('507f1f77bcf86cd799439011');
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#slugs}
     */
    findByIdOrSlug(str: string, projection?: any, options?: any): Promise<any>;

    /**
     * Finds a soft-deleted document by either its ObjectId or slug field.
     *
     * @param {string} str - Either an ObjectId or a slug
     * @param {Object} [projection] - Fields to include/exclude
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Document|null>} - The deleted document or null
     *
     * @example
     * ```js
     * const user = await User.findByIdOrSlugDeleted('john-doe');
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#slugs}
     */
    findByIdOrSlugDeleted(
      str: string,
      projection?: any,
      options?: any,
    ): Promise<any>;

    /**
     * Finds a document (deleted or not) by either its ObjectId or slug field.
     *
     * @param {string} str - Either an ObjectId or a slug
     * @param {Object} [projection] - Fields to include/exclude
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Document|null>} - The document or null
     *
     * @example
     * ```js
     * const user = await User.findByIdOrSlugWithDeleted('john-doe');
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#slugs}
     */
    findByIdOrSlugWithDeleted(
      str: string,
      projection?: any,
      options?: any,
    ): Promise<any>;
  }
}
