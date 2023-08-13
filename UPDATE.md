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
yarn add @bedrockio/yada
yarn add @bedrockio/logger
yarn add @bedrockio/model
```

Replace all references to `src/utils/schema.js` and `src/utils/validation.js` to
`@bedrockio/model`.

In the model definitions:

- Move `search` fields into a nested `fields`.
- Rename `readScopes` to `readAccess`.
- Rename `writeScopes` to `writeAccess`.
- Remove `skipValidation`.
- Change `Mixed` type to `Object`.

```js
{
  "profile" {
    "type": "String",
    "readScopes": "none",
    "writeScopes": "none",
    "skipValidation": true,
  },
  "object": {
    "type": "Mixed"
  },
  "search": ["firstName", "lastName"]
}
```

should be migrated to:

```js
{
  "profile" {
    "type": "String",
    "readAccess": "none",
    "writeAccess": "none",
  },
  "object": {
    "type": "Object"
  },
  "search": {
    "fields": ["firstName", "lastName"]
  }
}
```
