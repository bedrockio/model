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
     * Returns a validation schema for creating new documents.
     *
     * @param {Object} [options] - Configuration options
     *
     * | | | |
     * |---|---|---|
     * | `stripEmpty` | `boolean` | Strip empty values (default: true) |
     * | `applyUnique` | `boolean` | Apply unique field validation (default: true) |
     * | `stripDeleted` | `boolean` | Strip deleted fields from schema (default: true) |
     * | `allowIncludes` | `boolean` | Allow include parameter (default: false) |
     * | `stripTimestamps` | `boolean` | Strip createdAt/updatedAt fields (default: true) |
     * | `allowDefaultTags` | `boolean` | Tag default values for OpenAPI (default: true) |
     * | `allowExpandedRefs` | `boolean` | Allow expanded object references (default: true) |
     * | `requireWriteAccess` | `boolean` | Require write access validation (default: true) |
     *
     * @returns {Object} - Yada validation schema
     *
     * @example
     * ```js
     * const schema = User.getCreateValidation();
     * const validated = await schema.validate(data);
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#validation}
     */
    getCreateValidation(options?: any): any;

    /**
     * Returns a validation schema for updating existing documents.
     *
     * @param {Object} [options] - Configuration options
     *
     * | | | |
     * |---|---|---|
     * | `allowNull` | `boolean` | Allow null values to unset fields (default: true) |
     * | `applyUnique` | `boolean` | Apply unique field validation (default: true) |
     * | `skipRequired` | `boolean` | Skip required field checks (default: true) |
     * | `stripUnknown` | `boolean` | Strip unknown fields (default: true) |
     * | `stripDeleted` | `boolean` | Strip deleted fields from schema (default: true) |
     * | `allowFlatKeys` | `boolean` | Allow dot notation for updates (default: true) |
     * | `allowIncludes` | `boolean` | Allow include parameter (default: false) |
     * | `stripTimestamps` | `boolean` | Strip createdAt/updatedAt fields (default: true) |
     * | `allowExpandedRefs` | `boolean` | Allow expanded object references (default: true) |
     * | `requireWriteAccess` | `boolean` | Require write access validation (default: true) |
     *
     * @returns {Object} - Yada validation schema
     *
     * @example
     * ```js
     * const schema = User.getUpdateValidation();
     * const validated = await schema.validate(updates);
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#validation}
     */
    getUpdateValidation(options?: any): any;

    /**
     * Returns a validation schema for search queries.
     *
     * @param {Object} [options] - Configuration options
     *
     * | | | |
     * |---|---|---|
     * | `allowExport` | `boolean` | Include export validation (filename, format) |
     * | `defaults` | `Object` | Default values for search parameters |
     * | `formats` | `Object` | Custom export formats configuration |
     *
     * @returns {Object} - Yada validation schema
     *
     * @example
     * ```js
     * const schema = User.getSearchValidation({
     *   allowExport: true
     * });
     * const validated = await schema.validate(query);
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#validation}
     */
    getSearchValidation(options?: any): any;

    /**
     * Returns a validation schema for delete operations.
     *
     * @returns {Object} - Yada validation schema
     *
     * @example
     * ```js
     * const schema = User.getDeleteValidation();
     * await schema.validate({ authUser, document });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#validation}
     */
    getDeleteValidation(): any;

    /**
     * Returns the validation schema for include fields.
     *
     * @returns {Object} - Yada validation schema for include parameter
     *
     * @example
     * ```js
     * const schema = User.getIncludeValidation();
     * const validated = await schema.validate(['organization', 'createdBy']);
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#validation}
     */
    getIncludeValidation(): any;

    /**
     * Returns a base validation schema with deleted fields stripped and read access required.
     *
     * @returns {Object} - Yada validation schema
     *
     * @example
     * ```js
     * const schema = User.getBaseSchema();
     * const validated = await schema.validate(data);
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#validation}
     */
    getBaseSchema(): any;
  }
}
