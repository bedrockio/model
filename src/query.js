// Wrapper that allows a mongoose query object to be returned
// to access chained methods while still resolving with a
// transformed value. Allows methods to behave like other find
// methods and importantly allow custom population with the same API.
export function wrapQuery(query, fn) {
  const runQuery = query.then.bind(query);
  query.then = async (resolve, reject) => {
    try {
      resolve(await fn(runQuery()));
    } catch (err) {
      reject(err);
    }
  };
  return query;
}

export function mergeQuery(target, source) {
  const result = Object.assign({}, target, source);
  if (target.$or && source.$or) {
    const { $or } = target;
    result.$or = source.$or.map((conditions) => {
      return {
        $and: [conditions, { $or }],
      };
    });
  }
  return result;
}
