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
  marketCap?: number | null;
  revenueGrowthYoY?: number | null;
  profitMargin?: number | null;
  roe?: number | null;
  debtToEquity?: number | null;
  peg?: number | null;
  targetHigh?: number | null;
  targetLow?: number | null;
  numAnalysts?: number | null;
  analystBreakdown?: {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  } | null;
  note?: string;
  sources?: string[];
  newsSources?: Array<{
    title: string;
    publisher: string;
    link: string;
    publishedAt: string;
  }>;
  updatedAt?: string;
}

export interface StocksDataset {
  dataAsOf: string;
  sources: string[];
  disclaimer?: string;
  stocks: Stock[];
}

export interface NotesFile {
  generatedAt: string | null;
  notes: Record<string, string>;
}

export interface RecentContextNews {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
}

export interface RecentContextSigDev {
  headline: string;
  date: string;
}

export interface RecentContextResearchReport {
  title: string;
  provider: string;
  investmentRating: string | null;
  targetPrice: number | null;
  reportDate: string;
  contentText: string;
}

export interface RecentContextUpgrade {
  firm: string;
  action: string;
  fromGrade: string;
  toGrade: string;
  date: string;
}

export interface RecentContextRecommendation {
  rating: string;
  targetPrice: number | null;
  provider: string;
}

export interface RecentContext {
  news: RecentContextNews[];
  sigDevs: RecentContextSigDev[];
  researchReports: RecentContextResearchReport[];
  upgrades: RecentContextUpgrade[];
  recommendation: RecentContextRecommendation | null;
  nextEarnings: string | null;
  fetchedAt: string;
}
