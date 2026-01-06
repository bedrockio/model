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
     * Soft deletes one document by setting deleted=true and deletedAt timestamp.
     *
     * @param {Object} filter - Query filter
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Object>}
     *
     * | | | |
     * |---|---|---|
     * | `acknowledged` | `boolean` | Whether the operation was acknowledged |
     * | `deletedCount` | `number` | Number of documents deleted |
     *
     * @example
     * ```js
     * const result = await User.deleteOne({
     *   email: 'user@example.com'
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    deleteOne(
      filter: any,
      options?: any,
    ): Promise<{ acknowledged: boolean; deletedCount: number }>;

    /**
     * Soft deletes multiple documents by setting deleted=true and deletedAt timestamp.
     *
     * @param {Object} filter - Query filter
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Object>}
     *
     * | | | |
     * |---|---|---|
     * | `acknowledged` | `boolean` | Whether the operation was acknowledged |
     * | `deletedCount` | `number` | Number of documents deleted |
     *
     * @example
     * ```js
     * const result = await User.deleteMany({
     *   inactive: true
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    deleteMany(
      filter: any,
      options?: any,
    ): Promise<{ acknowledged: boolean; deletedCount: number }>;

    /**
     * Finds and soft deletes one document, returning the deleted document.
     *
     * @param {Object} filter - Query filter
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Document|null>} - The deleted document or null
     *
     * @example
     * ```js
     * const user = await User.findOneAndDelete({
     *   email: 'user@example.com'
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    findOneAndDelete(filter: any, options?: any): Promise<any>;

    /**
     * Restores one soft-deleted document by setting deleted=false and unsetting deletedAt.
     *
     * @param {Object} filter - Query filter
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Object>}
     *
     * | | | |
     * |---|---|---|
     * | `acknowledged` | `boolean` | Whether the operation was acknowledged |
     * | `restoredCount` | `number` | Number of documents restored |
     *
     * @example
     * ```js
     * const result = await User.restoreOne({
     *   email: 'user@example.com'
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    restoreOne(
      filter: any,
      options?: any,
    ): Promise<{ acknowledged: boolean; restoredCount: number }>;

    /**
     * Restores multiple soft-deleted documents by setting deleted=false and unsetting deletedAt.
     *
     * @param {Object} filter - Query filter
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Object>}
     *
     * | | | |
     * |---|---|---|
     * | `acknowledged` | `boolean` | Whether the operation was acknowledged |
     * | `restoredCount` | `number` | Number of documents restored |
     *
     * @example
     * ```js
     * const result = await User.restoreMany({
     *   deletedAt: {
     *     $gte: oneWeekAgo
     *   }
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    restoreMany(
      filter: any,
      options?: any,
    ): Promise<{ acknowledged: boolean; restoredCount: number }>;

    /**
     * Permanently deletes one document from the database (hard delete).
     *
     * @param {Object} conditions - Query conditions
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Object>}
     *
     * | | | |
     * |---|---|---|
     * | `acknowledged` | `boolean` | Whether the operation was acknowledged |
     * | `destroyedCount` | `number` | Number of documents destroyed |
     *
     * @example
     * ```js
     * const result = await User.destroyOne({
     *   email: 'user@example.com'
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    destroyOne(
      conditions: any,
      options?: any,
    ): Promise<{ acknowledged: boolean; destroyedCount: number }>;

    /**
     * Permanently deletes multiple documents from the database (hard delete).
     *
     * @param {Object} conditions - Query conditions
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Object>}
     *
     * | | | |
     * |---|---|---|
     * | `acknowledged` | `boolean` | Whether the operation was acknowledged |
     * | `destroyedCount` | `number` | Number of documents destroyed |
     *
     * @example
     * ```js
     * const result = await User.destroyMany({
     *   deletedAt: {
     *     $lt: sixMonthsAgo
     *   }
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    destroyMany(
      conditions: any,
      options?: any,
    ): Promise<{ acknowledged: boolean; destroyedCount: number }>;

    /**
     * Finds documents that have been soft-deleted (deleted=true).
     *
     * @param {Object} filter - Query filter
     * @param {Object} [projection] - Fields to include/exclude
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Document[]>} - Array of deleted documents
     *
     * @example
     * ```js
     * const deletedUsers = await User.findDeleted({
     *   deletedAt: {
     *     $gte: lastMonth
     *   }
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    findDeleted(filter: any, projection?: any, options?: any): Promise<any[]>;

    /**
     * Finds one document that has been soft-deleted (deleted=true).
     *
     * @param {Object} filter - Query filter
     * @param {Object} [projection] - Fields to include/exclude
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Document|null>} - The deleted document or null
     *
     * @example
     * ```js
     * const user = await User.findOneDeleted({
     *   email: 'user@example.com'
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    findOneDeleted(filter: any, projection?: any, options?: any): Promise<any>;

    /**
     * Finds a soft-deleted document by its ID.
     *
     * @param {string} id - Document ID
     * @param {Object} [projection] - Fields to include/exclude
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Document|null>} - The deleted document or null
     *
     * @example
     * ```js
     * const user = await User.findByIdDeleted('507f1f77bcf86cd799439011');
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    findByIdDeleted(id: any, projection?: any, options?: any): Promise<any>;

    /**
     * Checks if a soft-deleted document exists matching the filter.
     *
     * @param {Object} filter - Query filter
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Object|null>} - Object with _id if exists, null otherwise
     *
     * @example
     * ```js
     * const exists = await User.existsDeleted({
     *   email: 'user@example.com'
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    existsDeleted(filter: any, options?: any): Promise<any>;

    /**
     * Counts soft-deleted documents matching the filter.
     *
     * @param {Object} filter - Query filter
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<number>} - Count of deleted documents
     *
     * @example
     * ```js
     * const count = await User.countDocumentsDeleted({
     *   deletedAt: {
     *     $gte: lastMonth
     *   }
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    countDocumentsDeleted(filter: any, options?: any): Promise<number>;

    /**
     * Finds documents including both deleted and non-deleted ones.
     *
     * @param {Object} filter - Query filter
     * @param {Object} [projection] - Fields to include/exclude
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Document[]>} - Array of documents
     *
     * @example
     * ```js
     * const allUsers = await User.findWithDeleted({
     *   email: {
     *     $regex: '@example.com$'
     *   }
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    findWithDeleted(
      filter: any,
      projection?: any,
      options?: any,
    ): Promise<any[]>;

    /**
     * Finds one document including both deleted and non-deleted ones.
     *
     * @param {Object} filter - Query filter
     * @param {Object} [projection] - Fields to include/exclude
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Document|null>} - The document or null
     *
     * @example
     * ```js
     * const user = await User.findOneWithDeleted({
     *   email: 'user@example.com'
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    findOneWithDeleted(
      filter: any,
      projection?: any,
      options?: any,
    ): Promise<any>;

    /**
     * Finds a document by ID including both deleted and non-deleted ones.
     *
     * @param {string} id - Document ID
     * @param {Object} [projection] - Fields to include/exclude
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Document|null>} - The document or null
     *
     * @example
     * ```js
     * const user = await User.findByIdWithDeleted('507f1f77bcf86cd799439011');
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    findByIdWithDeleted(id: any, projection?: any, options?: any): Promise<any>;

    /**
     * Checks if a document exists (deleted or not) matching the filter.
     *
     * @param {Object} filter - Query filter
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<Object|null>} - Object with _id if exists, null otherwise
     *
     * @example
     * ```js
     * const exists = await User.existsWithDeleted({
     *   email: 'user@example.com'
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    existsWithDeleted(filter: any, options?: any): Promise<any>;

    /**
     * Counts documents (deleted or not) matching the filter.
     *
     * @param {Object} filter - Query filter
     * @param {Object} [options] - MongoDB options
     *
     * @returns {Promise<number>} - Count of documents
     *
     * @example
     * ```js
     * const count = await User.countDocumentsWithDeleted({
     *   email: {
     *     $regex: '@example.com$'
     *   }
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    countDocumentsWithDeleted(filter: any, options?: any): Promise<number>;
  }

  interface Document {
    /**
     * Soft deletes this document by setting deleted=true and deletedAt timestamp, then saves without validation.
     *
     * @returns {Promise<Document>} - The saved document
     *
     * @example
     * ```js
     * await user.delete();
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    delete(): Promise<this>;

    /**
     * Restores this soft-deleted document by setting deleted=false and unsetting deletedAt, then saves with validation.
     *
     * @returns {Promise<Document>} - The saved document
     *
     * @example
     * ```js
     * await user.restore();
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    restore(): Promise<this>;

    /**
     * Permanently deletes this document from the database (hard delete).
     *
     * @param {...any} args - Additional arguments passed to destroyOne
     *
     * @returns {Promise<Object>} - Result object with acknowledged and destroyedCount
     *
     * @example
     * ```js
     * await user.destroy();
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#soft-delete}
     */
    destroy(
      ...args: any[]
    ): Promise<{ acknowledged: boolean; destroyedCount: number }>;
  }
}
