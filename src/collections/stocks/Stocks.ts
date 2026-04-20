import type { CollectionConfig } from 'payload';
import { afterChangeStock } from './hooks/afterChange';
import { beforeValidateStock } from './hooks/beforeValidate';

const authedOnly = ({ req }: { req: { user?: unknown } }) => Boolean(req.user);

export const Stocks: CollectionConfig = {
  slug: 'stocks',
  labels: {
    singular: 'Stock',
    plural: 'Stocks',
  },
  defaultSort: 'ticker',
  admin: {
    useAsTitle: 'ticker',
    defaultColumns: ['ticker', 'name', 'sector', 'price', 'cons', 'metricsUpdatedAt'],
    group: 'Data',
    components: {
      edit: {
        beforeDocumentControls: ['/components/admin/RefreshStockButton#RefreshStockButton'],
      },
      beforeListTable: ['/components/admin/BulkRefreshButtons#BulkRefreshButtons'],
    },
  },
  access: {
    read: () => true,
    create: authedOnly,
    update: authedOnly,
    delete: authedOnly,
  },
  hooks: {
    beforeValidate: [beforeValidateStock],
    afterChange: [afterChangeStock],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Identification',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'ticker',
                  type: 'text',
                  required: true,
                  unique: true,
                  index: true,
                  admin: {
                    width: '25%',
                    description: 'App-level ticker (e.g. DSY, NVDA).',
                    components: {
                      Field: '/components/admin/TickerAutocomplete#TickerAutocomplete',
                    },
                  },
                },
                {
                  name: 'yahooSymbol',
                  type: 'text',
                  admin: {
                    width: '25%',
                    description:
                      'Yahoo symbol override (např. DSY.PA). Můžeš vložit i celou URL, např. https://finance.yahoo.com/quote/FF/ — symbol se vytáhne.',
                  },
                },
                {
                  name: 'currency',
                  type: 'select',
                  required: true,
                  defaultValue: 'USD',
                  options: [
                    { label: 'USD', value: 'USD' },
                    { label: 'EUR', value: 'EUR' },
                  ],
                  admin: { width: '25%' },
                },
                {
                  name: 'active',
                  type: 'checkbox',
                  defaultValue: true,
                  admin: {
                    width: '25%',
                    description: 'Include in daily refresh cron.',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'name',
                  type: 'text',
                  admin: {
                    width: '60%',
                    description: 'Automaticky doplněno z Yahoo. Lze přepsat.',
                  },
                },
                {
                  name: 'sector',
                  type: 'text',
                  admin: {
                    width: '40%',
                    description: 'Automaticky doplněno z Yahoo.',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Metrics',
          description:
            'Populated automatically by the daily refresh cron. Manual edits will be overwritten on the next run.',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'price', type: 'number', admin: { width: '25%' } },
                { name: 'pe', type: 'number', admin: { width: '25%', description: 'Trailing P/E' } },
                { name: 'fwdPe', type: 'number', admin: { width: '25%', description: 'Forward P/E' } },
                { name: 'peg', type: 'number', admin: { width: '25%' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'gain52w', type: 'number', admin: { width: '25%', description: '52-week change (%)' } },
                { name: 'marketCap', type: 'number', admin: { width: '25%', description: 'USD billions' } },
                { name: 'revenueGrowthYoY', type: 'number', admin: { width: '25%', description: '%' } },
                { name: 'profitMargin', type: 'number', admin: { width: '25%', description: '%' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'roe', type: 'number', admin: { width: '50%', description: 'Return on Equity (%)' } },
                { name: 'debtToEquity', type: 'number', admin: { width: '50%' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'avgTarget', type: 'number', admin: { width: '25%', description: 'Median analyst target' } },
                { name: 'targetHigh', type: 'number', admin: { width: '25%' } },
                { name: 'targetLow', type: 'number', admin: { width: '25%' } },
                { name: 'numAnalysts', type: 'number', admin: { width: '25%' } },
              ],
            },
            {
              name: 'cons',
              type: 'select',
              defaultValue: 'Hold',
              options: [
                { label: 'Strong Buy', value: 'Strong Buy' },
                { label: 'Buy', value: 'Buy' },
                { label: 'Hold', value: 'Hold' },
                { label: 'Sell', value: 'Sell' },
                { label: 'Strong Sell', value: 'Strong Sell' },
              ],
            },
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
              name: 'metricsUpdatedAt',
              type: 'date',
              admin: {
                readOnly: true,
                description: 'Last successful metric refresh.',
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
            {
              name: 'lastFetchError',
              type: 'textarea',
              admin: {
                readOnly: true,
                description: 'Last fetch error message, if any.',
              },
            },
            {
              name: 'recentContext',
              type: 'json',
              admin: {
                readOnly: true,
                description:
                  'Yahoo news, insights, research reports, upgrades. Populated by daily refresh. Read by AI note pipeline.',
              },
            },
          ],
        },
        {
          label: 'AI Note',
          fields: [
            {
              name: 'notePreview',
              type: 'ui',
              admin: {
                components: {
                  Field: '/components/admin/NotePreview#NotePreview',
                },
              },
            },
            {
              name: 'note',
              type: 'textarea',
              admin: { rows: 8, description: 'Generated by AI enrichment cron. Editable manually.' },
            },
            {
              name: 'noteUpdatedAt',
              type: 'date',
              admin: {
                readOnly: true,
                description: 'Last AI note generation.',
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
          ],
        },
      ],
    },
  ],
};
