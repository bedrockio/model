import mongoose from 'mongoose';
import { escapeRegExp } from 'lodash';
import yd from '@bedrockio/yada';

import { getInnerField, isSchemaTypedef } from './utils';
import { POPULATE_MAX_DEPTH } from './const';

// @ts-ignore
// Overloading mongoose Query prototype to
// allow an "include" method for queries.
mongoose.Query.prototype.include = function include(arg) {
  if (arg) {
    const filter = this.getFilter();
    filter.include = arg;
  }
  return this;
};

const DESCRIPTION = 'Field to be selected or populated.';

export const INCLUDE_FIELD_SCHEMA = yd.object({
  include: yd.allow(
    yd.string().description(DESCRIPTION),
    yd.array(yd.string().description(DESCRIPTION))
  ),
});

export function applyInclude(schema) {
  // Query Includes

  schema.pre(/^find/, function (next) {
    const filter = this.getFilter();
    if (filter.include) {
      const { select, populate } = getQueryIncludes(this, filter.include);
      this.select(select);
      this.populate(populate);
      delete filter.include;
    }
    return next();
  });

  schema.pre(/^count/, function (next) {
    const filter = this.getFilter();
    delete filter.include;
    return next();
  });

  // Static Methods

  // Async method runs the create first then calls into
  // the instance method to run the populate.
  schema.static(
    'createWithInclude',
    async function createWithInclude(attributes) {
      const { include, ...rest } = attributes;
      const doc = await this.create(rest);
      if (include) {
        await doc.include(include);
      }
      return doc;
    }
  );

  // Synchronous method assigns the includes to locals.
  // Population will be performed on the post save hook below.
  // Selects will be performed during serialization.
  schema.method('assignWithInclude', function assignWithInclude(attributes) {
    const { include, ...rest } = attributes;

    this.assign(rest);

    if (include) {
      const { select, populate } = getDocumentIncludes(this, include);
      this.$locals.select = select;
      this.$locals.populate = populate;
    }
  });

  schema.post('save', async function () {
    const { populate } = this.$locals;
    if (populate) {
      await this.populate(populate);
      delete this.$locals.populate;
    }
  });

  // Instance Methods

  // Perform population immediately when instance method is called.
  // Store selects as a local variable which will be checked
  // during serialization.
  schema.method('include', async function include(include) {
    if (include) {
      const { select, populate } = getDocumentIncludes(this, include);
      this.$locals.select = select;
      await this.populate(populate);
    }
  });
}

// "Selected" keys virtually project documents so that
// they do not return the entire document down the wire.
// This is to maintain parity with query projection used
// with the includes feature.
export function checkSelects(doc, ret) {
  let { select } = doc.$locals;
  if (select?.length) {
    const includes = {};
    const excludes = {};
    select = [...select, 'id'];
    let hasExcludes = false;
    for (let path of select) {
      if (path.startsWith('-')) {
        excludes[path.slice(1)] = true;
        hasExcludes = true;
      } else {
        includes[path] = true;
      }
    }
    for (let key of Object.keys(ret)) {
      // Always select populated fields.
      if (doc.populated(key)) {
        continue;
      }
      // Fields are either explicitly excluded with "-"
      // or implicitly excluded by having only includes.
      const implicitExclude = !hasExcludes && !includes[key];
      if (excludes[key] || implicitExclude) {
        delete ret[key];
      }
    }
  }
}

// Exported for testing.
export function getIncludes(modelName, arg) {
  const paths = Array.isArray(arg) ? arg : [arg];
  const node = pathsToNode(paths, modelName);
  return nodeToPopulates(node);
}

function getQueryIncludes(query, arg) {
  return getIncludes(query.model.modelName, arg);
}

function getDocumentIncludes(doc, arg) {
  return getIncludes(doc.constructor.modelName, arg);
}

// Note that:
// - An empty array for "select" will select all.
// - Entries in the "populate" array will select the
//   field even if not included in "select".
function nodeToPopulates(node) {
  const select = [];
  const populate = [];
  for (let [key, value] of Object.entries(node)) {
    if (value) {
      populate.push({
        path: key,
        ...nodeToPopulates(value),
      });
    } else {
      select.push(key);
    }
  }
  return {
    select,
    populate,
  };
}

function pathsToNode(paths, modelName) {
  const node = {};
  for (let str of paths) {
    if (typeof str !== 'string') {
      throw new Error('Provided include path was not as string.');
    }
    let exclude = false;
    if (str.startsWith('-')) {
      exclude = true;
      str = str.slice(1);
    }
    setNodePath(node, {
      path: str.split('.'),
      modelName,
      exclude,
    });
  }
  return node;
}

function setNodePath(node, options) {
  const { path, modelName, exclude, depth = 0 } = options;
  if (depth > POPULATE_MAX_DEPTH) {
    throw new Error(`Cannot populate more than ${POPULATE_MAX_DEPTH} levels.`);
  }
  const schema = mongoose.models[modelName]?.schema;
  if (!schema) {
    throw new Error(`Could not derive schema for ${modelName}.`);
  }
  const parts = [];
  for (let part of path) {
    parts.push(part);
    const str = parts.join('.');
    const isExact = parts.length === path.length;
    let halt = false;

    for (let [key, type] of resolvePaths(schema, str)) {
      if (type === 'real') {
        const field = getInnerField(schema.obj, key);
        // Only exclude the field if the match is exact, ie:
        // -name - Exclude "name"
        // -user.name - Implies population of "user" but exclude "user.name",
        //  so continue traversing into object when part is "user".
        if (isExact && exclude) {
          node['-' + key] = null;
        } else if (field.ref) {
          node[key] ||= {};
          setNodePath(node[key], {
            modelName: field.ref,
            path: path.slice(parts.length),
            depth: depth + 1,
            exclude,
          });
          halt = true;
        } else if (isSchemaTypedef(field)) {
          node[key] = null;
        }
      } else if (type === 'virtual') {
        const virtual = schema.virtual(key);
        // @ts-ignore
        const ref = virtual.options.ref;

        if (ref) {
          node[key] ||= {};
          setNodePath(node[key], {
            // @ts-ignore
            modelName: ref,
            path: path.slice(parts.length),
            depth: depth + 1,
            exclude,
          });
        }
        halt = true;
      } else if (type !== 'nested') {
        throw new Error(`Unknown path on ${modelName}: ${key}.`);
      }
    }

    if (halt) {
      break;
    }
  }
}

function resolvePaths(schema, str) {
  let paths;
  if (str.includes('*')) {
    let source = escapeRegExp(str);
    source = source.replaceAll('\\*\\*', '.+');
    source = source.replaceAll('\\*', '[^.]+');
    source = `^${source}$`;
    const reg = RegExp(source);
    paths = getSchemaPaths(schema).filter((path) => {
      return reg.test(path);
    });
  } else {
    paths = [str];
  }
  return paths.map((path) => {
    return [path, schema.pathType(path)];
  });
}

function getSchemaPaths(schema) {
  return Object.entries(schema.paths || {}).flatMap(([key, schema]) => {
    if (key.startsWith('_')) {
      return [];
    } else if (schema.schema) {
      return getSchemaPaths(schema.schema).map((path) => {
        return [key, path].join('.');
      });
    } else {
      return [key];
    }
  });
}
