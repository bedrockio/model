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
    this.details = {
      references: references.map((obj) => {
        const { count, ids, model } = obj;
        return {
          ids,
          model: model.modelName,
          count,
        };
      }),
    };
  }
}
