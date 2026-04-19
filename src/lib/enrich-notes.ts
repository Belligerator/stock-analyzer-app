import type Anthropic from '@anthropic-ai/sdk';
import { getPayload, type Where } from 'payload';
import config from '@payload-config';
import type { RecentContext } from '@/types/stocks';
import { mapStockDoc } from './stock-mapper';
import {
  MODEL_TRIGGER,
  addUsage,
  formatUsd,
  getAnthropicClient,
  getModelConfig,
  usageStats,
  zeroUsage,
  type Priority,
  type UsageStats,
} from './anthropic';

const TRIGGER_MAX_TOKENS = 4000;
const ANALYSIS_MAX_TOKENS = 1500;

export type TriggerResult = {
  ticker: string;
  priority: Priority;
  reason: string;
};

export type AnalysisResult = {
  ticker: string;
  priority: Exclude<Priority, 'skip'>;
  model: string;
  note: string;
  usage: UsageStats;
};

export type EnrichResult = {
  ticker: string;
  status: 'updated' | 'skipped' | 'pre-skipped' | 'error';
  priority?: Priority;
  model?: string;
  usage?: UsageStats;
  durationMs?: number;
  error?: string;
  reason?: string;
};

export type EnrichSummary = {
  total: number;
  preSkipped: number;
  triaged: number;
  triggered: number;
  skipped: number;
  normalCount: number;
  highCount: number;
  updated: number;
  failed: number;
  triggerUsage: UsageStats;
  analysisUsage: UsageStats;
  totalUsage: UsageStats;
  results: EnrichResult[];
  generatedAt: string;
  durationMs: number;
};

/**
 * True if recentContext has at least one source newer than noteUpdatedAt.
 * False = all sources stale, skip AI call entirely.
 *
 * Conservative: returns true (= include in analysis) when uncertain:
 * - no noteUpdatedAt (never analyzed)
 * - no recentContext (Yahoo fetch may have failed)
 * - empty recentContext arrays (no source data at all)
 */
export function hasFreshSources(
  ctx: RecentContext | null | undefined,
  noteUpdatedAt: string | null | undefined
): boolean {
  if (!noteUpdatedAt) return true;
  if (!ctx) return true;

  const noteTime = new Date(noteUpdatedAt).getTime();
  if (!Number.isFinite(noteTime)) return true;

  const sourceTimes: number[] = [];
  for (const n of ctx.news ?? []) {
    const t = new Date(n.publishedAt).getTime();
    if (Number.isFinite(t)) sourceTimes.push(t);
  }
  for (const s of ctx.sigDevs ?? []) {
    const t = new Date(s.date).getTime();
    if (Number.isFinite(t)) sourceTimes.push(t);
  }
  for (const u of ctx.upgrades ?? []) {
    const t = new Date(u.date).getTime();
    if (Number.isFinite(t)) sourceTimes.push(t);
  }
  for (const r of ctx.researchReports ?? []) {
    const t = new Date(r.reportDate).getTime();
    if (Number.isFinite(t)) sourceTimes.push(t);
  }

  if (sourceTimes.length === 0) return true;

  return Math.max(...sourceTimes) > noteTime;
}

const TRIGGER_SYSTEM_PROMPT = `Jsi finanční triage agent. Dostaneš dataset akcií (metriky + recent Yahoo context) a rozhoduješ, které vyžadují hlubokou AI analýzu a v jaké prioritě.

# Výstup
Vrať POUZE validní JSON array, bez markdown, bez komentáře:
[{"ticker":"XXX","priority":"skip|normal|high","reason":"stručné odůvodnění v češtině"}]

# Priority

- **skip** — metriky stabilní, žádný material event, nic pozoruhodného
- **normal** — jedna anomálie v metrikách (vysoké P/E, slabý růst, ...), minor news, rating change, upgrade/downgrade
- **high** — major event: M&A (akvizice, spin-off), earnings beat/miss s material revize, lawsuit, CEO change, regulatory action, extreme metric kombo (2+ anomálie současně), recent 10-Q/10-K s významnou změnou metrik

# Clickbait mitigation
News headlines jsou často clickbait. NEROZHODUJ jen podle headline — kombinuj VŽDY s metrikami. Pokud headline říká něco dramatického ale metriky to nepotvrzují, je to spíš skip/normal než high. researchReports[].contentText (analyst report content) je důvěryhodnější než news titles.

# Research reports
Pokud researchReports.contentText nebo sigDevs zmiňují recent 10-Q/10-K/earnings call s material změnou metrik → flaguj high.

# Dataset
Každý ticker má:
- metrics (ticker, name, sector, cena, P/E, fwd P/E, gain52w, market cap, revenue growth, margin, ROE, D/E, PEG, target, cons rating)
- recentContext: { news[], sigDevs[], researchReports[] s contentText, upgrades[], recommendation, nextEarnings }`;

