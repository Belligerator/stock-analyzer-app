# Stock Analyzer

Statický web zobrazující přehled metrik vybraných akcií (cena, P/E, Fwd P/E, 52W, analyst target, upside, rating, market cap, růst, margin, ROE, D/E, PEG). Čísla v `public/data/stocks.json` se generují lokálním Python skriptem z Yahoo Finance. Kvalitativní poznámky v `public/data/notes.json` vytváří AI. Oba soubory se merguj v Reactu při renderu — čísla nikdy neprojdou AI workflowem.

## Lokální vývoj

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # produkční build do ./dist
npm run preview  # náhled produkčního buildu
```

## Aktualizace dat

### 1. Stáhnout aktuální čísla (yfinance)

```bash
pip install yfinance            # jednorázově
python scripts/generate-stocks.py
```

Skript stáhne data pro všech 21 tickerů z Yahoo Finance a přepíše `public/data/stocks.json`. Pro EUR akcie (DSY) se `marketCap` převádí na USD aktuálním FX.

Úprava seznamu tickerů: `scripts/generate-stocks.py`, pole `STOCKS`.

### 2. (Volitelné) Doplnit poznámky přes AI

Postup v [`prompts/enrich-notes.md`](prompts/enrich-notes.md). Vezmeš vygenerovaný `stocks.json`, pošleš s promptem Claudovi. AI vrátí **pouze mapu `{ticker: note}`**, ne celý dataset. Výstup ulož jako `public/data/notes.json`.

Strukturální bezpečnost: AI nevrací čísla ani celý dataset, jen text poznámek. React v `App.tsx` při merge bere z `notes.json` výhradně stringy a aplikuje je na odpovídající ticker. I kdyby `notes.json` obsahoval neplatná data, nemá jak ovlivnit `stocks.json`.

### 3. Deploy

```bash
git add public/data/stocks.json public/data/notes.json
git commit -m "data: update YYYY-MM-DD"
git push
```

Vercel auto-buildne. JSON je servován s `Cache-Control: no-cache`, takže změny se projeví ihned.

## Struktura

```
public/data/
  stocks.json               # čísla z yfinance (autoritativní)
  notes.json                # AI-vygenerované poznámky (plochá mapa ticker→string)
scripts/
  generate-stocks.py        # yfinance → stocks.json
prompts/
  enrich-notes.md           # AI prompt na vygenerování notes.json
src/
  types/stocks.ts           # TypeScript typy (StocksDataset, NotesFile)
  utils/format.ts           # formátovače
  components/               # Header, SectorFilter, StockTable, Legend
  App.tsx                   # fetch stocks + notes, merge v paměti
```

## Další kroky (roadmap)

- Zobrazit v UI nové sloupce (marketCap, D/E, PEG …)
- BE s endpointem `GET /api/stocks` + DB (Vercel Postgres / Supabase / Neon)
- Admin upload JSONu → validace (Zod) → DB
- Automatizace: cron job spouštějící yfinance skript + enrich prompt → commit
