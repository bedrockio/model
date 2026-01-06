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
     * Synchronizes cached fields across documents. Finds documents with null cached fields and updates them with values from related documents.
     *
     * @returns {Promise<Object>} - Bulk write result
     *
     * @example
     * ```js
     * const result = await User.syncCacheFields();
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#cache}
     */
    syncCacheFields(): Promise<any>;
  }
}
