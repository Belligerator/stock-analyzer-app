# Prompt: vygenerování poznámek k akciím (`data/notes.json`)

## Použití

1. Nejdřív vygeneruj aktuální čísla: `python scripts/generate-stocks.py` → `public/data/stocks.json`.
2. Otevři Claude chat (ideálně s web search).
3. Zkopíruj sekci `## Prompt` níže, na konec vlož obsah `public/data/stocks.json` a pošli do chatu.
4. AI vrátí **pouze mapu `{ticker: note}`**, ne celý dataset — tím je strukturálně nemožné, aby změnila jakékoli číslo.
5. Výstup ulož do `public/data/notes.json`.
6. Commit + push.

Web čte `stocks.json` a `notes.json` odděleně a merguje je v Reactu při renderu — bere z `notes.json` jen stringy a aplikuje je na odpovídající ticker. Čísla v `stocks.json` jsou takto nedotknutelná i kdyby v notes.json byla nevalidní data.

---

## Prompt

````
# Role
Jsi finanční analytik. Dostaneš JSON dataset akcií s již vyplněnými čísly (vygenerovaný automaticky z Yahoo Finance). Tvým úkolem je napsat **kvalitativní poznámky** k akciím, kde v datech vidíš anomálii nebo o firmě znáš relevantní kontext.

# Co NEDĚLÁŠ
- Nevracíš celý dataset. Vracíš pouze mapu `{ticker: note}`.
- Nevymýšlíš fakta (datumy, částky, názvy dealů, jména analytiků). Pokud si nejsi jistý, buď napiš jen co opravdu víš, nebo ticker z mapy vynech.
- Nepřidáváš tickery, které v datasetu nejsou.

# Co DĚLÁŠ
Pro každou akcii v poli `stocks` projdi metriky a zvaž, jestli v nich není anomálie (vysoké P/E, vysoký dluh, záporný růst, široké rozpětí targetů, apod.) nebo firma prošla významnou událostí (akvizice, spin-off, lawsuit, management change). Pokud ano, přidej záznam do výstupní mapy.

Raději napiš víc než míň. Pokud ti přijde něco „zjevné", stejně to napiš — dashboard používají i méně zkušení uživatelé a anomálie v datech má být vždy explicitně vysvětlena.

# Triggery — kdy poznámku přidat

Přidej poznámku, pokud platí některý z těchto bodů a ty o něm máš konkrétní znalost (ze svých tréninkových dat nebo z web searche):

1. **TTM P/E je výrazně zkreslené** — jednorázové zisky/ztráty, goodwill impairment, tax benefit, velký buyback reducing share count.
2. **Nedávná akvizice** (posledních 24 měsíců) zkresluje TTM metriky (revenue, margins, EPS, D/E).
3. **Fwd P/E výrazně odlišné od TTM P/E** (vyšší → trh očekává pokles zisků; nižší → očekává růst) — vysvětli proč.
4. **debtToEquity > 2** — vysoký dluh. Uveď důvod (velká akvizice, aggressive buyback, capex-heavy business, recent LBO).
5. **Záporný `revenueGrowthYoY`** — společnost ztrácí tržby. Zmiň proč, pokud je to specifický důvod (ne jen cyklus).
6. **Extrémní ROE** (>50 % nebo záporná) — vysvětli (vysoká páka, jednorázová ztráta).
7. **Extrémní upside** (target - price > 50 % nebo záporný) — pokud víš, proč se trh a analytici tak liší.
8. **Široké rozpětí analytických targetů** (targetHigh / targetLow > 2.0) — analytici nejsou jednotní. Zmiň, proč pokud víš (pending lawsuit, uncertain pipeline, regulatory risk).
9. **Nedávný velký event** (M&A, spin-off, regulační zásah, velký legal case, CEO change, major earnings miss/beat, product launch). Datum eventu uveď.
10. **Historicky negativní nebo volatilní EPS** — flag pokud to ovlivňuje interpretaci metrik.

# Pravidla pro obsah poznámek