const ANALYSIS_SYSTEM_PROMPT = `Jsi finanční analytik. Dostaneš metriky + recent context jedné akcie a důvod proč byla flagnuta. Napiš kvalitativní poznámku v češtině (3–5 vět) se zdrojem + datumem u každého faktu.

# Pravidla
1. **Rozepiš se.** Raději 3–5 vět s plným kontextem než jedna zkratkovitá. U události popiš: co, kdy, proč ovlivňuje konkrétní metriku, jestli se to časem vyrovná.
2. **Nepřejímej headlines jako fakt** — titulky bývají clickbait. Pokud headline zní dramaticky ale metriky to nepotvrzují, buď skeptický. Ověřuj přes web_fetch URL z recentContext.news[].link nebo přes web_search.
3. **Hierarchie spolehlivosti zdrojů (od nejspolehlivější):**
   1. recentContext.researchReports[].contentText (analyst reports)
   2. quoteSummary data (upgrades, recommendation)
   3. web_search results
   4. web_fetch konkrétního článku z news[].link (když title je vágní)
   5. headlines (news[].title, sigDevs[].headline) — JEN jako signal, nikdy jako fakt
4. **Tools používej uvážlivě** — web_search jen pokud chybí konkrétní fakt (datum, částka, jméno dealu). Web_fetch jen pokud je nutné ověřit title. NIKDY nefetchuj full 10-K / 10-Q / annual report.
5. **Zdroj a datum** vždy u každého faktu. Formát: "(zdroj: Broadcom 10-K, FY2024)", "(Reuters, únor 2026)".
6. **Pouze fakta a kontext** — žádné "buy", "sell", "great opportunity".
7. **Cílová skupina**: smíšená (laik + zkušený investor). Obecné pojmy (P/E, margin) nevysvětluj, ale VŽDY vysvětli důsledek události pro konkrétní metriku.
8. **Pokud nic konkrétního nevíš a data nejsou anomální** → vrať prázdný string "". Ale pokud data ukazují anomálii a konkrétní důvod neznáš, přesto napiš poznámku ("D/E 2.3 bez specifického známého katalyzátoru; stojí za dohledání").

# Výstup
Vrať POUZE čistý text poznámky (3–5 vět). Žádný JSON, žádný markdown, žádné uvozovky kolem, žádný úvod typu "Zde je poznámka:". Pokud se opravdu nemáš co kvalifikovaného říct, vrať prázdný string.`;

function extractJsonArray(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1] : text;
  const first = candidate.indexOf('[');
  const last = candidate.lastIndexOf(']');
  if (first === -1 || last === -1) throw new Error('No JSON array in response');
  return candidate.slice(first, last + 1);
}

function validateTriggerResults(
  arr: unknown,
  validTickers: Set<string>
): TriggerResult[] {
  if (!Array.isArray(arr)) throw new Error('Trigger output is not an array');
  const out: TriggerResult[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const o = item as { ticker?: unknown; priority?: unknown; reason?: unknown };
    if (typeof o.ticker !== 'string' || !validTickers.has(o.ticker)) continue;
    if (o.priority !== 'skip' && o.priority !== 'normal' && o.priority !== 'high') continue;
    out.push({
      ticker: o.ticker,
      priority: o.priority,
      reason: typeof o.reason === 'string' ? o.reason : '',
    });
  }
  return out;
}

