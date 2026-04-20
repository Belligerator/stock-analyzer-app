import type { CollectionConfig } from 'payload';

const authedOnly = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);

export const Explanations: CollectionConfig = {
  slug: 'explanations',
  labels: {
    singular: 'Explanation',
    plural: 'Explanations',
  },
  admin: {
    hidden: true,
  },
  access: {
    read: () => true,
    create: authedOnly,
    update: authedOnly,
    delete: authedOnly,
  },
  indexes: [{ fields: ['term'], unique: true }],
  fields: [
    {
      name: 'term',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Normalized key: lowercase, bez diakritiky.' },
    },
    {
      name: 'displayTerm',
      type: 'text',
      required: true,
      admin: { description: 'Původní text, jak uživatel označil.' },
    },
    {
      name: 'explanation',
      type: 'textarea',
      required: true,
    },
    {
      name: 'model',
      type: 'text',
      admin: { description: 'Model ID který vysvětlení vygeneroval.' },
    },
  ],
};
