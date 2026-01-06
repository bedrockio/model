declare module 'mongoose' {
  interface Document {
    /**
     * Reloads this document from the database, preserving populated paths and virtual references.
     *
     * @returns {Promise<void>}
     *
     * @example
     * ```js
     * await user.reload();
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#reload}
     */
    reload(): Promise<void>;
  }
}
