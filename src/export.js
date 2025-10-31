import { set } from 'lodash';

export function applyExport(schema) {
  schema.method('export', function () {
    const result = {};
    this.constructor.schema.eachPath((schemaPath) => {
      const value = this.get(schemaPath);
      if (value !== undefined) {
        set(result, schemaPath, value);
      }
    });
    return result;
  });
}
