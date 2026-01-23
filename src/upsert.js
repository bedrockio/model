export function applyUpsert(schema) {
  // Note: Avoiding the findOneAndUpdate approach here as this
  // will prevent hooks from being run on the document. This
  // means however that we cannot always return a query here
  // as the operations are inherently different.

  schema.static('upsert', async function upsert(query, fields) {
    fields ||= query;

    let doc = await this.findOne(query);

    if (doc) {
      doc.assign(fields);
      await doc.save();
      doc.$locals.created = false;
    } else {
      doc = await this.create(fields);
      doc.$locals.created = true;
    }

    return doc;
  });

  schema.static('findOrCreate', async function findOrCreate(query, fields) {
    fields ||= query;

    let doc = await this.findOne(query);

    if (!doc) {
      doc = await this.create(fields);
    }

    return doc;
  });
}
