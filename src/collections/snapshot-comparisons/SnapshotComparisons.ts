import type { CollectionConfig } from 'payload';

const authedOnly = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);

export const SnapshotComparisons: CollectionConfig = {
  slug: 'snapshot-comparisons',
  labels: {
    singular: 'Snapshot Comparison',
    plural: 'Snapshot Comparisons',
  },
  defaultSort: '-generatedAt',
  admin: {
    useAsTitle: 'ticker',
    defaultColumns: ['ticker', 'snapshotA', 'snapshotB', 'model', 'generatedAt'],
    group: 'Data',
    description:
      'Cache AI vysvětlení rozdílů mezi dvěma snapshoty. Klíč je dvojice (snapshotA, snapshotB).',
  },
  access: {
    read: () => true,
    create: authedOnly,
    update: authedOnly,
    delete: authedOnly,
  },
  indexes: [{ fields: ['snapshotA', 'snapshotB'], unique: true }],
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'ticker',
          type: 'text',
          required: true,
          index: true,
          admin: { width: '25%' },
        },
        {
          name: 'snapshotA',
          type: 'text',
          required: true,
          admin: { width: '37%', description: 'ID staršího (referenčního) snapshotu.' },
        },
        {
          name: 'snapshotB',
          type: 'text',
          required: true,
          admin: { width: '38%', description: 'ID novějšího (porovnávaného) snapshotu.' },
        },
      ],
    },
    {
      name: 'explanation',
      type: 'textarea',
      required: true,
      admin: { rows: 10, description: 'AI-generované shrnutí změn.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'model',
          type: 'text',
          admin: { width: '50%', description: 'Model ID, který shrnutí vygeneroval.' },
        },
        {
          name: 'generatedAt',
          type: 'date',
          admin: {
            width: '50%',
            readOnly: true,
            date: { pickerAppearance: 'dayAndTime' },
          },
        },
      ],
    },
  ],
};