function extractText(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();
}

function cleanNoteOutput(raw: string): string {
  let text = raw.trim();
  const fenceMatch = text.match(/^```(?:\w+)?\s*([\s\S]*?)```$/);
  if (fenceMatch) text = fenceMatch[1].trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('„') && text.endsWith('"'))) {
    text = text.slice(1, -1).trim();
  }
  text = text.replace(/<\/?cite\b[^>]*>/gi, '');
  text = text.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  return text;
}

function buildTriagePayload(
  stocks: Array<{ viewModel: ReturnType<typeof mapStockDoc>; recentContext: RecentContext | null }>
): string {
  return JSON.stringify(
    {
      dataAsOf: new Date().toISOString().slice(0, 10),
      stocks: stocks.map(({ viewModel, recentContext }) => ({
        ticker: viewModel.ticker,
        name: viewModel.name,
        sector: viewModel.sector,
        metrics: {
          price: viewModel.price,
          pe: viewModel.pe,
          fwdPe: viewModel.fwdPe,
          gain52w: viewModel.gain52w,
          marketCap: viewModel.marketCap,
          revenueGrowthYoY: viewModel.revenueGrowthYoY,
          profitMargin: viewModel.profitMargin,
          roe: viewModel.roe,
          debtToEquity: viewModel.debtToEquity,
          peg: viewModel.peg,
          avgTarget: viewModel.avgTarget,
          targetHigh: viewModel.targetHigh,
          targetLow: viewModel.targetLow,
          cons: viewModel.cons,
          numAnalysts: viewModel.numAnalysts,
        },
        recentContext,
      })),
    },
    null,
    2
  );
}

type EnrichedStock = {
  id: string | number;
  ticker: string;
  noteUpdatedAt: string | null;
  recentContext: RecentContext | null;
  viewModel: ReturnType<typeof mapStockDoc>;
};

async function loadStocksForPipeline(options: { tickers?: string[] }): Promise<EnrichedStock[]> {
  const payload = await getPayload({ config });
  const where: Where = options.tickers
    ? { ticker: { in: options.tickers } }
    : { active: { equals: true } };

  const { docs } = await payload.find({
    collection: 'stocks',
    where,
    limit: 500,
    depth: 0,
  });

  return docs.map(doc => ({
    id: doc.id as string | number,
    ticker: doc.ticker as string,
    noteUpdatedAt: ((doc as { noteUpdatedAt?: string | null }).noteUpdatedAt ?? null) as
      | string
      | null,
    recentContext: ((doc as { recentContext?: RecentContext | null }).recentContext ?? null) as
      | RecentContext
      | null,
    viewModel: mapStockDoc(doc as unknown as Parameters<typeof mapStockDoc>[0]),
  }));
}

export async function detectTriggers(
  enriched: EnrichedStock[]
): Promise<{
  triggers: TriggerResult[];
  usage: UsageStats;
}> {
  if (enriched.length === 0) {
    return { triggers: [], usage: { ...zeroUsage } };
  }

  const validTickers = new Set(enriched.map(e => e.viewModel.ticker));

  console.log(
    `[enrich-notes] stage 1 triage start: ${enriched.length} tickers, model=${MODEL_TRIGGER}`
  );
  const stageStart = Date.now();

  const userMessage = `Dataset:\n\n${buildTriagePayload(enriched)}`;

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: MODEL_TRIGGER,
    max_tokens: TRIGGER_MAX_TOKENS,
    system: TRIGGER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = extractText(response);
  const parsed = JSON.parse(extractJsonArray(text));
  const triggers = validateTriggerResults(parsed, validTickers);
  const usage = usageStats(MODEL_TRIGGER, response.usage);

  const skipCount = triggers.filter(t => t.priority === 'skip').length;
  const normalCount = triggers.filter(t => t.priority === 'normal').length;
  const highCount = triggers.filter(t => t.priority === 'high').length;
  console.log(
    `[enrich-notes] stage 1 done in ${Date.now() - stageStart}ms: ${skipCount} skip, ${normalCount} normal, ${highCount} high, ${usage.inputTokens}/${usage.outputTokens} tokens in/out, ${formatUsd(usage.costUsd)}`
  );

  return { triggers, usage };
}

