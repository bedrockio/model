declare module 'mongoose' {
  interface Document {
    /**
     * Creates a new instance of this document with the same field values, generating new values for unique fields by appending a counter.
     *
     * @returns {Document} - A new document instance
     *
     * @example
     * ```js
     * const clone = user.clone();
     * await clone.save();
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#clone}
     */
    clone(): this;
  }
}
