declare module 'mongoose' {
  interface Document {
    /**
     * Assigns fields to this document, converting falsy values (null, empty string) to undefined to ensure they are unset.
     *
     * @param {Object} fields - Object of fields to assign to the document
     *
     * @returns {void}
     *
     * @example
     * ```js
     * user.assign({
     *   name: 'Jane Doe',
     *   email: null
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#assign}
     */
    assign(fields: any): void;
  }
}
