# @bedrockio/model

Bedrock utilities for model creation.

- [Install](#install)
- [Dependencies](#dependencies)
- [Usage](#usage)
- [Schemas](#schemas)
- [Schema Extensions](#schema-extensions)
  - [Attributes](#attributes)
  - [Scopes](#scopes)
  - [Unique Constraints](#unique-constraints)
  - [Array Extensions](#array-extensions)
  - [String Trimming](#string-trimming)
  - [Tuples](#tuples)
- [Modules](#modules)
  - [Soft Delete](#soft-delete)
  - [Validation](#validation)
  - [Search](#search)
  - [Cache](#cache)
  - [Includes](#includes)
  - [Delete Hooks](#delete-hooks)
  - [Access Control](#access-control)
  - [Assign](#assign)
  - [Upsert](#upsert)
  - [Reload](#reload)
  - [Clone](#clone)
  - [Slugs](#slugs)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Install

```bash
yarn install @bedrockio/model
```

## Dependencies

Peer dependencies must be installed:

```bash
yarn install mongoose
yarn install @bedrockio/yada
```

## Usage

Bedrock models are defined as flat JSON files to allow static analysis and
inspection. They can be further extended to allow more functionality. The most
straightforward way to load models is to use `loadModelDir` that points to the
directory where JSON definitions exist:

```js
const { loadModelDir } = require('@bedrockio/model');
model.exports = loadModelDir('path/to/definitions/');
```

Models that need to be extended can use the `createSchema` method with the
definition and add to the schema as needed:

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

## Schemas

The `attributes` field of model definitions can be considered equivalent to
Mongoose, but defined in JSON with extended features:

```js
{
  "attributes": {
    // Shortcut for the syntax below.
    "name1": "String",
    // Defines further parameters on the type.
    "name2": {
      "type": "String",
      "trim": true,
    },
    "email": {
      "type": "String",
      // Validation shortcuts
      "validate": "email",
      // Access control
      "readAccess": ["admin"],
      "writeAccess": ["admin"],
    },
    "tags": [
      {
        "type": "String"
      }
    ],
    // Arrays of mixed type
    "mixed": [
      {
        "type": "Mixed"
      }
    ],
    // Extended tuple syntax
    "location": ["Number", "Number"]
  }
}
```

Links:

- [Validation](#validation)
- [Access Control](#access-control)

### Schema Extensions

This module provides a number of extensions to assist schema creation outside
the scope of Mongoose.

#### Attributes

Objects are easily defined with their attributes directly on the field:

```js
{
  "profile": {
    "firstName": "String",
    "lastName": "String",
  }
};
```

However it is common to need to add an option like `required` to an object
schema. In Mongoose this is technically written as:

```js
{
  "profile": {
    "type": {
      "firstName": "String",
      "lastName": "String",
    },
    "required": true
  }
};
```

However in complex cases this can be obtuse and difficult to remember. A more
explicit syntax is allowed here:

```js
{
  "profile": {
    "type": "Object",
    "attributes": {
      "firstName": "String",
      "lastName": "String",
    },
    "required": true
  }
};
```

The type `Object` and `attributes` is a signal to create the correct schema for
the above type. This can also be similarly used for `Array` for an array of
objects:

```js
{
  "profiles": {
    "type": "Array",
    "attributes": {
      "firstName": "String",
      "lastName": "String",
    },
    "writeAccess": "none"
  }
};
```

In the above example the `writeAccess` applies to the array itself, not
individual fields. Note that for an array of primitives the correct syntax is:

```js
{
  "tokens": {
    "type": ["String"],
    "writeAccess": "none"
  }
};
```

#### Scopes

One common need is to define multiple fields with the same options. A custom
type `Scope` helps make this possible:

```js
{
  "$private": {
    "type": "Scope",
    "readAccess": "none",
    "writeAccess": "none",
    "attributes": {
      "token": "String",
      "hashedPassword": "String",
    }
  }
};
```

This syntax expands into the following:

```js
{
  "token": {
    "type": "String",
    "readAccess": "none",
    "writeAccess": "none",
  },
  "hashedPassword": {
    "type": "String",
    "readAccess": "none",
    "writeAccess": "none",
  }
};
```

Note that the name `$private` is arbitrary. The `$` helps distinguish it from
real fields, but it can be anything as the property is removed.

#### Tuples

Array fields that have more than one element are considered a "tuple". They will
enforce an exact length and specific type for each element.

```js
{
  "location": ["Number", "Number"],
}
```

This will map to the following:

```js
{
  "location": {
    "type": ["Mixed"],
    "validator": // ...
  }
}
```

Where `validator` is a special validator that enforces both the exact array
length and content types.

Note that Mongoose
[does not provide a way to enforce array elements of specific mixed types](https://github.com/Automattic/mongoose/issues/10894),
requiring the `Mixed` type instead.

#### Array Extensions

A common need is to validate the length of an array or make it required by
enforcing a minimum length of 1. However this does not exist in Mongoose:

```js
{
  "tokens": {
    "type": ["String"],
    "required": true
  }
};
```

The above syntax will not do anything as the default for arrays is always `[]`
so the field will always exist. It also suffers from being ambiguous (is the
array required or the elements inside?). An extension is provided here for
explicit handling of this case:

```json
{
  "tokens": {
    "type": ["String"],
    "minLength": 1,
    "maxLength": 2
  }
}
```

A custom validator will be created to enforce the array length, bringing parity
with `minLength` and `maxLength` on strings.

#### String Trimming

Note that strings are always trimmed by default. To disable this pass `false`
explicitly for the `trim` flag.

```jsonc
{
  // Implies trim: true
  "name": "String",

  // Preserves surrounding whitespace
  "nameLong": {
    "type": "String",
    "trim": false,
  },
}
```

### Gotchas

#### The `type` field is special:

```js
{
  "location": {
    "type": "String",
    "coordinates": ["Number"],
  }
}
```

Given the above schema, let's say you want to add a default. The appropriate
schema would be:

```js
{
  "location": {
    "type": {
      "type": "String",
      "coordinates": ["Number"],
    },
    "default": {
      "type": "Point",
      "coordinates": [0, 0],
    }
  }
}
```

However this is not a valid definition in Mongoose, which instead sees `type`
and `default` as individual fields. A type definition and object schema
unfortunately cannot be disambiguated in this case.
[Syntax extentsions](#syntax-extensions) provides an escape hatch here:

```js
{
  "location": {
    "type": "Object",
    "attributes": {
      "type": "String",
      "coordinates": ["Number"],
    },
    "default": {
      "type": "Point",
      "coordinates": [0, 0],
    }
  }
}
```

This will manually create a new nested subschema.

## Modules

### Soft Delete

The soft delete module ensures that no documents are permanently deleted by
default and provides helpful methods to query on and restore deleted documents.
"Soft deletion" means that deleted documents have the properties `deleted` and
`deletedAt`.

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
- `destroyMany` - Permanently deletes multiple documents. Be careful with this
  one.

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

- `findOneAndDelete` - The soft equivalent of the
  [Mongoose method](https://mongoosejs.com/docs/api/model.html#model_Model-findOneAndDelete).
  Fetches the current data before deleting and returns the document.
- `findByIdAndDelete` - The soft equivalent of the
  [Mongoose method](https://mongoosejs.com/docs/api/model.html#model_Model-findByIdAndDelete).
  Fetches the current data before deleting and returns the document.

#### Disallowed Methods

Due to ambiguity with the soft delete module, the following methods will throw
an error:

- `Document.remove` - Use `Document.delete` or `Document.destroy` instead.
- `Document.deleteOne` - Use `Document.delete` or `Model.deleteOne` instead.

- `Model.findOneAndRemove` - Use `Model.findOneAndDelete` instead.
- `Model.findByIdAndRemove` - Use `Model.findByIdAndDelete` instead.

#### Unique Constraints

Although monogoose allows a `unique` option on fields, this will add a unique
index to the mongo collection itself which is incompatible with soft deletion.

This module will intercept `unique: true` to create a soft delete compatible
validation which will:

- Throw an error if other non-deleted documents with the same fields exist when
  calling:
  - `Document.save`
  - `Document.update`
  - `Document.restore`
  - `Model.updateOne` (see note below)
  - `Model.updateMany` (see note below)
  - `Model.restoreOne`
  - `Model.restoreMany`
  - `Model.insertMany`
  - `Model.replaceOne`
- Append the same validation to `Model.getCreateValidation` and
  `Model.getUpdateValidation` to allow this constraint to trickle down to the
  API.

> [!WARNING]
> Note that calling `Model.updateOne` will throw an error when a
> unique field exists on any document **including the document being updated**.
> This is an intentional constraint that allows `updateOne` better peformance by
> not having to fetch the ids of the documents being updated in order to exclude
> them. To avoid this call `Document#save` instead.
>
> Note also that calling `Model.updateMany` with a unique field passed will
> always throw an error as the result would inherently be non-unique.

### Validation

Models are extended with methods that allow complex validation that derives from
the schema. Bedrock validation is generally used at the API level:

```js
const Router = require('@koa/router');
const router = new Router();

router.post(
  '/',
  validateBody(
    User.getCreateValidation().append({
      password: yd.string().password().required(),
    }),
  ),
  async (ctx) => {
    // ....
  },
);
```

In the above example `getCreateValidation` returns a
[yada](https://github.com/bedrockio/yada) schema that is validated in the
`validateBody` middleware. The `password` field is an additional field that is
appended to the create schema.

There are 4 main methods to generate schemas:

- `getCreateValidation`: Validates all fields while disallowing reserved fields
  like `id`, `createdAt`, and `updatedAt`.
- `getUpdateValidation`: Validates all fields as optional (ie. they will not be
  validated if they don't exist on the input). Additionally will strip out
  reserved fields to allow created objects to be passed in. Unknown fields will
  also be stripped out rather than error to allow virtuals to be passed in.
- `getSearchValidation`: Validates fields for use with [search](#search). The
  generated validation has a number of properties:
  - In addition to the base field schemas, arrays or ranges are also allowed.
    See [search](#search) for more.
  - The special fields `limit`, `sort`, `keyword`, `include`, and `ids` are also
    allowed.
  - Array fields are "unwound". This means that for example given an array field
    `categories`, input may be either a string or an array of strings.
- `getDeleteValidation`: Only used for access validation (more below).

#### Named Validations

Named validations can be specified on the model:

```json
{
  "email": {
    "type": "String",
    "validate": "email"
  }
}
```

Validator functions are [yada](https://github.com/bedrockio/yada#methods)
schemas. Note that:

- `email` - Will additionally downcase any input.
- `password` - Is not supported as it requires options to be passed and is not a
  field stored directly in the database.
- `mongo` - Is instead represented in the models as `ObjectId` to have parity
  with `type`.
- `min` - Defined instead directly on the field with `minLength` for strings and
  `min` for numbers.
- `max` - Defined instead directly on the field with `maxLength` for strings and
  `max` for numbers.

Schemas may also be
[merged together](https://github.com/bedrockio/yada#merging-fields) to produce
new ones:

```js
import yd from '@bedrockio/yada';

const signupSchema = yd.object({
  ...User.getCreateValidation().export(),
  additionalField: yd.string().required(),
});
```

### Search

Models are extended with a `search` method that allows for complex searching:

```js
const { data, meta } = await User.search();
```

The method takes the following options:

- `limit` - Limit for the query. Will be output in `meta`.
- `sort` - The sort for the query as an object containing a `field` and an
  `order` of `"asc"` or `"desc"`. May also be an array.
- `include` - Allows [include](#includes) based population.
- `keyword` - A keyword to perform a [keyword search](#keyword-search).
- `ids` - An array of document ids to search on.

Any other fields passed in will be forwarded to `find`. The return value
contains the found documents in `data` and `meta` which contains metadata about
the search:

- `total` The total document count for the query.
- `limit` The limit for the query.
- `skip` The number skipped.

#### Advanced Searching

Input to `search` will execute the optimal mongo query and supports several
advanced features:

- Array fields will be executed using `$in`.
- Javascript regular expressions will map to `$regex` which allows for
  [more advanced PCRE compatible features](https://docs.mongodb.com/manual/reference/operator/query/regex/#pcre-vs-javascript).
- Nested objects will be automatically flattened to query subdocuments:

```
{
  profile: {
    age: 20
  }
}
```

will be flattened to:

```json
{
  "profile.age": 20
}
```

#### Searching Arrays

Passing an array to `search` will perform a query using `$in`, which matches on
the intersection of any elements. For example,

```json
"tags": ["one", "two"]
```

is effectively saying "match any documents whose `tags` array contains any of
`one` or `two`".

For this reason, passing an empty array here is ambiguous as it could be asking:

- Match any documents whose `tags` array is empty.
- Match any documents whose `tags` array contains any of `[]` (ie. no elements
  passed so no match).

The difference here is subtle, but for example in a UI field where tags can be
chosen but none happen to be selected, it would be unexpected to return
documents simply because their `tags` array happens to be empty.

The `search` method takes the simpler approach here where an empty array will
simply be passed along to `$in`, which will never result in a match.

However, as a special case, `null` may instead be passed to `search` for array
fields to explicitly search for empty arrays:

```js
await User.search({
  tags: null,
});
// Equivalent to:
await User.find({
  tags: [],
});
```

This works because Mongoose will always initialize an array field in its
documents (ie. the field is always guarnateed to exist and be an array), so an
empty array can be thought of as equivalent to `{ $exists: false }` for array
fields. Thinking of it this way makes it more intuitive that `null` should
match.

#### Range Based Search

Additionally, date and number fields allow range queries in the form:

```json
"age": {
  "gt": 1,
  "lt": 2
}
```

A range query can use `lt`, `gt`, or both. Additionally `lte` and `gte` will
query on less/greater than or equal values.

#### Keyword Search

Passing `keyword` to the search method will perform a keyword search. To use
this feature a `fields` key must be present on the model definition:

```json
{
  "attributes": {
    "name": {
      "type": "String"
    },
    "email": {
      "type": "String"
    }
  },
  "search": {
    "fields": ["name", "email"]
  }
}
```

This will use the `$or` operator to search on multiple fields. If the model has
a text index applied, then a Mongo text query will be attempted:

```
{
  $text: {
    $search: keyword
  }
}
```

#### Keyword Search Decomposition

Mongo text indexes don't allow partial matches by default which can be limiting.
Field based keyword search can do this but with limitations:

```json
{
  "attributes": {
    "firstName": "String",
    "lastName": "String"
  },
  "search": {
    "fields": ["firstName", "lastName"]
  }
}
```

Although this will perform partial matches for each field, a full name keyword
like`Frank Reynolds` will not match:

```json
{
  "$or": [
    {
      "firstName": {
        "$regex": "Frank Reynolds"
      }
    },
    {
      "lastName": {
        "$regex": "Frank Reynolds"
      }
    }
  ]
}
```

Field decomposition provides a hint to decompose the keyword to provide matches:

```json
{
  "attributes": {
    "firstName": "String",
    "lastName": "String"
  },
  "search": {
    "decompose": "{firstName} {lastName...}",
    "fields": ["firstName", "lastName"]
  }
}
```

This tells the keyword query builder that the first token should be taken as the
`firstName` and any tokens after that (`...`) should be taken as the last. Note
the `decompose` field may also be an array.

#### Search Validation

The [validation](#validation) generated for search using `getSearchValidation`
is inherently looser and allows more fields to be passed to allow complex
searches compatible with the above.

#### Default Sort Order

When using `search` the default sort order is:

```json
{
  "field": "_id",
  "order": "asc"
}
```

The justification for this as the default is:

- Ascending sort order matches the behavior of `find` methods.
- For the majority of cases `_id` behaves identically to `createdAt` with one
  major difference: for very large collections queries can become signifcantly
  slow without an index on the `createdAt` field. Using `_id` prefers the
  default (and heavily optimized) `_id` index instead. For cases where
  `createdAt` is semantically distinct, simply pass it as the sort field
  instead.
- Mongo collections use `$natural` sort by default which follows disk order. For
  small collections this is **generally** the same as insert order, however
  documents may appear out of order for a number of different reasons which is
  not acceptable for search operations. When maximum efficiency is needed (logs,
  event streams, etc), `$natural` can still be passed.

### Cache

The cache module allows a simple way to cache foreign fields on a document and
optionally keep them in sync.

```json
{
  "attributes": {
    "user": {
      "type": "ObjectId",
      "ref": "User"
    }
  },
  "cache": {
    "userName": {
      "type": "String",
      "path": "user.name"
    }
  }
}
```

The above example is equivalent to creating a field called `userName` and
setting it when a document is saved:

```js
schema.add({
  userName: 'String',
});
schema.pre('save', function () {
  await this.populate('user');
  this.userName = this.user.name;
});
```

#### Syncing Cached Fields

By default cached fields are only updated when the reference changes. This is
fine when the field on the foreign document will not change or to keep a
snapshot of the value. However in some cases the local cached field should be
kept in sync when the foreign field changes:

```json
{
  "attributes": {
    "user": {
      "type": "ObjectId",
      "ref": "User"
    }
  },
  "cache": {
    "userName": {
      "type": "String",
      "path": "user.name",
      "sync": true
    }
  }
}
```

The "sync" field is the equivelent of running a post save hook on the foreign
model to keep the cached field in sync:

```js
userSchema.post('save', function () {
  await Shop.updateMany({
    user: this.id,
  }, {
    $set: {
      userName: this.name
    }
  })
});
```

##### Initial Sync

When first applying or making changes to defined cached search fields, existing
documents will be out of sync. The static method `syncCacheFields` is provided
to synchronize them:

```js
// Find and update any documents that do not have
// existing cached fields. Generally called after
// adding or modifying a cached field.
await Model.syncCacheFields();
```

### Includes

Populating foreign documents with
[populate](https://mongoosejs.com/docs/populate.html) is a powerful feature of
mongoose. In the past Bedrock has made use of the
[autopopulate](https://plugins.mongoosejs.io/plugins/autopopulate) plugin,
however has since moved away from this for two reasons:

1. Document population is highly situational. In complex real world applications
   a document may require deep population or none at all, however autopopulate
   does not allow this level of control.
2. Although circular references usually are the result of bad data modeling, in
   some cases they cannot be avoided. Autopopulate will keep loading these
   references until it reaches a maximum depth, even when the fetched data is
   redundant.

Both of these issues have major performance implications which result in slower
queries and more unneeded data transfer over the wire.

For this reason calling `populate` manually is highly preferable, however in
complex situations this can easily be a lot of overhead. The include module
attempts to streamline this process by adding an `include` method to queries:

```js
const product = await Product.findById(id).include('shop.user.customers');
```

This method accepts a string or array of strings that will map to a `populate`
call that can be far more complex:

```js
const product = await Product.findById(id).populate([
  {
    select: [],
    populate: [
      {
        path: 'shop',
        select: [],
        populate: [
          {
            path: 'user',
            select: [],
            populate: [],
          },
          {
            path: 'customers',
            select: [],
            populate: [],
          },
        ],
      },
    ],
  },
]);
```

In addition to brevity, one major advantage of using `include` is that the
caller does not need to know whether the path contains subdocuments or foreign
references. As Bedrock has knowledge of the schemas, it is able to build the
appropriate call to `populate` for you.

#### Include Syntax

| Example           | Type      | Populated | Description                                          |
| ----------------- | --------- | --------- | ---------------------------------------------------- |
| `shop`            | Inclusive | shop      | Populates top level document.                        |
| `shop.user`       | Inclusive | shop/user | Populates two levels deep.                           |
| `^name`           | Exclusive |           | Selects only `name`.                                 |
| `^shop.name`      | Exclusive | shop      | Selects only `shop.name`.                            |
| `^shop.user.name` | Exclusive | shop/user | Selects only `shop.user.name`.                       |
| `shop.^user.name` | Exclusive | shop/user | Selects root fields and `shop.user.name`.            |
| `shop.user.^name` | Exclusive | shop/user | Selects root and `shop` fields and `shop.user.name`. |
| `*Name`           | Wildcard  |           | Matches any root field ending with `Name`.           |
| `**Name`          | Wildcard  |           | Matches any root or nested field ending with `Name`. |

#### Exclusive Fields

By default, arguments to `include` are for population. However often field
projection (selection) is also desired to avoid excessive data transfer. The `^`
token can be used here to build the `select` option to populates:

```js
const product = await Product.findById(id).include([
  '^name',
  '^shop.name',
  '^shop.user.name',
]);
```

This will map to a selective inclusion of fields in the `populate` call:

```js
const product = await Product.findById(id).populate([
  {
    select: ['name', 'shop'],
    populate: [
      {
        path: 'shop',
        select: ['name', 'user'],
        populate: [
          {
            path: 'user',
            select: ['name'],
            populate: [],
          },
        ],
      },
    ],
  },
]);
```

The resulting data will include only the specified fields:

```json
{
  "name": "Product Name",
  "shop": {
    "name": "Shop Name",
    "user": {
      "name": "User Name"
    }
  }
}
```

Note that the exclusive operator can be used anywhere in the path. The exclusion
(select) will be applied at the depth in which it is specified:

Example 1:

- Top level exclusion
- Only exact field returned.

```js
await Product.findById(id).include('^shop.user.name').
```

```json
{
  "shop": {
    "user": {
      "name": "User Name"
    }
  }
}
```

Example 2:

- Mid-level exclusion.
- Top level fields included, mid-level begins exclusion.

```js
await Product.findById(id).include('shop.^user.name').
```

```jsonc
{
  "name": "Product Name",
  "cost": 10,
  // etc
  "shop": {
    "user": {
      "name": "User Name",
    },
  },
}
```

Example 3:

- Final level exclusion.
- All fields returned except in final `user` population.

```js
await Product.findById(id).include('shop.user.^name').
```

```jsonc
{
  "name": "Product Name",
  "cost": 10,
  // etc
  "shop": {
    "name": "Shop Name",
    "rating": 5,
    // etc
    "user": {
      "name": "User Name",
    },
  },
}
```

> [!WARNING]
> Fields that are dynamically referenced using `refPath` are unable
> to resolve the schemas beforehand (ie. before query execution), therefore they
> can only be populated at the top level.

#### Excluded Fields

Fields can be excluded rather than included using `-`:

```js
const user = await User.findById(id).include('-profile');
```

The above will return all fields except `profile`. Note that:

- Excluding fields only affects the `select` option. Foreign fields must still
  be passed, otherwise they will be returned unpopulated.
- An excluded field on a foreign reference will implicitly be populated. This
  means that passing `-profile.name` where `profile` is a foreign field will
  populate `profile` but exclude `name`.
- Note that `-` can only be used at the beginning of the path.

#### Wildcards

Multiple fields can be selected using wildcards:

- `*` - Matches anything except `.`.
- `**` - Matches anything including `.`.
- Note that the use of wildcards implies that other fields are excluded.

Example 1: Single wildcard

```js
const user = await User.findById(id).include('*Name');
```

```jsonc
{
  "firstName": "Frank",
  "lastName": "Reynolds",
  // Other fields excluded.
}
```

Example 2: Double wildcard

```js
const user = await User.findById(id).include('**.phone');
```

```json
{
  "profile1": {
    "address": {
      "phone": "String"
    }
  },
  "profile2": {
    "address": {
      "phone": "String"
    }
  }
}
```

This example above will select both `profile1.address.phone` and
`profile2.address.phone`. Compare this to `*` which will not match here.

Note that wildcards do not implicitly populate foreign fields. For example
passing `p*` where `profile` is a foreign field will include all fields matching
`p*` but it will not populate the `profile` field. In this case an array must be
used instead:

```js
const user = await User.findById(id).include(['p*', 'profile']);
```

#### Searching with includes

Note that [search](#search), which returns a query, can also use `include`:

```js
const user = await User.search({
  firstName: 'Frank',
}).include('profile');
```

#### Include as a Filter

Additionally `include` is flagged as a special parameter for filters, allowing
the following equivalent syntax on `search` as well as all `find` methods:

```js
const user = await User.find({
  firstName: 'Frank',
  include: 'profile',
});
```

#### Validation with includes

The [validation](#validation) methods additionally allow `include` as a special
field on generated schemas. This allows the client to drive document inclusion
on a case by case basis. For example, given a typical Bedrock setup:

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

The `getSearchValidation` will allow the `include` property to be passed,
letting the client populate documents as they require. Note that the fields a
client is able to include is subject to [access control](#access-control).

#### Other Differences with Populate

Calling `populate` on a Mongoose document will always load the current data. In
contrast, `include` will only load when not yet populated, providing better
performance for most situations such as pre save hooks:

```js
schema.pre('save', async () => {
  // Will not result in a populate call if the
  // owner document has already been populated.
  await this.include('owner');

  this.ownerName = this.owner.name;
});
```

If always fetching the current document is preferred, the `force` option can be
passed:

```js
await shop.include('owner', {
  force: true,
});
```

### Access Control

This module applies two forms of access control:

- [Field Access](#field-access)
- [Document Access](#document-access)

#### Field Access:

##### Read Access

Read access influences how documents are serialized. Fields that have been
denied access will be stripped out. Additionally it will influence the
validation schema for `getSearchValidation`. Fields that have been denied access
are not allowed to be searched on and will throw an error.

##### Write Access

Write access influences validation in `getCreateValidation` and
`getUpdateValidation`. Fields that have been denied access will throw an error
unless they are identical to what is already set on the document. Note that in
the case of `getCreateValidation` no document has been created yet so a denied
field will always result in an error if passed.

##### Defining Field Access

Access is defined in schemas with the `readAccess` and `writeAccess` options:

```js
{
  "name": {
    "type": "String",
    "readAccess": "none"
    "writeAccess": "none"
  },
}
```

This may be either a string or an array of strings. For multiple fields with the
same access types, use a [scope](#scopes).

##### Access on Arrays

Note that on array fields the following schema is often used:

```js
{
  "tokens": [
    {
      "type": "String",
      "readAccess": "none",
    },
  ],
};
```

However this is not technically correct as the `readAccess` above is referring
to the `tokens` array instead of individual elements. The correct schema is
technically written:

```js
{
  "tokens": {
    "type": ["String"],
    "readAccess": "none",
  },
}
```

However this is overhead and hard to remember, so `readAccess` and `writeAccess`
will be hoisted to the array field itself as a special case. Note that only
these two fields will be hoisted as other fields like `validate` and `default`
are correctly defined on the string itself.

#### Access Types

`readAccess` and `writeAccess` can specify any token. However a few special
tokens exist:

- `all` - Allows access to anyone. This token is reserved for clarity but is not
  required as it is the default.
- `none` - Allows access to no-one.
- `self` - See [document based access](#document-based-access).
- `user` - See [document based access](#document-based-access).
- `owner` - See [document based access](#document-based-access).

Any other token will use [scope based access](#scope-based-access).

##### Scope Based Access

A non-reserved token specified in `readAccess` or `writeAccess` will test
against scopes in the generated validations or when serializing:

```js
// In validation middleware:
const schema = User.getCreateValidation();
await schema.validate(ctx.request.body, {
  scopes: authUser.getScopes(),
  // Also accepted:
  scope: '...',
});
// In routes:
document.toObject({
  scopes: authUser.getScopes(),
  // Also accepted:
  scope: '...',
});
```

Note that scopes are just literal strings. For example a route already checking
that the user is admin may simply pass `.toObject({ scope: 'admin' })`. However
for more complex cases scopes are typically derived from the authUser's roles.

##### Document Based Access

Will compare a `document` or it's properties against the id of an `authUser`.

Document based access allows 3 different tokens:

- `self` - Compares `authUser.id == document.id`.
- `user` - Compares `authUser.id == document.user.id`.
- `owner` - Compares `authUser.id == document.owner.id`.

Using document based access comes with some requirements:

1. Read access must use `.toObject({ authUser })`. Note that the document is not
   required here as a reference is already kept.
2. Write access must use `schema.validate(body, { authUser, document })`.

#### Examples

For clarity, here are a few examples about how document based access control
should be used:

##### Example 1

A user is allowed to update their own date of birth, but not their email which
is set after verification:

```js
// user.json
{
  "email": {
    "type": "String",
    "writeAccess": "none"
  },
  "dob": {
    "type": "String",
    "writeAccess": "self"
  },
}
```

##### Example 2

A user is allowed to update the name of their own shop and admins can as well.
However, only admins can set the owner of the shop:

```jsonc
// shop.json
{
  "name": {
    "type": "String",
    "writeAccess": ["owner", "admin"],
  },
  "owner": {
    "type": "ObjectId",
    "ref": "User",
    "writeAccess": "admin",
  },
}
```

##### Example 3

A user is allowed to update the fact that they have received their medical
report, but nothing else. The medical report is received externally so even
admins are not allowed to change the user they belong to.

The difference with `owner` here is the name only, however both options exist as
a `user` defined on a schema does not necessarily represent the document's
owner, as this example illustrates:

```js
// medical-report.json
{
  "received": {
    "type": "String",
    "writeAccess": "user"
  },
  "user": {
    "type": "ObjectId",
    "ref": "User",
    "writeAccess": "none"
  }
}
```

##### Notes on Read Access

Note that all forms of read access require that `.toObject` is called on the
document with special parameters, however this method is called on internal
serialization including both `JSON.stringify` and logging to the console. For
this reason it will never fail even if it cannot perform the correct access
checks. Instead any fields with `readAccess` defined on them will be stripped
out.

##### Notes on Write Access

Note that `self` is generally only meaningful on a User model as it will always
check the document is the same as `authUser`.

#### Document Access

In addition to the fine grained control of accessing fields, documents
themselves may also have access control. This can be defined in the `access` key
of the model definition:

```jsonc
// user.json
{
  "attributes": {
    // ...
  },
  "access": {
    // A user may update themselves or an admin.
    "update": ["self", "admin"],
    // Only an admin may delete a user.
    "delete": ["admin"],
  },
}
```

The same options can be used as
[document based access on fields](#document-based-access), so this could be
`owner`, etc:

```jsonc
// shop.json
{
  "attributes": {
    "owner": {
      "type": "ObjectId",
      "ref": "User",
    },
  },
  "access": {
    // An owner may update their own shop.
    "update": ["owner", "admin"],
    // Only an admin may delete a shop.
    "delete": ["admin"],
  },
}
```

### Delete Hooks

Delete hooks are a powerful way to define what actions are taken on document
deletion. They are defined in the `onDelete` field of the model definition file:

```jsonc
// user.json
{
  "attributes": {
    "name": "String",
    "profile": {
      "type": "ObjectId",
      "ref": "UserProfile",
    },
  },
  "onDelete": {
    "clean": [
      {
        "path": "profile",
      },
      {
        "ref": "Shop",
        "path": "owner",
      },
    ],
    "errorOnReferenced": {
      "except": ["AuditEntry"],
    },
  },
}
```

#### Clean

`clean` determines other associated documents that will be deleted when the main
document is deleted. It is defined as an array of operations that will be
performed in order. Operations must contain either `path` or `paths`.

#### Local References

Operations that do not specify a `ref` are treated as local paths. In the above
example:

```js
user.delete();

// Will implicitly run:
await user.populate('profile');
await user.profile.delete();
```

#### Foreign References

Operations that specify a `ref` are treated as foreign references. In the above
example:

```js
user.delete();

// Will implicitly run:
const shops = await Shop.find({
  owner: user,
});
for (let shop of shops) {
  await shop.delete();
}
```

#### Additional Filters

Operations may filter on additional fields with `query`:

```jsonc
// user.json
{
  "onDelete": {
    "clean": [
      {
        "ref": "Shop",
        "path": "owner",
        "query": {
          "status": "active",
        },
      },
    ],
  },
}
```

In this example:

```js
user.delete();

// Will implicitly run:
const shops = await Shop.find({
  status: 'active',
  owner: user,
});
for (let shop of shops) {
  await shop.delete();
}
```

Any query that can be serliazed as JSON is valid, however top-level `$or`
operators have special behavior with multiple paths (see note below).

#### Multiple Paths

An operation that specified an array of `paths` will implicitly run an `$or`
query:

```jsonc
// user.json
{
  "onDelete": {
    "clean": [
      {
        "ref": "Shop",
        "path": ["owner", "administrator"],
      },
    ],
  },
}
```

In this example:

```js
user.delete();

// Will implicitly run:
const shops = await Shop.find({
  $or: [
    {
      owner: user,
    },
    {
      administrator: user,
    },
  ],
});
for (let shop of shops) {
  await shop.delete();
}
```

> [!WARNING]
> The ability to run an `$and` query with multiple paths is currently
> not implemented.

#### Erroring on Delete

The `errorOnReferenced` field helps to prevent orphaned references by defining
if and how the `delete` method will error if it is being referenced by another
foreign document. In the top example:

```js
user.delete();

// Will error if referenced by any document other than:
// 1. AuditEntry - Explicitly allowed by "except".
// 2. Shop - Implicitly allowed as it will be deleted.
```

In this case, "referenced by" means any other model that explicitly uses "User"
as a `ref` for type `ObjectId`. `errorOnReferenced` may also be simply `true`,
which will error on any foreign references of any kind.

`only` may be passed instead of `except`, which will only error when the
document is referenced by referenced by specific models.

#### Restoring Deleted Documents

Models that have delete hooks defined on them will keep a reference of the
documents that were deleted. Calling `.restore()` on the document will also
restore these references.

> [!WARNING]
> Delete hooks are **only** run on a single document (`.delete` or
> `.restore`). They will not be run when using model methods like `deleteOne` or
> `deleteMany`.

### Assign

Applies a single instance method `assign` to documents:

```js
user.assign(ctx.request.body);
// Compare to:
Object.assign(user, ctx.request.body);
```

This is functionally identical to `Object.assign` with the exception that fields
can be unset by passing falsy values. This method is provided as `undefined`
cannot be represented in JSON which requires using either a `null` or empty
string, both of which would be stored in the database if naively assigned with
`Object.assign`.

### Upsert

This module adds two similar methods:

- `upsert`
- `findOrCreate`

The `upsert` method is used when documents must always be overwritten with the
latest data.

```js
const shop = await Shop.upsert(
  {
    name: 'My Shop',
  },
  {
    name: 'My Shop',
    slug: 'my-shop',
  },
);

// This is equivalent to:

let shop = await Shop.findOne({
  name: 'My Shop',
});

if (shop) {
  shop.assign({
    name: 'My Shop',
    slug: 'my-shop',
  });
  await shop.save();
} else {
  shop = await Shop.create({
    name: 'My Shop',
    slug: 'my-shop',
  });
}
```

The `findOrCreate` method does just whan the name implies and will return the
document it finds without modifying it.

```js
const shop = await Shop.findOrCreate(
  {
    name: 'My Shop',
  },
  {
    name: 'My Shop',
    slug: 'my-shop',
  },
);

// This is equivalent to:

let shop = await Shop.findOne({
  name: 'My Shop',
});

if (!shop) {
  shop = await Shop.create({
    name: 'My Shop',
    slug: 'my-shop',
  });
}
```

Note that a single argument can also be passed as a shortcut to both the query
and the update for simple cases:

```js
const shop = await Shop.findOrCreate({
  name: 'My Shop',
});

// This is equivalent to:

let shop = await Shop.findOne({
  name: 'My Shop',
});

if (!shop) {
  shop = await Shop.create({
    name: 'My Shop',
  });
}
```

### Reload

Adds a single `reload` method that reloads a document in place. This is useful
for testing purposes, etc:

```js
const shop = await Shop.create({
  name: 'My Shop',
});

await Shop.updateOne(
  {
    _id: shop._id,
  },
  {
    $set: {
      name: 'My New Shop',
    },
  },
);

await shop.reload();

shop.name; // Now "My New Shop"
```

### Clone

Adds a single `clone` method on documents that makes up for some of the shortcomings of the Mongoose `$clone` method:

- A new `id` will be generated.
- Populated and self-referencing documents are handled.
- Unique fields will be augmented to not collide.

### Slugs

A common requirement is to allow slugs on documents to serve as ids for human
readable URLs. This module simplifies this by assuming a `slug` field on a model
and adding a `findByIdOrSlug` method that allows searching on either:

```js
const post = await Post.findByIdOrSlug(str);
```

Note that soft delete methods are also applied:

- `findByIdOrSlugDeleted`
- `findByIdOrSlugWithDeleted`

Also note that as Mongo ids are represented as 24 byte hexadecimal a collision
is possible:

- `deadbeefdeadbeefdeadbeef`
- `cafecafecafecafecafecafe`

However the likelyhood of such collisions on a slug are acceptably small.

## Testing

A helper `createTestModel` is exported to allow quickly building models for
testing:

```js
const { createTestModel } = require('@bedrockio/model');

const User = createTestModel({
  name: 'String',
});
```

Note that a unique model name will be generated to prevent clashing with other
models. This can be accessed with `Model.modelName` or to make tests more
readable it can be overridden:

```js
const { createTestModel } = require('@bedrockio/model');

const Post = createTestModel('Post', {
  name: 'String',
});
```

Make sure in this case that the model name is unique.

## Troubleshooting

Q: I'm seeing `scopes were requested but not provided` messages everywhere. What
is this?

A: When a model has fields with `readAccess`, documents require extra context to
be able to serialize properly. In practice this means calling `toObject` on the
document without the `scopes` option will generate this warning. This also means
that functions like `console.log` that internally call `toString` on the
document will also show warnings. Possible causes include:

- `console.log(document)` - solution here is to remove the log or use the
  `serializeDocument` helper in bedrock core.
- A bug in Mongoose (observed in v8.3.2) prevents serialize options from being
  passed down to nested documents. Bumping the Mongoose version should fix this.
