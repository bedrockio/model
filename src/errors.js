export class PermissionsError extends Error {}
export class ImplementationError extends Error {}

export class ReferenceError extends Error {
  constructor(message, references) {
    super(message);
    this.references = references;
  }
}