function buildAnalysisUserMessage(
  stock: ReturnType<typeof mapStockDoc>,
  recentContext: RecentContext | null,
  trigger: TriggerResult
): string {
  return JSON.stringify(
    {
      ticker: stock.ticker,
      name: stock.name,
      sector: stock.sector,
      currency: stock.currency,
      metrics: {
        price: stock.price,
        pe: stock.pe,
        fwdPe: stock.fwdPe,
        gain52w: stock.gain52w,
        marketCap: stock.marketCap,
        revenueGrowthYoY: stock.revenueGrowthYoY,
        profitMargin: stock.profitMargin,
        roe: stock.roe,
        debtToEquity: stock.debtToEquity,
        peg: stock.peg,
        avgTarget: stock.avgTarget,
        targetHigh: stock.targetHigh,
        targetLow: stock.targetLow,
        cons: stock.cons,
        numAnalysts: stock.numAnalysts,
      },
      recentContext,
      trigger: { priority: trigger.priority, reason: trigger.reason },
    },
    null,
    2
  );
}

export async function analyzeTicker(
  stock: ReturnType<typeof mapStockDoc>,
  recentContext: RecentContext | null,
  trigger: TriggerResult
): Promise<AnalysisResult | null> {
  if (trigger.priority === 'skip') return null;

  const cfg = getModelConfig(trigger.priority);

  const tools: Anthropic.Messages.ToolUnion[] = [];
  if (cfg.webSearchMax > 0) {
    tools.push({
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: cfg.webSearchMax,
    } as unknown as Anthropic.Messages.ToolUnion);
  }
  if (cfg.webFetchMax > 0) {
    tools.push({
      type: 'web_fetch_20250910',
      name: 'web_fetch',
      max_uses: cfg.webFetchMax,
      max_content_tokens: cfg.webFetchContentTokens,
      citations: { enabled: true },
    } as unknown as Anthropic.Messages.ToolUnion);
  }

  const userMessage = buildAnalysisUserMessage(stock, recentContext, trigger);

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: cfg.model,
    max_tokens: ANALYSIS_MAX_TOKENS,
    system: ANALYSIS_SYSTEM_PROMPT,
    ...(tools.length > 0 ? { tools } : {}),
    messages: [{ role: 'user', content: userMessage }],
  });

  const note = cleanNoteOutput(extractText(response));
  const usage = usageStats(cfg.model, response.usage);

  return {
    ticker: stock.ticker,
    priority: trigger.priority,
    model: cfg.model,
    note,
    usage,
  };
}

