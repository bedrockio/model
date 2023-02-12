# Changelog

### Initial Migration

When coming from a previous version of Bedrock:

```bash
rm src/utils/schema.js
rm src/utils/search.js
rm src/utils/validation.js
rm src/utils/__tests__/schema.test.js
rm src/utils/__tests__/validation.test.js
rm -r src/utils/__fixtures__
yarn add @bedrockio/model
```

In the model definitions:

- Move `search` fields into a nested `fields`.
- Rename `readScopes` to `readAccess`.
- Rename `writeScopes` to `writeAccess`.

```json
{
  "profile" {
    "type": "String",
    "readScopes": "none",
    "writeScopes": "none",
  },
  "search": ["firstName", "lastName"]
}
```

should be migrated to:

```json
{
  "profile" {
    "type": "String",
    "readAccess": "none",
    "writeAccess": "none",
  },
  "search": {
    "fields": ["firstName", "lastName"]
  }
}
```
