import { ImplementationError } from './errors';
import warn from './warn';

export function hasReadAccess(allowed, options) {
  return hasAccess('read', allowed, options);
}

export function hasWriteAccess(allowed, options) {
  return hasAccess('write', allowed, options);
}

function hasAccess(type, allowed = 'all', options = {}) {
  if (allowed === 'all') {
    return true;
  } else if (allowed === 'none') {
    return false;
  } else {
    const { document, authUser } = options;
    if (!Array.isArray(allowed)) {
      allowed = [allowed];
    }
    const scopes = resolveScopes(options);
    return allowed.some((scope) => {
      if (scope === 'self') {
        assertAuthUser(type, scope, options);
        return document.id == authUser.id;
      } else if (scope === 'user') {
        assertAuthUser(type, scope, options);
        return document.user?.id == authUser.id;
      } else if (scope === 'owner') {
        assertAuthUser(type, scope, options);
        return document.owner?.id == authUser.id;
      } else {
        return scopes.includes(scope);
      }
    });
  }
}

function resolveScopes(options) {
  if (!options.scope && !options.scopes) {
    warn('Scopes were requested but not provided.');
  }
  const { scope, scopes = [] } = options;
  return scope ? [scope] : scopes;
}

function assertAuthUser(type, scope, options) {
  if (!options.authUser) {
    if (type === 'read') {
      throw new ImplementationError(
        `Read scope "${scope}" requires .toObject({ authUser }).`
      );
    } else {
      throw new ImplementationError(
        `Write scope "${scope}" requires passing { authUser } to the validator.`
      );
    }
  }
}
