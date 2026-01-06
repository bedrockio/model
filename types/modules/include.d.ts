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
     * Creates a document and then populates related fields specified in the include parameter.
     *
     * @param {Object} attributes - Document attributes including optional include property
     *
     * | | | |
     * |---|---|---|
     * | `include` | `string\|string[]\|Set` | Fields to populate after creation |
     *
     * @returns {Promise<Document>} - The created and populated document
     *
     * @example
     * ```js
     * const user = await User.createWithInclude({
     *   name: 'John Doe',
     *   email: 'john@example.com',
     *   organizationId: '507f1f77bcf86cd799439011',
     *   include: ['organization']
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#includes}
     */
    createWithInclude(attributes: any): Promise<any>;
  }

  interface Document {
    /**
     * Populates related fields on this document and stores select parameters for serialization.
     *
     * @param {string|string[]|Set} include - Fields to populate
     * @param {Object} [options] - Options
     *
     * | | | |
     * |---|---|---|
     * | `force` | `boolean` | Force re-population of already populated fields |
     *
     * @returns {Promise<void>}
     *
     * @example
     * ```js
     * await user.include(['organization', 'createdBy']);
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#includes}
     */
    include(
      include: string | string[] | Set<string>,
      options?: any,
    ): Promise<void>;

    /**
     * Assigns attributes to this document and stores include parameters in $locals for later population.
     *
     * @param {Object} attributes - Document attributes including optional include property
     *
     * | | | |
     * |---|---|---|
     * | `include` | `string\|string[]\|Set` | Fields to populate after save |
     *
     * @returns {void}
     *
     * @example
     * ```js
     * user.assignWithInclude({
     *   name: 'Jane Doe',
     *   include: ['organization']
     * });
     * await user.save();
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#includes}
     */
    assignWithInclude(attributes: any): void;
  }
}
