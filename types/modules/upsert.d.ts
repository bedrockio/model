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
     * Updates an existing document or creates a new one if not found. Runs document hooks.
     *
     * @param {Object} query - Query to find existing document
     * @param {Object} [fields] - Fields to update/create (defaults to query if not provided)
     *
     * @returns {Promise<Document>} - The created or updated document
     *
     * @example
     * ```js
     * const user = await User.upsert(
     *   {
     *     email: 'user@example.com'
     *   },
     *   {
     *     email: 'user@example.com',
     *     name: 'John Doe'
     *   }
     * );
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#upsert}
     */
    upsert(query: any, fields?: any): Promise<any>;

    /**
     * Finds an existing document or creates a new one if not found. Does not update existing documents.
     *
     * @param {Object} query - Query to find existing document
     * @param {Object} [fields] - Fields to create if not found (defaults to query if not provided)
     *
     * @returns {Promise<Document>} - The found or created document
     *
     * @example
     * ```js
     * const user = await User.findOrCreate(
     *   {
     *     email: 'user@example.com'
     *   },
     *   {
     *     email: 'user@example.com',
     *     name: 'John Doe'
     *   }
     * );
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#upsert}
     */
    findOrCreate(query: any, fields?: any): Promise<any>;
  }
}
