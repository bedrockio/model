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
     * Creates a Mongoose document from a plain object, but only includes fields defined in the schema. Prevents leaking extra data from aggregations.
     *
     * @param {Object} obj - Plain object to hydrate into a model instance
     *
     * @returns {Document} - Hydrated Mongoose document
     *
     * @example
     * ```js
     * const user = User.hydrate({
     *   _id: '507f1f77bcf86cd799439011',
     *   name: 'John Doe',
     *   email: 'john@example.com'
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#hydrate}
     */
    hydrate(obj: any): any;
  }
}