1. **Rozepiš se, vysvětluj.** Délka není limitovaná — raději 3–5 vět s plným kontextem než jedna zkratkovitá. U události popiš: **(a) co se stalo**, **(b) kdy**, **(c) proč to ovlivňuje konkrétní metriku** v datasetu, **(d) jestli se to časem vyrovná** (tj. zda to ovlivňuje TTM ale už ne forward hodnoty).
2. **Nevynechávej zjevné věci.** Pokud se ti zdá nějaký důsledek samozřejmý („to přeci každý ví"), **stejně ho napiš**. Zkušený investor to možná ví, ale začátečník ne — a anomálie v datech má být vysvětlena explicitně. Raději víc než míň.
3. **Cílová skupina: smíšená.** Od laika po zkušeného investora. Neurážej čtenáře definicemi obecných pojmů (P/E, EPS, margin, goodwill, buyback, spin-off — tyhle termíny vysvětlovat NEMUSÍŠ). Ale vždy vysvětli **důsledek** konkrétní události pro konkrétní metriku dané firmy.
4. **Zdroj a datum vždy.** Krátký zdroj v závorce a datum. Starší zdroj je lepší než žádný. Formát:
   - `"(zdroj: Broadcom 10-K, FY2024)"`
   - `"(Reuters, únor 2026)"`
   - `"(company PR, 22.11.2023)"`
5. **Čeština.**
6. **Pouze fakta a kontext.** Žádné „buy", „sell", „undervalued", „overvalued", „great opportunity". Toto je neutrální informační poznámka, ne rada.
7. **Pouze pokud víš.** Když o firmě žádný relevantní kontext neznáš, ticker z výstupní mapy vynech. Ale pozor: „nevím nic" ≠ „všechno je v pořádku". Pokud data ukazují anomálii a ty konkrétní důvod neznáš, **přesto napiš poznámku** ve smyslu „D/E 2.3 bez specifického známého katalyzátoru; stojí za dohledání, zda jde o typickou strukturu sektoru nebo o recent LBO/akvizici".
8. **Nepsat obecná klišé.** „Cyclical industry", „high growth stock" — žádný přínos. Jen specifický kontext k této konkrétní firmě a této konkrétní metrice.

# Příklady dobrých poznámek

- `"Vysoké TTM P/E (74×) je přímý důsledek akvizice VMware dokončené v listopadu 2023 za přibližně $69 mld. Transakce vytvořila velký goodwill a nehmotná aktiva, jejichž amortizace teď několik let stahuje reportovaný GAAP zisk — proto je trailing P/E nafouknuté. Forward P/E (22×) už tento efekt z velké části odfiltruje, protože analytici pracují s očištěnými čísly. (zdroj: Broadcom 10-K FY2024, investor presentation leden 2026)"`
- `"Fwd P/E (17.7×) je výrazně níž než TTM P/E (40.6×), což znamená, že trh a analytici očekávají velký skok v ziscích během dalších 12 měsíců. Jde o pokračování AI datacenter boomu — Nvidia dodává chipy v rekordním tempu a konsenzus počítá s dalším zdvojnásobením EPS ve FY27. Riziko: pokud AI capex cyklus zpomalí, forward odhady se rychle zkorigují. (Morgan Stanley research note, leden 2026)"`
- `"D/E skočil na 2.3 po akvizici Hitachi Aerospace za $15 mld v září 2025, kdy si GE vzala dluhopisy na pokrytí cash části transakce. Management avizuje deleverage postup během 2026–2028. Do té doby zůstává balance sheet napnutější než je pro sektor typické. (GE press release 12.9.2025, Q4'25 earnings call)"`
- `"Široké rozpětí analytických targetů ($150–$400, poměr 2.7×) odráží rozkol v pohledu na pending antitrust lawsuit od DOJ. Bear case počítá s vynuceným odprodejem části byznysu, bull case s tím, že žaloba skončí dohodou bez strukturálních dopadů. Proto je i avgTarget méně informativní než obvykle — podívej se spíš na rozsah než na průměr. (Reuters, 8.2.2026)"`
- `"Záporný revenueGrowthYoY (-2.1 %) je u Applied Materials typický pro pozdní fázi WFE cyklu — equipment makers mají zpoždění za foundries, takže pokles začíná až potom, co TSMC/Samsung snížili capex. Analytici očekávají návrat k růstu v H2'26, jak nabíhají nové investice do 2nm a HBM kapacit. (AMAT Q1'26 earnings call, SEMI equipment outlook 2026)"`

# Příklady ŠPATNÝCH poznámek (nepoužívat)

- ❌ `"Great growth story"` — hodnotící („great"), bez zdroje, bez konkrétního faktu.
- ❌ `"Semiconductor cycle"` — obecné klišé bez kontextu.
- ❌ `"Trading at premium multiple"` — nic neříká, žádná explanace proč.
- ❌ `"P/E vysoké kvůli jednorázovým ziskům"` — chybí datum, zdroj, částka, jak se to promítne do fwd P/E.
- ❌ `"VMware akvizice zvedla P/E"` — správný směr, ale moc stručné. Dobrá verze rozepíše kdy (listopad 2023), za kolik ($69 mld), mechanismus (goodwill + amortizace), a zda se to časem vyrovná.

# Výstupní formát

Vrať POUZE validní JSON objekt s touto strukturou:

```json
{
  "generatedAt": "YYYY-MM-DD",
  "notes": {
    "TICKER": "poznámka textem...",
    "TICKER2": "poznámka textem..."
  }
}
```

Pravidla pro výstup:
- `generatedAt` = dnešní datum ve formátu YYYY-MM-DD.
- `notes` = plochá mapa ticker → string. Žádné vnořené objekty, žádná čísla, jen text poznámky.
- Tickery, pro které nemáš relevantní kontext, do mapy nepatří. Mapa nemusí obsahovat všechny tickery ze vstupního datasetu.
- Tickery, které nejsou ve vstupním datasetu, do mapy nepatří. Nikdy.
- Žádný markdown wrapping (žádné ```json bloky), žádný komentář před/za. Čistý JSON projde přes JSON.parse a uloží se jako `data/notes.json`.

# Vstupní dataset

Níže je obsah `public/data/stocks.json`. Čti z něj čísla a kontext; samotná data neměň — vracíš pouze notes mapu.

---
PASTE_STOCKS_JSON_HERE
````
