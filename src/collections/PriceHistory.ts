import type { CollectionConfig } from 'payload';

const authedOnly = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);

export const PriceHistory: CollectionConfig = {
  slug: 'price-history',
  labels: {
    singular: 'Price history row',
    plural: 'Price history',
  },
  defaultSort: '-date',
  admin: {
    hidden: true,
  },
  access: {
    read: () => true,
    create: authedOnly,
    update: authedOnly,
    delete: authedOnly,
  },
  indexes: [
    { fields: ['ticker', 'date', 'interval'], unique: true },
    { fields: ['ticker', 'interval', 'date'] },
  ],
  fields: [
    {
      name: 'ticker',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'interval',
      type: 'select',
      required: true,
      options: [
        { label: 'Daily', value: 'daily' },
        { label: 'Weekly', value: 'weekly' },
      ],
    },
    {
      name: 'date',
      type: 'text',
      required: true,
      admin: { description: 'ISO date YYYY-MM-DD' },
    },
    {
      name: 'close',
      type: 'number',
      required: true,
    },
  ],
};
