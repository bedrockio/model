## 0.13.0

- Removed support for passing schemas into `getCreateValidation` etc. now that
  other methods available on yada exist. Instead allow more flexibility in
  schema options.

## 0.12.3

- Support for `include` with top level dynamic references.

## 0.12.2

- Updated validators for string ranges.

## 0.12.1

- Allow range-based search on string fields.

## 0.12.0

- Handle aggregate pipelines in search.

## 0.11.3

- Added warning when id field not passed for unique check.

## 0.11.2

- Fixed issue with non-async hooks hanging.
- Further verson bumps.

## 0.11.1

- Changed default sort field in search to `_id`.
- Some verson bumps.

## 0.11.0

- Added clone module.

## 0.10.1

- Fix to not expose details on unique constraint errors.

## 0.10.0

- Unique constraints now run sequentially and will not run on nested validations
  unless their parent fields are passed.

## 0.9.1

- Allowed deriving individual paths from a create schema.

## 0.9.0

- Added keyword search decomposition.

## 0.8.4

- Fixed issues with external models colliding with cache module.

## 0.8.3

- Bumped yada version

## 0.8.2

- Trim strings by default.

## 0.8.0

- Moved "cache" field in "search" to definition root.
- Changed "lazy" on cached fields to instead use "sync".
- Removed "sync" field in "search". Syncing now happens automatically on synced
  cache fields.
- Removed "force" option from "syncCacheFields".
- Better handling of deep nested and array cache fields.
- Small fix for field messages on errors.

## 0.7.4

- NANP phone number validation support
- Better handling of empty string fields for unsetting fields

## 0.7.0

- Handling null fields in search queries.

## 0.6.0

- Added upsert module with `findOrCreate`.
- Added mechanism to sync cached fields when referenced document is saved.
- Renamed `syncSearchFields` to `syncCacheFields`.
- Simplified cache fields and search definition.

## 0.5.0

- Refactored include module to use ^ operator for exclusion.

## 0.4.0

- Added `hydrate` patch method.
