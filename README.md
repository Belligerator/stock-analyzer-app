# Stock Analyzer

Next.js + Payload 3 + Neon Postgres. Veřejný dashboard na `/`, admin UI na `/admin`, REST API na `/api/*`. Scheduled cron běží na GitHub Actions (free, žádný Vercel Pro plán), který přes HTTP volá chráněný endpoint na Vercelu.

- **Data** pro metriky akcií tahá [`yahoo-finance2`](https://www.npmjs.com/package/yahoo-finance2) (Node port Python `yfinance`). Denně se stahují i news, insights a research reports → uloženo jako `recentContext` na každém tickeru.
- **AI poznámky** generuje **3-stage pipeline**: Haiku triage → routed Sonnet (normal) / Opus (high priority) s web_search + web_fetch. Yahoo `recentContext` slouží jako primární zdroj → web_search jen když chybí fakt, web_fetch jen když titulek je vágní. Drží cost nízko a kvalitu vysoko.
- **Cron**: GitHub Actions scheduled workflow pošle `curl` s bearer tokenem na `/api/cron/*`. Neon nemusí být publicky dostupná.
- **Admin UI**: přidávat/mazat tickery, per-ticker manuální refresh v editaci akcie, nebo `workflow_dispatch` v GH Actions pro globální refresh.

## Stack

| Vrstva | Technologie |
|---|---|
| Framework | Next.js 16 (App Router) |
| CMS / admin | Payload 3 namountované na `/admin` |
| DB | Neon Postgres (`@payloadcms/db-postgres`) |
| Scraper | `yahoo-finance2` v3 |
| AI | `@anthropic-ai/sdk` — Haiku 4.5 (triage) + Sonnet 4.6 (normal) + Opus 4.7 (high priority), s `web_search_20250305` + `web_fetch_20250910` |
| Cron | GitHub Actions (schedule + workflow_dispatch) |
| Deploy | Vercel (Hobby plán stačí) |

## Požadavky

- Node.js ≥ 20.9
- Neon Postgres databáze (nebo jakýkoli Postgres 14+)
- Anthropic API klíč
- GitHub repo (pro scheduled cron jobs)

## Lokální vývoj

1. Instalace:
   ```bash
   npm install
   ```

2. Env:
   ```bash
   cp .env.example .env
   # vyplň DATABASE_URL (Neon pooled), PAYLOAD_SECRET, ANTHROPIC_API_KEY, CRON_SECRET
   ```

3. Dev server:
   ```bash
   npm run dev
   ```
   Otevři [http://localhost:3000/admin](http://localhost:3000/admin), vytvoř prvního admin uživatele.

4. Seed z existujících JSON souborů (21 tickerů + AI poznámky):
   ```bash
   npm run seed
   ```

5. Frontend na [http://localhost:3000](http://localhost:3000).

### Payload importMap

Payload 3 potřebuje importMap všech custom admin komponent. Kdykoli přidáš/změníš custom component referenci v kolekci (např. `beforeDocumentControls`), spusť:

```bash
npm run generate:importmap
```

Bez toho uvidíš v adminu chybu `getFromImportMap: PayloadComponent not found`.

### Lokální test cron endpointů

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/refresh-stocks
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/refresh-notes
```

## Cron (GitHub Actions → Vercel)

Dva workflow soubory v [.github/workflows/](.github/workflows/):

| Workflow | Schedule (UTC) | Endpoint | Co dělá |
|---|---|---|---|
| `refresh-stocks.yml` | denně 03:00 | `/api/cron/refresh-stocks` | yahoo-finance2 metriky pro všechny active tickery |
| `refresh-notes.yml` | sobota 06:00 | `/api/cron/refresh-notes` | Claude + web search regeneruje AI poznámky |

Oba mají `workflow_dispatch` — v **GitHub Actions → workflow → Run workflow** je spustíš ručně kdykoli.

### Co workflow dělá

Jenom pošle `curl` na Vercel endpoint s bearer tokenem:

```bash
curl -sS --max-time 300 \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://<tvoje-app>.vercel.app/api/cron/refresh-stocks"
```

Vercel endpoint provede refresh a vrátí JSON summary. Žádný Node build na GH runneru, žádný DB přístup mimo Vercel.

### GitHub secrets

Nastav v **Repo Settings → Secrets and variables → Actions**:

| Secret | Hodnota |
|---|---|
| `VERCEL_URL` | `https://<tvoje-app>.vercel.app` (bez trailing slashe) |
| `CRON_SECRET` | stejný random string jako v Vercel env varu |

Žádný `DATABASE_URL`, `ANTHROPIC_API_KEY` ani `PAYLOAD_SECRET` — ty zná jen Vercel.

### Proč GitHub Actions místo Vercel Cron

Vercel Cron vyžaduje Pro plán pro frekvenci > 1×/den a stabilní běh. GH Actions scheduled cron je zdarma, funguje i na privátních repech, a stejně nakonec jen volá Vercel endpoint — tj. žádný rozdíl pro příjemce.

## Admin UI — manuální akce

V Payload adminu na detailu každé akcie jsou dvě tlačítka:
- **Refresh metrics** → POST `/api/actions/refresh-stocks` s `{tickers: ["NVDA"]}`
- **Regenerate AI note** → POST `/api/actions/refresh-notes` s `{tickers: ["NVDA"]}`

Endpointy `/api/actions/*` vyžadují přihlášeného Payload uživatele (cookie session). Per-ticker akce se do Vercel Hobby 300 s limitu vejde bez problému.

### Přidání nové akcie

V adminu `/admin/collections/stocks/create` → vyplň `ticker`, `name`, `sector`, `currency`, případně `yahooSymbol` (např. `DSY.PA` pro DSY). Při příštím cronu se metriky doplní automaticky, nebo rovnou klikni **Refresh metrics**.

## Vercel deploy

1. Vytvoř Neon databázi (pooled connection string, SSL enforced). DB nemusí být public — stačí default firewall otevřený pro Vercel IPs, nebo IP allowlist + Vercel static IPs (Pro feature).
2. Na Vercelu importuj repo → framework detekce najde Next.js.
3. Env vars (Project Settings → Environment Variables):
   - `DATABASE_URL`
   - `PAYLOAD_SECRET`
   - `ANTHROPIC_API_KEY`
   - `CRON_SECRET`
4. Po prvním deployi otevři `/admin` a vytvoř admin uživatele.
5. Lokálně `vercel env pull && npm run seed` naimportuje existujících 21 tickerů z `public/data/*.json`.
6. V GitHub repu nastav `VERCEL_URL` a `CRON_SECRET` secrets (viz výše).

## AI pipeline — cost a konfigurace

Týdenní cron `refresh-notes` spouští **3-stage pipeline**:

1. **Stage 1 — Triage (Haiku 4.5, batch, no web search)**. Dostane metriky + `recentContext` (news, sigDevs, researchReports, upgrades) všech aktivních tickerů. Vrátí JSON s priority `skip` / `normal` / `high` per ticker.
2. **Stage 2 — Per-ticker analysis**. Pro non-skip tickery volá Sonnet 4.6 (`normal`) nebo Opus 4.7 (`high`) s `web_search` + `web_fetch` (volitelné). Vrací 3–5 větnou poznámku s citacemi.
3. **Clickbait defense**: prompt explicitně řeší hierarchii zdrojů (research reports > structured data > search > fetch > titulky). `news[].title` sám o sobě není považován za fakt, model ověřuje přes `web_fetch(link)` s `max_content_tokens=5000`.

### Cost per weekly run (odhad)

| Scénář | Haiku triage | Sonnet (normal) | Opus (high) | Total |
|---|---|---|---|---|
| Klidný týden (0 triggerů) | $0.045 | — | — | **~$0.05** |
| Normální (5 normal + 2 high) | $0.045 | $0.42 | $0.47 | **~$0.93** |
| Hektický (10 normal + 5 high) | $0.045 | $0.83 | $1.18 | **~$2.06** |

Pipeline **škáluje s reálnou aktivitou trhu**. Klidné týdny jsou levnější než fixní běh.

### Konfigurace modelů přes env

Všechny volitelné, defaulty v hranatých závorkách:

| Env var | Default | Popis |
|---|---|---|
| `MODEL_TRIGGER` | `claude-haiku-4-5` | Stage 1 triage |
| `MODEL_ANALYZE_NORMAL` | `claude-sonnet-4-6` | Stage 2 pro `normal` prioritu |
| `MODEL_ANALYZE_HIGH` | `claude-opus-4-7` | Stage 2 pro `high` prioritu |
| `WEB_SEARCH_MAX_NORMAL` | `2` | max web search invocations per normal ticker (0 = off) |
| `WEB_SEARCH_MAX_HIGH` | `4` | dtto pro high |
| `WEB_FETCH_MAX_NORMAL` | `1` | max web fetches per normal ticker (0 = off) |
| `WEB_FETCH_MAX_HIGH` | `3` | dtto pro high |
| `WEB_FETCH_CONTENT_TOKENS_NORMAL` | `5000` | token cap na fetched content (normal) |
| `WEB_FETCH_CONTENT_TOKENS_HIGH` | `10000` | dtto pro high |

**Cost knoby**:
- Šetřit: `MODEL_ANALYZE_HIGH=claude-sonnet-4-6` → ~$0.45 per run (místo $0.93)
- Ještě šetřit: `MODEL_ANALYZE_NORMAL=claude-haiku-4-5` → ~$0.20 per run
- Úplné off web searche: `WEB_SEARCH_MAX_NORMAL=0 WEB_SEARCH_MAX_HIGH=0` → jen Yahoo data, ~$0.10

Změna = restart Vercel deploymentu (env var propagation) nebo re-run GH workflow.

## Struktura

```
.github/workflows/
├── refresh-stocks.yml        # schedule + workflow_dispatch → curl Vercel endpoint
└── refresh-notes.yml         # schedule + workflow_dispatch → curl Vercel endpoint

src/
├── app/
│   ├── (frontend)/
│   │   ├── layout.tsx
│   │   ├── page.tsx          # server component — Payload Local API
│   │   └── StockDashboard.tsx # client — filter/modal state
│   └── (payload)/
│       ├── admin/            # Payload admin (/admin)
│       └── api/
│           ├── [...slug]/    # Payload REST catchall
│           ├── graphql/
│           ├── cron/         # bearer auth (volané z GH Actions)
│           │   ├── refresh-stocks/
│           │   └── refresh-notes/
│           └── actions/      # admin manuální triggery (session auth)
│               ├── refresh-stocks/
│               └── refresh-notes/
├── collections/
│   ├── Users.ts
│   └── Stocks.ts
├── components/
│   └── admin/                # Payload admin custom komponenty
├── lib/
│   ├── yahoo-finance.ts      # wrapper nad yahoo-finance2 v3
│   ├── refresh-stocks.ts     # orchestrace (sekvenční, 500ms delay)
│   ├── enrich-notes.ts       # AI note generation, vždy s web_search
│   └── stock-mapper.ts       # Payload doc → view model
├── scripts/
│   └── seed.ts               # import z public/data/*.json
├── types/stocks.ts
├── utils/format.ts
└── payload.config.ts
```

## Poznámky

- **Schema validace yahoo-finance2**: vypnuta globálně, jeden změněný field od Yahoo neshodí celý cron. Nepodařené fetche se zapisují do `lastFetchError` pole.
- **Snapshoty** (timeseries) zatím neimplementované. Přidání: kolekce `stock_snapshots` + denní `create()` místo `update()`.
- **AI web search**: vždy zapnutý (`web_search_20250305` tool, max 15 uses per run). Model si sám dohledá recent události (akvizice, earnings, lawsuit) pro každý ticker.
- **GH Actions scheduled cron precision**: může být zpožděný o pár minut při zatížení runnerů, pro denní job není problém.
