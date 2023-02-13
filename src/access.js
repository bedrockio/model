import { ImplementationError } from './errors';
import warn from './warn';

export function hasReadAccess(allowed, options) {
  return hasAccess('read', allowed, options);
}

export function hasWriteAccess(allowed, options) {
  return hasAccess('write', allowed, options);
}

export function hasAccess(type, allowed = 'all', options = {}) {
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
    return allowed.some((token) => {
      if (token === 'self') {
        assertOptions(type, token, options);
        return document.id == authUser.id;
      } else if (token === 'user') {
        assertOptions(type, token, options);
        return document.user?.id == authUser.id;
      } else if (token === 'owner') {
        assertOptions(type, token, options);
        return document.owner?.id == authUser.id;
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
  const { scope, scopes = [] } = options;
  return scope ? [scope] : scopes;
}

function assertOptions(type, token, options) {
  if (!options.authUser || !options.document) {
    if (type === 'read') {
      throw new ImplementationError(
        `Read access "${token}" requires .toObject({ authUser }).`
      );
    } else {
      throw new ImplementationError(
        `Write access "${token}" requires passing { document, authUser } to the validator.`
      );
    }
  }
}