export async function enrichNotes(
  options: { tickers?: string[] } = {}
): Promise<EnrichSummary> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const start = Date.now();
  const payload = await getPayload({ config });

  console.log(
    `[enrich-notes] pipeline start${options.tickers ? ` for ${options.tickers.join(',')}` : ' (all active)'}`
  );

  const loaded = await loadStocksForPipeline(options);

  const preSkippedResults: EnrichResult[] = [];
  const freshStocks: EnrichedStock[] = [];
  for (const stock of loaded) {
    if (hasFreshSources(stock.recentContext, stock.noteUpdatedAt)) {
      freshStocks.push(stock);
    } else {
      preSkippedResults.push({
        ticker: stock.ticker,
        status: 'pre-skipped',
        reason: 'všechny zdroje starší než noteUpdatedAt',
      });
      console.log(
        `[enrich-notes]   ${stock.ticker} pre-skipped (sources older than last note ${stock.noteUpdatedAt})`
      );
    }
  }
  console.log(
    `[enrich-notes] pre-filter: ${loaded.length} loaded -> ${preSkippedResults.length} pre-skipped (stale sources), ${freshStocks.length} to triage`
  );

  const { triggers, usage: triggerUsage } = await detectTriggers(freshStocks);

  const stockDocsById = new Map<string, EnrichedStock>();
  for (const stock of loaded) {
    stockDocsById.set(stock.ticker, stock);
  }

  const results: EnrichResult[] = [...preSkippedResults];
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  let normalCount = 0;
  let highCount = 0;
  let analysisUsage: UsageStats = { ...zeroUsage };
  const updatedAtIso = new Date().toISOString();

  for (const trigger of triggers) {
    if (trigger.priority === 'skip') {
      skipped++;
      results.push({
        ticker: trigger.ticker,
        status: 'skipped',
        priority: 'skip',
      });
      continue;
    }

    const doc = stockDocsById.get(trigger.ticker);
    if (!doc) {
      failed++;
      console.log(`[enrich-notes]   ${trigger.ticker} ERROR: ticker not found in DB`);
      results.push({
        ticker: trigger.ticker,
        status: 'error',
        error: 'ticker not found in DB',
      });
      continue;
    }

    if (trigger.priority === 'high') highCount++;
    else normalCount++;

    const tickerStart = Date.now();
    try {
      console.log(`[enrich-notes]   ${trigger.ticker} ${trigger.priority} analysis start`);
      const analysis = await analyzeTicker(doc.viewModel, doc.recentContext, trigger);
      const tickerMs = Date.now() - tickerStart;
      if (!analysis || !analysis.note) {
        skipped++;
        console.log(
          `[enrich-notes]   ${trigger.ticker} ${trigger.priority} empty note in ${tickerMs}ms`
        );
        results.push({
          ticker: trigger.ticker,
          status: 'skipped',
          priority: trigger.priority,
          durationMs: tickerMs,
          error: 'empty note returned',
        });
        continue;
      }
      await payload.update({
        collection: 'stocks',
        id: doc.id,
        data: { note: analysis.note, noteUpdatedAt: updatedAtIso },
      });
      analysisUsage = addUsage(analysisUsage, analysis.usage);
      updated++;
      console.log(
        `[enrich-notes]   ${trigger.ticker} ${trigger.priority} -> ${analysis.model} ` +
          `${analysis.usage.inputTokens}/${analysis.usage.outputTokens} in/out, ` +
          `${analysis.usage.webSearchRequests}s/${analysis.usage.webFetchRequests}f, ` +
          `${formatUsd(analysis.usage.costUsd)} in ${tickerMs}ms`
      );
      results.push({
        ticker: trigger.ticker,
        status: 'updated',
        priority: trigger.priority,
        model: analysis.model,
        usage: analysis.usage,
        durationMs: tickerMs,
      });
    } catch (err) {
      failed++;
      const tickerMs = Date.now() - tickerStart;
      const message = err instanceof Error ? err.message : String(err);
      console.log(
        `[enrich-notes]   ${trigger.ticker} ${trigger.priority} ERROR in ${tickerMs}ms: ${message}`
      );
      results.push({
        ticker: trigger.ticker,
        status: 'error',
        priority: trigger.priority,
        durationMs: tickerMs,
        error: message,
      });
    }
  }

  const totalUsage = addUsage(triggerUsage, analysisUsage);
  const durationMs = Date.now() - start;

  console.log(
    `[enrich-notes] pipeline done in ${durationMs}ms: ${updated} updated, ${skipped} skipped, ${preSkippedResults.length} pre-skipped, ${failed} failed`
  );
  console.log(
    `[enrich-notes] tokens total: ${totalUsage.inputTokens} in / ${totalUsage.outputTokens} out / ${totalUsage.cacheReadTokens} cached / ${totalUsage.webSearchRequests} searches / ${totalUsage.webFetchRequests} fetches`
  );
  console.log(
    `[enrich-notes] cost total: ${formatUsd(totalUsage.costUsd)} (triage ${formatUsd(triggerUsage.costUsd)} + analysis ${formatUsd(analysisUsage.costUsd)})`
  );

  return {
    total: loaded.length,
    preSkipped: preSkippedResults.length,
    triaged: freshStocks.length,
    triggered: normalCount + highCount,
    skipped,
    normalCount,
    highCount,
    updated,
    failed,
    triggerUsage,
    analysisUsage,
    totalUsage,
    results,
    generatedAt: updatedAtIso,
    durationMs,
  };
}
