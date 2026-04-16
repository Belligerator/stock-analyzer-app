export type Consensus = "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";

export type Currency = "USD" | "EUR";

export interface Stock {
  ticker: string;
  name: string;
  sector: string;
  currency: Currency;
  price: number;
  pe: number | null;
  fwdPe: number | null;
  gain52w: number | null;
  avgTarget: number | null;
  cons: Consensus;
  note?: string;
  sources?: string[];
  updatedAt?: string;
}

export interface StocksDataset {
  dataAsOf: string;
  sources: string[];
  disclaimer?: string;
  stocks: Stock[];
}
