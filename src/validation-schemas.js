import yd from '@bedrockio/yada';

const DATE_TAGS = {
  'x-schema': 'DateTime',
  'x-description':
    'A `string` in [ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html) format.',
};

export const DATE_SCHEMA = yd.date().iso().tag(DATE_TAGS);

export const OBJECT_ID_SCHEMA = yd
  .string()
  .mongo()
  .message('Must be a valid object id.')
  .tag({
    'x-schema': 'ObjectId',
    'x-description':
      'A 24 character hexadecimal string representing a Mongo [ObjectId](https://bit.ly/3YPtGlU).',
  });

export const NUMBER_RANGE_SCHEMA = yd
  .object({
    lt: yd.number().description('Select values less than.'),
    gt: yd.number().description('Select values greater than.'),
    lte: yd.number().description('Select values less than or equal.'),
    gte: yd.number().description('Select values greater than or equal.'),
  })
  .tag({
    'x-schema': 'NumberRange',
    'x-description': 'An object representing numbers falling within a range.',
  });

export const STRING_RANGE_SCHEMA = yd
  .object({
    lt: yd.string().description('Select values less than.'),
    gt: yd.string().description('Select values greater than.'),
    lte: yd.string().description('Select values less than or equal.'),
    gte: yd.string().description('Select values greater than or equal.'),
  })
  .tag({
    'x-schema': 'StringRange',
    'x-description': 'An object representing strings falling within a range.',
  });

export const DATE_RANGE_SCHEMA = yd
  .object({
    lt: yd
      .date()
      .iso()
      .tag({
        ...DATE_TAGS,
        description: 'Select dates occurring before.',
      }),
    gt: yd
      .date()
      .iso()
      .tag({
        ...DATE_TAGS,
        description: 'Select dates occurring after.',
      }),
    lte: yd
      .date()
      .iso()
      .tag({
        ...DATE_TAGS,
        description: 'Select dates occurring on or before.',
      }),
    gte: yd
      .date()
      .iso()
      .tag({
        ...DATE_TAGS,
        description: 'Select dates occurring on or after.',
      }),
  })
  .tag({
    'x-schema': 'DateRange',
    'x-description': 'An object representing dates falling within a range.',
  });

export const REFERENCE_SCHEMA = yd
  .allow(
    OBJECT_ID_SCHEMA,
    yd
      .object({
        id: OBJECT_ID_SCHEMA.required(),
      })
      .options({
        stripUnknown: true,
      })
      .custom((obj) => {
        return obj.id;
      }),
  )
  .message('Must be an id or object containing an "id" field.')
  .tag({
    'x-schema': 'Reference',
    'x-description': `
A 24 character hexadecimal string representing a Mongo [ObjectId](https://bit.ly/3YPtGlU).
An object with an \`id\` field may also be passed, which will be converted into a string.
    `.trim(),
  });

export const INCLUDE_FIELD_SCHEMA = yd.object({
  include: yd.allow(yd.string(), yd.array(yd.string())).tag({
    'x-schema': 'Includes',
    'x-description':
      'A `string` or `array` of fields to be selected or populated using [includes syntax](http://bit.ly/4q2viXl).',
  }),
});
