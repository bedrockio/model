/**
 * Mongoose Model interface augmentations.
 * Note that signatures inside these files must match mongoose
 * 8.19.2 Model interface. Types script will fail if this package
 * is bumped and that signature does not match.
 */

import './modules/search';
import './modules/validation';
import './modules/soft-delete';
import './modules/upsert';
import './modules/slug';
import './modules/cache';
import './modules/include';
import './modules/hydrate';
import './modules/assign';
import './modules/clone';
import './modules/reload';
import './modules/export';
import './modules/delete-hooks';

export * from './generated/index';
