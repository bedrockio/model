# @bedrockio/model

Bedrock utilities for model creation.

- [Install](#install)
- [Dependencies](#dependencies)
- [Usage](#usage)
- [Features](#features)
  - [Soft Delete](#soft-delete)
  - [Validation](#validation)
  - [Search](#search)
  - [Includes](#includes)
  - [Access Control](#access-control)
  - [References](#references)
  - [Assign](#assign)
  - [Slugs](#slugs)
- [Testing](#testing)

## Install

```bash
yarn install @bedrockio/model
```

## Dependencies

Peer dependencies must be installed to use this package:

```bash
yarn install mongoose
yarn install @bedrockio/yada
```

## Usage

Bedrock models are defined as flat JSON files to allow static analysis and inspection. They can be further extended to allow more functionality. The most straightforward way to load models is to use `loadModelDir` that points to the directory where JSON definitions exist:

```js
const { loadModelDir } = require('@bedrockio/model');
model.exports = loadModelDir('path/to/definitions/');
```

Models that need to be extended can use the `createSchema` method with the definition and add to the schema as needed:

```js
const mongoose = require('mongoose');
const definition = require('./definitions/user.json');

const schema = createSchema(definition);

schema.virtual('name').get(function () {
  return [this.firstName, this.lastName].join(' ');
});

module.exports = mongoose.model('User', schema);
```

They can then be loaded individually alongside other models:

```js
const { loadModelDir } = require('@bedrockio/model');
model.exports = {
  User: require('./user'),
  ...loadModelDir('./definitions');
}
```

## Features

### Soft Delete

The soft delete module ensures that no documents are permanently deleted by default and provides helpful methods to query on and restore deleted documents. "Soft deletion" means that deleted documents have the properties `deleted` and `deletedAt`.

#### Instance Methods

- `delete` - Soft deletes the document.
- `restore` - Restores a soft deleted document.
- `destroy` - Deletes the document permanently.

#### Static Methods

- `deleteOne` - Soft deletes a single document.
- `deleteMany` - Soft deletes multiple documents.
- `restoreOne` - Restores a single document.
- `restoreMany` - Restores multiple documents.
- `destroyOne` - Permanently deletes a single document.
- `destroyMany` - Permanently deletes multiple documents. Be careful with this one.

#### Query Deleted Documents

- `findDeleted`
- `findOneDeleted`
- `findByIdDeleted`
- `existsDeleted`
- `countDocumentsDeleted`

#### Query All Documents

- `findWithDeleted`
- `findOneWithDeleted`
- `findByIdWithDeleted`
- `existsWithDeleted`
- `countDocumentsWithDeleted`

#### Other Static Methods

- `findOneAndDelete` - The soft equivalent of the [Mongoose method](https://mongoosejs.com/docs/api/model.html#model_Model-findOneAndDelete). Fetches the current data before deleting and returns the document.
- `findByIdAndDelete` - The soft equivalent of the [Mongoose method](https://mongoosejs.com/docs/api/model.html#model_Model-findByIdAndDelete). Fetches the current data before deleting and returns the document.

#### Disallowed Methods

Due to ambiguity with the soft delete module, the following methods will throw an error:

- `Document.remove` - Use `Document.delete` or `Document.destroy` instead.
- `Document.deleteOne` - Use `Document.delete` or `Model.deleteOne` instead.

- `Model.findOneAndRemove` - Use `Model.findOneAndDelete` instead.
- `Model.findByIdAndRemove` - Use `Model.findByIdAndDelete` instead.

### Validation

Models are extended with methods that allow complex validation that derives from the schema. Bedrock validation is generally used at the API level:

```js
const Router = require('@koa/router');
const router = new Router();

router.post(
  '/',
  validateBody(
    User.getCreateValidation({
      password: yd.string().password().required(),
    })
  ),
  async (ctx) => {
    // ....
  }
);
```

In the above example `getCreateValidation` returns a [yada](https://github.com/bedrockio/yada) schema that is validated in the `validateBody` middleware. The `password` field is an additional field that is appended to the create schema.

There are 3 main methods to generate schemas:

- `getCreateValidation`: Validates all fields while disallowing reserved fields like `id`, `createdAt`, and `updatedAt`.
- `getUpdateValidation`: Validates all fields as optional (ie. they will not be validated if they don't exist on the object). Additionally will strip out reserved fields to allow created objects to be passed in. Unknown fields will also be stripped out rather than error to allow virtuals to be passed in.
- `getSearchValidation`: Validates fields for use with [search](#search). The generated validation has a number of properties:
  - In addition to the base field schemas, arrays or ranges are also allowed. See [search](#search) for more.
  - The special fields `limit`, `sort`, `keyword`, `include`, and `ids` are also allowed.
  - Array fields are "unwound". This means that for example given an array field `categories`, input may be either a string or an array of strings.

#### Fixed Validations

Fixed validations can be specified on the model:

```json
{
  "email": {
    "type": "String",
    "validate": "email"
  }
}
```

Validator functions are derived from [yada](https://github.com/bedrockio/yada#methods). Note that:

- `email` - Will additionally downcase any input.
- `password` - Is not supported as it requires options to be passed and is not a field stored directly in the database.
- `mongo` - Is instead represented in the models as `ObjectId` to have parity with `type`.
- `min` - Defined instead directly on the field with `minLength` for strings and `min` for numbers.
- `max` - Defined instead directly on the field with `maxLength` for strings and `max` for numbers.

### Search

Models are extended with a `search` method that allows for complex searching:

```js
const { data, meta } = await User.search();
```

The method takes the following options:

- `limit` - Limit for the query. Will be output in `meta`.
- `sort` - The sort for the query as an object containing a `field` and an `order` of `"asc"` or `"desc"`. May also be an array.
- `include` - Allows [include](#includes) based population.
- `keyword` - A keyword to perform a [keyword search](#keyword-search).
- `ids` - An array of document ids to search on.
- `fields` - Used by [keyword search](#keyword-search).

Any other fields passed in will be forwarded to `find`. The return value contains the found documents in `data` and `meta` which contains metadata about the search:

- `total` The total document count for the query.
- `limit` The limit for the query.
- `skip` The number skipped.

#### Advanced Searching

Input to `search` will execute the optimal mongo query and supports several advanced features:

- Array fields will be executed using `$in`.
- Javascript regular expressions will map to `$regex` which allows for [more advanced PCRE compatible features](https://docs.mongodb.com/manual/reference/operator/query/regex/#pcre-vs-javascript).
- Nested objects will be automatically flattened to query subdocuments:

```
{
  profile: {
    age: 20
  }
}
```

will be flattened to:

```
{
  'profile.age': 20
}
```

#### Range Based Search

Additionally, date and number fields allow range queries in the form:

```
age: {
  gt: 1
  lt: 2
}
```

A range query can use `lt`, `gt`, or both. Additionally `lte` and `gte` will query on less/greater than or equal values.

#### Keyword Search

Passing `keyword` to the search method will perform a keyword search. To use this feature a `fields` key must be present on the model definition:

```json
{
  "attributes": {
    "name": {
      "type": "String"
    }
    "email": {
      "type": "String"
    }
  },
  "search": {
    "fields": [
      "name",
      "email",
    ]
  }
}
```

This will use the `$or` operator to search on multiple fields. If `fields` is not defined then a Mongo text query will be attempted:

```
{
  $text: {
    $search: keyword
  }
}
```

Note that this will fail unless a text index is defined on the model.

#### Search Validation

The [validation](#validation) generated for search using `getSearchValidation` is inherently looser and allows more fields to be passed to allow complex searches compatible with the above.

### Includes

Populating foreign documents with [populate](https://mongoosejs.com/docs/populate.html) is a powerful feature of mongoose. In the past Bedrock has made use of the [autopopulate](https://plugins.mongoosejs.io/plugins/autopopulate) plugin, however has since moved away from this for two reasons:

1. Document population is highly situational. In complex real world applications a document may require deep population or none at all, however autopopulate does not allow this level of control.
2. Although circular references usually are the result of bad data modeling, in some cases they cannot be avoided. Autopopulate will keep loading these references until it reaches a maximum depth, even when the fetched data is redundant.

Both of these issues have major performance implications which result in slower queries and more unneeded data transfer over the wire.

For this reason calling `populate` manually is highly preferable, however in complex situations this can easily be a lot of overhead. The include module attempts to greatly streamline this process by adding an `include` method to queries:

```js
const product = await Product.findById(id).include([
  'name',
  'shop.email',
  'shop.user.name',
  'shop.user.address.line1',
  'shop.customers.tags',
]);
```

This method accepts a string or array of strings that will map to a `populate` call that can be far more complex:

```js
const product = await Product.findById(id).populate([
  {
    select: ['name'],
    populate: [
      {
        path: 'shop',
        select: ['email'],
        populate: [
          {
            path: 'user',
            select: ['name', 'address.line1'],
            populate: [],
          },
          {
            path: 'customers',
            select: ['tags'],
          },
        ],
      },
    ],
  },
]);
```

In addition to brevity, one major advantage of using `include` is that the caller does not need to know whether the documents are subdocuments or foreign references. As Bedrock has knowledge of the schemas, it is able to build the appropriate call to `populate` for you.

#### Excluding Fields

Fields can be excluded rather than included using `-`:

```js
const user = await User.findById(id).include('-profile');
```

The above will return all fields except `profile`. Note that:

- Excluding fields only affects the `select` option. Foreign fields must still be passed, otherwise they will be returned unpopulated.
- An excluded field on a foreign reference will implicitly be populated. This means that passing `-profile.name` where `profile` is a foreign field will populate `profile` but exclude `name`.

#### Wildcards

Multiple fields can be selected using wildcards:

- `*` - Matches anything except `.`.
- `**` - Matches anything including `.`.

```js
// Assuming a schema of:
// {
//   "firstName": "String"
//   "lastName": "String"
// }
const user = await User.findById(id).include('*Name');
```

The example above will select both `firstName` and `lastName`.

```js
// Assuming a schema of:
// {
//   "profile1": {
//     "address": {
//       "phone": "String"
//     }
//   },
//   "profile2": {
//     "address": {
//       "phone": "String"
//     }
//   }
// }
const user = await User.findById(id).include('**.phone');
```

This example above will select both `profile1.address.phone` and `profile2.address.phone`. Compare this to `*` which will not match here.

Note that wildcards will only select local fields. Populated fields on foreign documents must always be explicitly passed, otherwise they will be returned unpopulated.

#### Searching with includes

Note that [search](#search), which returns a query, can also use `include`:

```js
const user = await User.search({
  firstName: 'Frank',
}).include('profile');
```

#### Include as a Filter

Additionally `include` is flagged as a special parameter for filters, allowing the following equivalent syntax on `search` as well as all `find` methods:

```js
const user = await User.find({
  firstName: 'Frank',
  include: 'profile',
});
```

#### Validation with includes

The [validation](#validation) methods additionally allow `include` as a special field on generated schemas. This allows the client to drive document inclusion on a case by case basis. For example, given a typical Bedrock setup:

```js
const Router = require('@koa/router');
const router = new Router();

router.post('/', validateBody(User.getSearchValidation()), async (ctx) => {
  const { data, meta } = await User.search(ctx.request.body);
  ctx.body = {
    data,
  };
});
```

The `getSearchValidation` will allow the `include` property to be passed, letting the client populate documents as they require. Note that the fields a client is able to include is subject to [access control](#access-control).

### Access Control

TODO

### References

TODO

### Assign

TODO

### Slugs

TODO

## Testing

A helper `createTestModel` is exported to allow quickly building models for testing:

```js
const { createTestModel } = require('@bedrockio/model');

const User = createTestModel({
  name: 'String',
});
```

Note that a unique model name will be generated to prevent clashing with other models. This can be accessed with `Model.modelName` or to make tests more readable it can be overridden:

```js
const { createTestModel } = require('@bedrockio/model');

const Post = createTestModel(
  {
    name: 'String',
  },
  'Post'
);
```

Make sure in this case that the model name is unique.
