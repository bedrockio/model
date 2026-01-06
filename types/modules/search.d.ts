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
     * Performs a search query with pagination and filtering.
     *
     * @param {Object} options
     *
     * | | | |
     * |---|---|---|
     * | `ids` | `string[]` | Array of IDs to filter by |
     * | `keyword` | `string` | Keyword for text search across specified fields |
     * | `skip` | `number` | Number of records to skip (for pagination) |
     * | `limit` | `number` | Maximum number of records to return |
     * | `sort` | `Object\|Object[]` | Sort order specification |
     * | `sort.field` | `string` | Field name to sort by |
     * | `sort.order` | `'asc'\|'desc'` | Sort direction |
     *
     * @returns {Promise}
     *
     * | | | |
     * |---|---|---|
     * | `data` | `Array` | Array of matching documents |
     * | `meta` | `Object` | Metadata about the search results |
     * | `meta.total` | `number` | Total number of matching documents |
     * | `meta.skip` | `number` | Number of records skipped |
     * | `meta.limit` | `number` | Maximum number of records returned |
     *
     * @example
     * ```js
     * // Basic search
     * const results = await User.search({
     *   keyword: 'john',
     *   limit: 10,
     *   skip: 0,
     *   sort: {
     *     field: 'createdAt',
     *     order: 'desc'
     *   }
     * });
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#search}
     */
    search(options: SearchOptions): Promise<SearchResult>;
    /**
     * Performs a search using an aggregation pipeline.
     *
     * @param {Array} pipeline - MongoDB aggregation pipeline stages
     * @param {Object} [options]
     *
     * | | | |
     * |---|---|---|
     * | `skip` | `number` | Number of records to skip (for pagination) |
     * | `limit` | `number` | Maximum number of records to return |
     * | `sort` | `Object\|Object[]` | Sort order specification |
     * | `sort.field` | `string` | Field name to sort by |
     * | `sort.order` | `'asc'\|'desc'` | Sort direction |
     *
     * @returns {Promise}
     *
     * | | | |
     * |---|---|---|
     * | `data` | `Array` | Array of matching documents |
     * | `meta` | `Object` | Metadata about the search results |
     * | `meta.total` | `number` | Total number of matching documents |
     * | `meta.skip` | `number` | Number of records skipped |
     * | `meta.limit` | `number` | Maximum number of records returned |
     *
     * @example
     * ```js
     * // Pipeline search
     * const results = await User.search(
     *   [
     *     {
     *       $match: {
     *         active: true
     *       }
     *     }
     *   ],
     *   {
     *     limit: 20
     *   }
     * );
     * ```
     *
     * @see {@link https://github.com/bedrockio/model#search}
     */
    search(
      pipeline: any[],
      options?: SearchPipelineOptions,
    ): Promise<SearchResult>;
  }
}

type SortOption = {
  field: string;
  order: 'asc' | 'desc';
};

type SearchOptions = {
  ids?: string[];
  keyword?: string;
  skip?: number;
  limit?: number;
  sort?: SortOption | SortOption[];
};

type SearchPipelineOptions = {
  skip?: number;
  limit?: number;
  sort?: SortOption | SortOption[];
};

type SearchResultMeta = {
  total: number;
  skip: number;
  limit: number;
};

type SearchResult = {
  data: any[];
  meta: SearchResultMeta;
};
