import { ImplementationError } from './errors';
import { isEqual } from './utils';
import warn from './warn';

/**
 * @param {string|string[]} allowed
 */
export function hasAccess(allowed = 'all', options = {}) {
  if (allowed === 'all') {
    return true;
  } else if (allowed === 'none') {
    return false;
  } else {
    const { document, authUser } = options;
    const scopes = resolveScopes(options);

    allowed = resolveAllowed(allowed);
    return allowed.some((token) => {
      if (token === 'self') {
        assertOptions(token, options);
        return document.id == authUser.id;
      } else if (token === 'user') {
        assertOptions(token, options);
        return isEqual(document.user, authUser);
      } else if (token === 'owner') {
        assertOptions(token, options);
        return isEqual(document.owner, authUser);
      } else {
        return scopes?.includes(token);
      }
    });
  }
}

function resolveScopes(options) {
  if (!options.scope && !options.scopes) {
    warn('Scopes were requested but not provided.');
  }

  let scopes;
  if (options.scopes) {
    scopes = options.scopes;
  } else if (options.scope) {
    scopes = [options.scope];
  } else {
    scopes = [];
  }

  return scopes;
}

function resolveAllowed(arg) {
  const allowed = Array.isArray(arg) ? arg : [arg];

  // Sort allowed scopes to put "self" last allowing
  // role based scopes to be fulfilled first.
  allowed.sort((a, b) => {
    if (a === b) {
      return 0;
    } else if (a === 'self') {
      return 1;
    } else {
      return -1;
    }
  });

  return allowed;
}

function assertOptions(token, options) {
  if (!options.authUser || !options.document) {
    throw new ImplementationError(token);
  }
}
