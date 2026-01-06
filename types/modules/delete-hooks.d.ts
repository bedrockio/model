declare module 'mongoose' {
  interface Document {
    /**
     * Enhanced version of delete() that validates foreign references and deletes related documents based on clean hooks.
     * Handles rollback if deletion fails. Only available when delete hooks are configured on the model.
     *
     * @returns {Promise<Document>} - The saved document
     *
     * @example
     * ```js
     * await user.delete();
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#delete-hooks}
     */
    delete(): Promise<this>;

    /**
     * Enhanced version of restore() that also restores related documents that were deleted via clean hooks.
     * Only available when delete hooks are configured on the model.
     *
     * @returns {Promise<Document>} - The saved document
     *
     * @example
     * ```js
     * await user.restore();
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#delete-hooks}
     */
    restore(): Promise<this>;
  }
}
