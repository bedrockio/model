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
