export class PermissionsError extends Error {}

export class ImplementationError extends Error {
  constructor(name) {
    super();
    this.name = name;
  }
}

export class ReferenceError extends Error {
  constructor(message, references) {
    super(message);
    this.references = references;
  }
}
