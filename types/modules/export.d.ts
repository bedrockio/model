declare module 'mongoose' {
  interface Document {
    /**
     * Exports all defined schema paths from this document into a plain object, excluding undefined values.
     *
     * @returns {Object} - Plain object with document data
     *
     * @example
     * ```js
     * const data = user.export();
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#export}
     */
    export(): any;
  }
}
