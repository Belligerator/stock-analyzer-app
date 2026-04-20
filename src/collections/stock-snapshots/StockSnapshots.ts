import type { CollectionConfig } from 'payload';
import { beforeValidateSnapshot } from './hooks/beforeValidate';

const authedOnly = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);

export const StockSnapshots: CollectionConfig = {
  slug: 'stock-snapshots',
  labels: {
    singular: 'Snapshot',
    plural: 'Snapshots',
  },
  defaultSort: '-takenAt',
  admin: {
    useAsTitle: 'ticker',
    defaultColumns: ['ticker', 'takenAt', 'label', 'price', 'avgTarget', 'cons'],
    group: 'Data',
    listSearchableFields: ['ticker', 'label'],
  },
  access: {
    read: () => true,
    create: authedOnly,
    update: authedOnly,
    delete: authedOnly,
  },
  hooks: {
    beforeValidate: [beforeValidateSnapshot],
  },
  indexes: [{ fields: ['ticker', 'takenAt'] }],
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Summary',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'stock',
                  type: 'relationship',
                  relationTo: 'stocks',
                  required: true,
                  admin: { width: '40%', description: 'Vyber akcii — metriky se doplní automaticky.' },
                },
                {
                  name: 'ticker',
                  type: 'text',
                  required: true,
                  index: true,
                  admin: {
                    width: '30%',
                    readOnly: true,
                    description: 'Auto-fill z vybrané akcie.',
                  },
                },
                {
                  name: 'takenAt',
                  type: 'date',
                  required: true,
                  admin: {
                    width: '30%',
                    date: { pickerAppearance: 'dayAndTime' },
                    description: 'Default = metricsUpdatedAt ze Stocks (moment, ke kterému se metriky vztahují).',
                  },
                },
              ],
            },
            {
              name: 'label',
              type: 'text',
              admin: { description: 'Krátký popis (např. "před Q2 earnings").' },
            },
            {
              name: 'myPrediction',
              type: 'textarea',
              admin: { rows: 4, description: 'Tvůj vlastní odhad v tomto okamžiku.' },
            },
            {
              name: 'myNote',
              type: 'textarea',
              admin: { rows: 6, description: 'Dodatečný komentář.' },
            },
          ],
        },
        {
          label: 'Frozen metrics',
          description: 'Snapshot hodnot ze Stocks v okamžiku takenAt. Needituj, pokud neopravuješ data.',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'metricsUpdatedAt',
                  type: 'date',
                  admin: {
                    width: '33%',
                    readOnly: true,
                    date: { pickerAppearance: 'dayAndTime' },
                    description: 'Kdy byly metriky naposledy refreshnuté (v době snapshotu).',
                  },
                },
                {
                  name: 'noteUpdatedAt',
                  type: 'date',
                  admin: {
                    width: '33%',
                    readOnly: true,
                    date: { pickerAppearance: 'dayAndTime' },
                    description: 'Kdy byla AI poznámka naposledy vygenerovaná.',
                  },
                },
                {
                  name: 'analystLastActionDate',
                  type: 'date',
                  admin: {
                    width: '34%',
                    readOnly: true,
                    date: { pickerAppearance: 'dayAndTime' },
                    description: 'Nejčerstvější analyst action — proxy pro svěžest odhadů.',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'price', type: 'number', admin: { width: '25%' } },
                { name: 'currency', type: 'text', admin: { width: '25%' } },
                { name: 'pe', type: 'number', admin: { width: '25%' } },
                { name: 'fwdPe', type: 'number', admin: { width: '25%' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'peg', type: 'number', admin: { width: '25%' } },
                { name: 'gain52w', type: 'number', admin: { width: '25%' } },
                { name: 'marketCap', type: 'number', admin: { width: '25%' } },
                { name: 'revenueGrowthYoY', type: 'number', admin: { width: '25%' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'profitMargin', type: 'number', admin: { width: '25%' } },
                { name: 'roe', type: 'number', admin: { width: '25%' } },
                { name: 'debtToEquity', type: 'number', admin: { width: '25%' } },
                { name: 'numAnalysts', type: 'number', admin: { width: '25%' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'avgTarget', type: 'number', admin: { width: '33%' } },
                { name: 'targetHigh', type: 'number', admin: { width: '33%' } },
                { name: 'targetLow', type: 'number', admin: { width: '33%' } },
              ],
            },
            { name: 'cons', type: 'text' },
            {
              name: 'analystBreakdown',
              type: 'group',
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'strongBuy', type: 'number', admin: { width: '20%' } },
                    { name: 'buy', type: 'number', admin: { width: '20%' } },
                    { name: 'hold', type: 'number', admin: { width: '20%' } },
                    { name: 'sell', type: 'number', admin: { width: '20%' } },
                    { name: 'strongSell', type: 'number', admin: { width: '20%' } },
                  ],
                },
              ],
            },
            {
              name: 'sources',
              type: 'array',
              fields: [{ name: 'url', type: 'text' }],
            },
            {
              name: 'note',
              type: 'textarea',
              admin: { rows: 8, description: 'Zamrzlá AI note.' },
            },
            {
              name: 'recentContext',
              type: 'json',
              admin: { description: 'Zamrzlá Yahoo news/insights/upgrades.' },
            },
          ],
        },
      ],
    },
  ],
};
