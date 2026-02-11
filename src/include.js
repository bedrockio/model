import { escapeRegExp } from 'lodash';
import mongoose from 'mongoose';

import { POPULATE_MAX_DEPTH } from './const';
import { getSchemaPaths } from './utils';
import { getInnerField, isSchemaTypedef } from './utils';

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

export function applyInclude(schema) {
  // Query Includes

  schema.pre(/^find/, function () {
    const filter = this.getFilter();
    if (filter.include) {
      const { select, populate } = getQueryParams(this, filter.include);
      this.select(select);
      this.populate(populate);
      delete filter.include;
    }
  });

  schema.pre(/^count/, function () {
    const filter = this.getFilter();
    delete filter.include;
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
    },
  );

  // Synchronous method assigns the includes to locals.
  // Population will be performed on the post save hook below.
  // Selects will be performed during serialization.
  schema.method('assignWithInclude', function assignWithInclude(attributes) {
    const { include, ...rest } = attributes;

    this.assign(rest);

    if (include) {
      const { select, populate } = getDocumentParams(this, include);
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
  schema.method('include', async function include(include, options) {
    if (include) {
      const { select, populate } = getDocumentParams(this, include, options);
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
export function getParams(modelName, arg) {
  const paths = resolvePathsArg(arg);
  const node = pathsToNode(paths, modelName);
  return nodeToPopulates(node);
}

function resolvePathsArg(arg) {
  if (Array.isArray(arg)) {
    return arg;
  } else if (arg instanceof Set) {
    return Array.from(arg);
  } else {
    return [arg];
  }
}

// Exported for testing.
export function getDocumentParams(doc, arg, options = {}) {
  const params = getParams(doc.constructor.modelName, arg);

  if (!options.force) {
    params.populate = params.populate.filter((p) => {
      return !isPopulated(doc, p);
    });
  }

  return params;
}

function isPopulated(arg, params) {
  if (Array.isArray(arg)) {
    return arg.every((el) => {
      return isPopulated(el, params);
    });
  }
  if (arg.populated(params.path)) {
    const sub = arg.get(params.path);
    return params.populate.every((p) => {
      return isPopulated(sub, p);
    });
  } else {
    return false;
  }
}

function getQueryParams(query, arg) {
  return getParams(query.model.modelName, arg);
}

// Note that:
// - An empty array for "select" will select all.
// - Entries in the "populate" array will select the
//   field even if not included in "select".
function nodeToPopulates(node) {
  const select = [];
  const populate = [];
  for (let [key, value] of Object.entries(node)) {
    if (key.startsWith('-')) {
      select.push(key);
      continue;
    }
    if (key.startsWith('^')) {
      key = key.slice(1);
      select.push(key);
    }
    if (value) {
      populate.push({
        path: key,
        ...nodeToPopulates(value),
      });
    }
  }
  return {
    select,
    populate,
  };
}

// Null serves as a flag that the key terminates
// the branch and this is a leaf node. Using null
// here as it's simple and serializes to JSON for
// easy inspection.
const LEAF_NODE = null;

function pathsToNode(paths, modelName) {
  const node = {};
  for (let str of paths) {
    if (typeof str !== 'string') {
      throw new Error('Provided include path was not as string.');
    }
    setNodePath(node, {
      path: str.split('.'),
      modelName,
    });
  }
  return node;
}

function setNodePath(node, options) {
  const { modelName, path: fullPath, depth = 0 } = options;
  if (depth > POPULATE_MAX_DEPTH) {
    throw new Error(`Cannot populate more than ${POPULATE_MAX_DEPTH} levels.`);
  }

  const schema = mongoose.models[modelName]?.schema;

  if (!schema) {
    throw new Error(`Could not derive schema for ${modelName}.`);
  }

  let { excluded = false, exclusive = false } = options;

  const parts = [];
  for (let part of fullPath) {
    if (part.startsWith('-')) {
      // Field is excluded. Note that this occurs only at
      // top level and should take precedence:
      // -name      -> "name" is excluded
      // -user.name -> "user" is populated but "name" is
      //               excluded
      excluded = true;
      part = part.slice(1);
    } else if (!excluded && part.startsWith('^')) {
      // Field is exclusive. Note that this can happen at
      // any part of the path:
      // ^name      -> "name" is exclusively selected
      // user.^name -> "user" is populated with "name"
      //                exclusively selected within
      // ^user.name -> "user" is exclusively selected
      //               ("name" is redundant)
      exclusive = true;
      part = part.slice(1);
    } else if (!excluded && part.includes('*')) {
      // Wildcards in field implies exclusion, but only
      // if path is not already excluded:
      // *name       -> "firstName" and "lastName" are exclusively
      //                selected
      // user.*name  -> "user" is populated, "user.firstName"
      //                and "user.lastName" are exclusively selected
      // -*name      -> "firstName" and "lastName" are excluded
      // -user.*name -> "user" is populated but "user.firstName"
      //                and "user.lastName" are excluded
      exclusive = true;
    }

    parts.push(part);
    const isExact = parts.length === fullPath.length;

    let halt = false;

    for (let [path, type] of resolvePaths(schema, parts.join('.'))) {
      // The exclusive key.
      const eKey = '^' + path;
      // The negative (excluded) key.
      const nKey = '-' + path;

      let key = path;
      if (exclusive && !node[key]) {
        // Add the exclusive flag if the node
        // has not already been included.
        key = eKey;
      } else if (!exclusive && node[eKey]) {
        // If the node has already been marked exclusive
        // and another include overrides it, then we need
        // to move that node over to be inclusive. This
        // step is needed as includes should always take
        // priority over exclusion regardless of the order.
        node[key] = node[eKey];
        delete node[eKey];
      } else if (excluded && isExact) {
        // Only flag the node as excluded if the path is an
        // exact match:
        // -name      -> Exclude "name" field.
        // -user.name -> Exclude "user.name" field, however this
        //               implies that we must populate "user" so
        //               continue traversing and flag for include.
        key = nKey;
      }

      if (type === 'real') {
        const field = getInnerField(schema.obj, path);
        if (field.ref) {
          node[key] ||= {};
          setNodePath(node[key], {
            modelName: field.ref,
            path: fullPath.slice(parts.length),
            depth: depth + 1,
            excluded,
            exclusive,
          });
          halt = true;
        } else if (field.refPath) {
          // Note that dynamic references with refPath cannot "see"
          // into a field for which they don't know the type yet (ie.
          // before the query executes), therefore by definition
          // dynamic references can only be populated one layer deep.
          node[key] ||= {};
        } else if (isSchemaTypedef(field)) {
          node[key] = LEAF_NODE;
        }
      } else if (type === 'virtual') {
        const virtual = schema.virtual(path);
        // @ts-ignore
        const ref = virtual.options.ref;

        if (ref) {
          node[key] ||= {};
          setNodePath(node[key], {
            modelName: ref,
            path: fullPath.slice(parts.length),
            depth: depth + 1,
            excluded,
            exclusive,
          });
        }
        halt = true;
      } else if (type !== 'nested') {
        throw new Error(`Unknown path on ${modelName}: ${path}.`);
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
