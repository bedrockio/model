## 0.22.0

- Removed regex parsing in search.

## 0.21.3

- Fixed issue with middleware hook patch.
- Output model name in UniqueConstraintError.

## 0.21.2

- Export `loadDefinition` and readme updates.

## 0.21.1

- Fixed issues with schema loading.

## 0.21.0

- Allow comments in schemas with .jsonc.

## 0.20.2

- Fixed `_id: false` on validation schemas.

## 0.20.1

- Fixed `_id: false` on array fields.

## 0.20.0

- Added types and documentation to all augmented methods.

## 0.19.3

- Fixed issue with unknown sort fields throwing in aggregations.

## 0.19.2

- Fixed issue with delete hooks in subdocument arrays.

## 0.19.1

- Fix for deep cache field not saving.
- Test for multiple decomposers.

## 0.19.0

- Ensure that document clone is synchronous.

## 0.18.6

- Yada bump.

## 0.18.5

- Moved warnings to `process.emitWarning`.
- Fixed reload issue with mixed array types.

## 0.18.4

- Bumped yada to fix JSON schema issues.
- Fixed `deletedRefs` being exposed.

## 0.18.3

- Fixed issues with `getUpdateValidation` not allowing null for nested objects.

## 0.18.2

- Further fix for `reload` not working with delete hooks.
- Better detection of literal `type` fields.
- Schema refactor.

## 0.18.1

- Added `export` for dumping documents and to support reload.
- Fix for `include` not working on nested virtuals.
- Fixes for `reload`.

## 0.18.0

- Added `reload`.

## 0.17.0

- Added `time` validation.

## 0.16.0

- Added `upsert` method.

## 0.15.0

- Tagged outer includes schema.
- `allowInclude` -> `allowIncludes`.
- Inclues not allowed on `getUpdateValidation` by default (revert of `0.14.1`).

## 0.14.4

- Fixed bug with nested includes in update validation.

## 0.14.3

- Allow keyword search on number fields.

## 0.14.2

- Loosened peer deps.

## 0.14.1

- Ensure includes are allowed on `getUpdateValidattion`.

## 0.14.0

- More clearly defined assign behavior on nested fields.
- Flat syntax will be equivalent to PATCH behavior.
- Nested syntax will be equivalent to PUT behavior.
- Both types are consistent across objects and arrays.
- Version bumps.

## 0.13.3

- Bumped yada version.
- Fix for empty string not unsetting nested enum string fields.

## 0.13.2

- Bumped yada version.
- Removed `expandDotSyntax` as default.
- Added `calendar` named validation.
- Updated OpenApi tests to match stricter JSON schema.

## 0.13.1

- Do not enforce unique constraints in search validation.

## 0.13.0

- Removed support for passing schemas into `getCreateValidation` etc. now that
  other methods available on yada exist. Instead allow more flexibility in
  schema options.
- Allow appending export schema as an option.

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
