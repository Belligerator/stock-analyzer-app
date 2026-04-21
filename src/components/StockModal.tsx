'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Stock } from '../types/stocks';
import { formatDateTime, formatPe, formatPct, formatPrice, upside } from '../utils/format';
import { StockChart } from './StockChart';
import { SelectionLookup } from './SelectionLookup';
import { AnalystActivitySection } from './AnalystActivitySection';
import s from './StockModal.module.css';

interface StockModalProps {
  stock: Stock | null;
  onClose: () => void;
}

const GOOD = '#22c55e';
const WARN = '#f59e0b';
const BAD = '#ef4444';

function colorPe(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v < 15) return GOOD;
  if (v < 30) return undefined;
  if (v < 50) return WARN;
  return BAD;
}

function colorFwdPe(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v < 20) return GOOD;
  if (v < 30) return undefined;
  if (v < 40) return WARN;
  return BAD;
}

function colorPeg(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v < 1) return GOOD;
  if (v < 2) return undefined;
  if (v < 3) return WARN;
  return BAD;
}

function colorDe(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v < 0.5) return GOOD;
  if (v < 1.5) return undefined;
  if (v < 2.5) return WARN;
  return BAD;
}

function colorMargin(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v >= 20) return GOOD;
  if (v >= 10) return undefined;
  if (v >= 0) return WARN;
  return BAD;
}

function colorRoe(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v >= 20) return GOOD;
  if (v >= 10) return undefined;
  if (v >= 0) return WARN;
  return BAD;
}

function colorRevenueGrowth(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v >= 15) return GOOD;
  if (v >= 0) return undefined;
  if (v >= -10) return WARN;
  return BAD;
}

function colorAnalysts(n: number | null | undefined): string | undefined {
  if (n == null) return undefined;
  if (n >= 15) return GOOD;
  if (n >= 5) return undefined;
  return WARN;
}

function colorTargetRange(ratio: number | null): string | undefined {
  if (ratio == null) return undefined;
  if (ratio < 1.5) return GOOD;
  if (ratio < 2) return undefined;
  if (ratio < 3) return WARN;
  return BAD;
}

function colorGain52w(v: number | null): string | undefined {
  if (v == null) return undefined;
  if (v >= 20) return GOOD;
  if (v >= 0) return undefined;
  if (v >= -20) return WARN;
  return BAD;
}

function colorUpside(v: number | null): string | undefined {
  if (v == null) return undefined;
  if (v >= 15) return GOOD;
  if (v >= 0) return undefined;
  if (v >= -10) return WARN;
  return BAD;
}

function colorEvEbitda(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v < 10) return GOOD;
  if (v < 15) return undefined;
  if (v < 25) return WARN;
  return BAD;
}

function colorGrossMargin(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v >= 50) return GOOD;
  if (v >= 30) return undefined;
  if (v >= 10) return WARN;
  return BAD;
}

function colorOperatingMargin(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v >= 20) return GOOD;
  if (v >= 10) return undefined;
  if (v >= 0) return WARN;
  return BAD;
}

function colorRoa(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v >= 10) return GOOD;
  if (v >= 5) return undefined;
  if (v >= 0) return WARN;
  return BAD;
}

function colorEarningsGrowth(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v >= 20) return GOOD;
  if (v >= 0) return undefined;
  if (v >= -20) return WARN;
  return BAD;
}

function colorFcf(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v > 0) return GOOD;
  if (v === 0) return WARN;
  return BAD;
}

function colorInsiderNet(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v > 0.5) return GOOD;
  if (v >= -0.5) return undefined;
  if (v >= -2) return WARN;
  return BAD;
}

const NEUTRAL = '#e8edf3';

type ScaleItem = { color: string; label: string };
type TooltipData = {
  text: string;
  example?: string;
  note?: string;
  scale?: ScaleItem[];
};

const TOOLTIPS: Record<string, TooltipData> = {
  price: {
    text: 'Aktuální tržní cena jedné akcie v měně, ve které se obchoduje.',
    note: 'Data aktualizuje noční cron — během dne může zaostávat za live trhem.',
  },
  pe: {
    text: 'Price-to-Earnings (TTM) — cena akcie dělená ziskem na akcii za posledních 12 měsíců. Říká, kolik dolarů platíš za 1 dolar aktuálního zisku firmy.',
    example:
      'P/E 20 znamená, že platíš $20 za $1 ročního zisku. Při neměnném zisku by se ti investice vrátila za 20 let.',
    note: 'Nízké P/E nemusí znamenat levno — trh možná čeká pokles zisku. Pod 10 bývá tzv. „value trap" (hodnotová past).',
    scale: [
      { color: GOOD, label: '< 15 levné' },
      { color: NEUTRAL, label: '15–30 fér' },
      { color: WARN, label: '30–50 drahé' },
      { color: BAD, label: '> 50 velmi drahé' },
    ],
  },
  fwdPe: {
    text: 'Forward P/E — P/E založené na odhadovaném zisku v příštích 12 měsících (konsenzus analytiků). Ukazuje, za kolik kupuješ budoucí ziskovost, ne minulou.',
    example:
      'Firma s cenou $100 a očekávaným EPS $5 má Fwd P/E = 20. Pokud roste, Fwd P/E bude obvykle nižší než TTM P/E.',
    note: 'Odhady analytiků se mění — číslo není tak pevné jako TTM P/E.',
    scale: [
      { color: GOOD, label: '< 20 levné' },
      { color: NEUTRAL, label: '20–30 fér' },
      { color: WARN, label: '30–40 drahé' },
      { color: BAD, label: '> 40 velmi drahé' },
    ],
  },
  marketCap: {
    text: 'Market Capitalization — aktuální cena × počet akcií v oběhu. Celková tržní hodnota firmy jako celku. Zobrazeno v miliardách USD.',
    example: 'Apple s cenou $200 a ~15 mld. akcií má market cap ~$3 000 B (3 biliony USD).',
  },
  evEbitda: {
    text: 'Enterprise Value / EBITDA. EV = market cap + dluh − hotovost (kolik by tě stálo koupit celou firmu včetně dluhů). EBITDA = zisk před úroky, daněmi a odpisy.',
    example: 'EV/EBITDA 10 = firmu koupíš za 10× její roční provozní zisk. Mediáh S&P 500 je historicky 12–14.',
    note: 'Lepší než P/E pro srovnání firem s různou kapitálovou strukturou — na rozdíl od P/E neignoruje dluh a hotovost.',
    scale: [
      { color: GOOD, label: '< 10 levné' },
      { color: NEUTRAL, label: '10–15 fér' },
      { color: WARN, label: '15–25 drahé' },
      { color: BAD, label: '> 25 velmi drahé' },
    ],
  },
  peg: {
    text: 'P/E poměr dělený očekávaným ročním růstem zisku v %. Zohledňuje růst — rostoucí firma s vyšším P/E může být fér, stagnující firma s nízkým P/E naopak drahá.',
    example: 'P/E 30 / EPS růst 30 % = PEG 1,0 (fér). P/E 30 / růst 5 % = PEG 6,0 (drahé vzhledem k růstu).',
    scale: [
      { color: GOOD, label: '< 1 podhodnoceno' },
      { color: NEUTRAL, label: '1–2 fér' },
      { color: WARN, label: '2–3 drahé' },
      { color: BAD, label: '> 3 předražené' },
    ],
  },
  de: {
    text: 'Debt-to-Equity — celkový dluh firmy dělený vlastním kapitálem. Kolik má firma dluhu na každý 1 dolar kapitálu akcionářů.',
    example:
      'D/E 0,5 = na každý $1 kapitálu dluh 50¢. D/E 2,0 = dluh dvakrát větší než kapitál (zvýšené riziko při růstu úroků).',
    note: 'U bank a utilities je vyšší D/E běžný, u tech firem neobvyklý. Srovnávej v rámci sektoru.',
    scale: [
      { color: GOOD, label: '< 0,5 nízký dluh' },
      { color: NEUTRAL, label: '0,5–1,5 v pořádku' },
      { color: WARN, label: '1,5–2,5 vyšší dluh' },
      { color: BAD, label: '> 2,5 rizikové' },
    ],
  },
  gain52w: {
    text: 'Procentní změna ceny akcie za posledních 52 týdnů (roční price performance).',
    example:
      'Benchmark: S&P 500 dělá historicky +8–12 % ročně. +30 % = výrazně nadprůměrně. −15 % = velký underperformer oproti trhu.',
    scale: [
      { color: GOOD, label: '≥ +20 % silný růst' },
      { color: NEUTRAL, label: '0 až +20 %' },
      { color: WARN, label: '−20 až 0 %' },
      { color: BAD, label: '< −20 % propad' },
    ],
  },
  revenueYoY: {
    text: 'Year-over-Year růst tržeb — procentní změna příjmů oproti stejnému období před rokem. Hlavní indikátor, že byznys škáluje.',
    example: 'Revenue YoY +25 %: loni firma v dané periodě udělala $4 B, letos $5 B.',
    note: 'Samotný růst tržeb nestačí — kombinuj s ziskovostí (Earnings YoY, marže). Tržby rostou snadno levnějšími produkty, zisk tak snadno ne.',
    scale: [
      { color: GOOD, label: '≥ +15 % rychlý růst' },
      { color: NEUTRAL, label: '0 až +15 %' },
      { color: WARN, label: '−10 až 0 % pokles' },
      { color: BAD, label: '< −10 % výrazný pokles' },
    ],
  },
  earningsYoY: {
    text: 'Year-over-Year růst čistého zisku. Doplňuje Revenue YoY — ukazuje, jestli růst tržeb skutečně vede k růstu zisku, nebo se rozpouští v rostoucích nákladech.',
    example:
      'Revenue +20 % a Earnings +5 % = firma ztrácí marži. Revenue +20 % a Earnings +30 % = operating leverage pracuje (zisk roste rychleji než tržby).',
    note: 'Earnings YoY je volatilnější než Revenue YoY — jeden velký jednorázový náklad dokáže číslo výrazně rozhodit.',
    scale: [
      { color: GOOD, label: '≥ +20 % silný růst zisku' },
      { color: NEUTRAL, label: '0 až +20 %' },
      { color: WARN, label: '−20 až 0 % pokles' },
      { color: BAD, label: '< −20 % výrazný pokles' },
    ],
  },
  grossMargin: {
    text: 'Gross Margin = (tržby − přímé náklady na produkt) / tržby. Kolik % z tržeb zbyde po odečtení výrobních/pořizovacích nákladů. Hlavní měřítko cenové síly a „moatu".',
    example:
      'Software: Microsoft ~70 %, Apple ~45 %. Retail: Walmart ~24 %, Costco ~12 % (nízká marže, vysoký obrat). Stabilně vysoká gross margin = firma si může účtovat svou cenu.',
    note: 'Klesající gross margin je včasný varovný signál — projeví se dřív než pokles čistého zisku.',
    scale: [
      { color: GOOD, label: '≥ 50 % silná cenová síla' },
      { color: NEUTRAL, label: '30–50 % slušná' },
      { color: WARN, label: '10–30 % slabá' },
      { color: BAD, label: '< 10 % kritická' },
    ],
  },
  operatingMargin: {
    text: 'Operating Margin — (tržby − COGS − provozní náklady) / tržby. Po COGS i mzdách, marketingu, R&D, ale před úroky a daněmi. Měří efektivitu samotného byznysu, bez vlivu financování.',
    example: 'Apple ~30 %, Google ~27 %, Walmart ~4 %. Konzistentně vysoká = dobrá disciplína nákladů.',
    scale: [
      { color: GOOD, label: '≥ 20 % výborná' },
      { color: NEUTRAL, label: '10–20 % slušná' },
      { color: WARN, label: '0–10 % slabá' },
      { color: BAD, label: '< 0 % provozní ztráta' },
    ],
  },
  profitMargin: {
    text: 'Net Profit Margin — čistý zisk (po všech nákladech, úrocích i daních) jako % tržeb. Kolik centů zisku zbyde z každého dolaru příjmu pro akcionáře.',
    example: 'Tržby $100, všechny náklady $85, daně $3 → zisk $12 → profit margin 12 %.',
    note: 'Srovnávej jen v rámci sektoru. Software typicky 20–30 %, retail 2–5 %, banky 20–30 %.',
    scale: [
      { color: GOOD, label: '≥ 20 % výborná' },
      { color: NEUTRAL, label: '10–20 % slušná' },
      { color: WARN, label: '0–10 % slabá' },
      { color: BAD, label: '< 0 % ztráta' },
    ],
  },
  roe: {
    text: 'Return on Equity — čistý zisk / vlastní kapitál akcionářů. Kolik zisku firma vytvoří za rok z $1 peněz vložených akcionáři.',
    example: 'Kapitál $10 B, zisk $2 B → ROE 20 % (velmi silné číslo).',
    note: 'Pozor: firma může zvednout ROE zadlužením (místo navýšení kapitálu si půjčí). Proto vždy sleduj souběžně ROA — pokud je velký rozdíl, ROE roste dluhem, ne kvalitou byznysu.',
    scale: [
      { color: GOOD, label: '≥ 20 % výborná' },
      { color: NEUTRAL, label: '10–20 % slušná' },
      { color: WARN, label: '0–10 % slabá' },
      { color: BAD, label: '< 0 % ztráta' },
    ],
  },
  roa: {
    text: 'Return on Assets — čistý zisk / celková aktiva. Kolik zisku firma vymáčkne z každého $1 aktiv (budovy, zásoby, stroje, IT). Párová metrika k ROE.',
    example: 'ROA 10 % = z $1 B aktiv firma vytváří $100 M ročního zisku. Banky mají typicky 1–2 %, software 15–25 %.',
    note: 'Pokud ROE výrazně převyšuje ROA (rozdíl > 15 p.b.), firma jede na vysokém leverage (dluh). Kvalitní firma má vysoké OBA — nízká potřeba aktiv i nízká potřeba dluhu.',
    scale: [
      { color: GOOD, label: '≥ 10 % výborná' },
      { color: NEUTRAL, label: '5–10 % slušná' },
      { color: WARN, label: '0–5 % slabá' },
      { color: BAD, label: '< 0 % ztráta' },
    ],
  },
  freeCashFlow: {
    text: 'Free Cash Flow — hotovost, která firmě zbyde po zaplacení provozu i kapitálových výdajů (CapEx). Skutečné peníze, které může použít na dividendy, buybacky, akvizice nebo splácení dluhu.',
    example:
      'FCF $5 B = firma ročně vygeneruje $5 miliard volné hotovosti. Záporný FCF = firma pálí peníze (typické u startup-fáze nebo při masivních investicích).',
    note: 'Nejtěžší metrika k účetnímu falšování. Pokud se FCF výrazně rozchází s účetním ziskem, zpozorni — účetní triky obvykle selhávají tady.',
    scale: [
      { color: GOOD, label: '> 0 firma generuje hotovost' },
      { color: WARN, label: '≈ 0 balancuje' },
      { color: BAD, label: '< 0 pálí peníze' },
    ],
  },
  avgTarget: {
    text: 'Medián cílových kurzů všech analytiků Wall Street, kteří akcii pokrývají. Cena, kterou v průměru čekají za 12 měsíců.',
    note: 'Analytici mají tendenci být optimističtí — zvlášť ti z bank, které firmu zároveň upisují nebo jí radí (potenciální konflikt zájmů).',
  },
  upside: {
    text: '(Avg Target − aktuální cena) / aktuální cena. Kolik % má akcie „dohnat" k průměrnému 12M cíli analytiků.',
    example: 'Cena $100, target $120 → upside 20 %. Analytici čekají růst o 20 % do roka.',
    scale: [
      { color: GOOD, label: '≥ +15 % velký prostor' },
      { color: NEUTRAL, label: '0 až +15 %' },
      { color: WARN, label: '−10 až 0 % nadhodnoceno' },
      { color: BAD, label: '< −10 % výrazně nad cílem' },
    ],
  },
  numAnalysts: {
    text: 'Počet analytiků, kteří akcii aktivně pokrývají. Víc analytiků = robustnější konsenzus a menší riziko, že jeden ojedinělý názor zkreslí průměr.',
    example:
      'Mega-cap jako NVDA typicky 40+. Mid-caps 10–20. Mikrokapy často 0–3 (= málo spolehlivá konsenzuální data).',
    scale: [
      { color: GOOD, label: '≥ 15 široké pokrytí' },
      { color: NEUTRAL, label: '5–15 průměrné' },
      { color: WARN, label: '< 5 málo dat' },
    ],
  },
  targetLow: {
    text: 'Nejnižší cílový kurz ze všech analytiků — pesimistický scénář (názor nejvíc bearish analytika).',
  },
  targetHigh: {
    text: 'Nejvyšší cílový kurz ze všech analytiků — optimistický scénář (názor nejvíc bullish analytika).',
  },
  targetRange: {
    text: 'Poměr Target High / Target Low. Měří, jak moc se analytici shodnou. Malé rozpětí = konsenzus, velké = velká nejistota ohledně budoucnosti firmy.',
    example: 'High $120, Low $100 → 1,2× (shoda). High $200, Low $50 → 4× (obří neshoda, spekulativní akcie).',
    scale: [
      { color: GOOD, label: '< 1,5× shoda' },
      { color: NEUTRAL, label: '1,5–2× mírná neshoda' },
      { color: WARN, label: '2–3× velká neshoda' },
      { color: BAD, label: '> 3× extrémní nejistota' },
    ],
  },
  insiderNet: {
    text: 'Net Insider Purchase Activity — čisté nákupy insiderů (CEO, CFO, board, významní akcionáři) za posledních ~6 měsíců jako % jejich celkového podílu. Kladné = insideři víc nakupovali než prodávali.',
    example:
      '+1,5 % = insideři čistě přikoupili 1,5 % svých akcií (bullish „skin in the game"). −2 % = čistě prodali 2 %.',
    note: 'Prodej sám o sobě má slabší signál — může jít o diverzifikaci, daně nebo vesting opcí. Nejsilnější bullish je naopak koncentrovaný nákup CEO/CFO přímo na otevřeném trhu.',
    scale: [
      { color: GOOD, label: '> +0,5 % insideři nakupují' },
      { color: NEUTRAL, label: '±0,5 % neutrál' },
      { color: WARN, label: '−2 až −0,5 % mírný prodej' },
      { color: BAD, label: '< −2 % silný prodej' },
    ],
  },
};

function TooltipIcon({ id }: { id: string }) {
  const [show, setShow] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const data = TOOLTIPS[id];

  const openTip = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setAnchor({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
    setShow(true);
  };

  useEffect(() => {
    if (!show) return;
    let active = false;
    const arm = setTimeout(() => {
      active = true;
    }, 120);
    const onDown = (e: Event) => {
      if (!active) return;
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (tipRef.current?.contains(target)) return;
      setShow(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShow(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(arm);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [show]);

  if (!data) return null;

  const TIP_W = 300;
  const MARGIN = 8;
  const textLines = Math.ceil(data.text.length / 50);
  const TIP_H_ESTIMATE =
    24 +
    textLines * 18 +
    (data.example ? Math.ceil(data.example.length / 48) * 18 + 20 : 0) +
    (data.note ? Math.ceil(data.note.length / 52) * 16 + 12 : 0) +
    (data.scale ? 16 + data.scale.length * 18 : 0);
  let tipLeft = 0;
  let tipTop = 0;
  if (anchor && typeof window !== 'undefined') {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    tipLeft = Math.min(Math.max(MARGIN, anchor.x - TIP_W / 2), vw - TIP_W - MARGIN);
    tipTop = anchor.y;
    if (tipTop + TIP_H_ESTIMATE > vh - MARGIN) {
      tipTop = Math.max(MARGIN, anchor.y - TIP_H_ESTIMATE - 18);
    }
  }

  return (
    <>
      <span
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          if (show) setShow(false);
          else openTip();
        }}
        className={s.tipIcon}
      >
        ?
      </span>
      {show &&
        anchor &&
        typeof document !== 'undefined' &&
        createPortal(
          <div ref={tipRef} className={s.tipPopup} style={{ left: tipLeft, top: tipTop }}>
            <div>{data.text}</div>
            {data.example && (
              <div className={s.tipExample}>
                <span className={s.tipExampleLabel}>Příklad:</span>
                {data.example}
              </div>
            )}
            {data.note && (
              <div className={s.tipNote}>
                <span className={s.tipNoteLabel}>Pozor:</span>
                {data.note}
              </div>
            )}
            {data.scale && (
              <div className={s.tipScale}>
                {data.scale.map((item) => (
                  <div key={item.label} className={s.tipScaleItem}>
                    <span className={s.tipScaleDot} style={{ background: item.color }} />
                    <span className={s.tipScaleLabel}>{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function Metric({
  label,
  value,
  color,
  tooltipId,
}: {
  label: string;
  value: string;
  color?: string;
  tooltipId?: string;
}) {
  return (
    <div>
      <div className={s.metricLabel}>
        {label}
        {tooltipId && <TooltipIcon id={tooltipId} />}
      </div>
      <div className={s.metricValue} style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

function formatMarketCap(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v >= 1000) return `$${(v / 1000).toFixed(2)}T`;
  return `$${v.toFixed(2)}B`;
}

function formatRatio(v: number | null | undefined): string {
  return v == null ? '—' : v.toFixed(2);
}

function formatFcf(v: number | null | undefined): string {
  if (v == null) return '—';
  const sign = v >= 0 ? '' : '-';
  const abs = Math.abs(v);
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(2)}T`;
  return `${sign}$${abs.toFixed(2)}B`;
}

function ratingBadge(cons: Stock['cons']): React.CSSProperties {
  if (cons === 'Strong Buy')
    return { background: 'rgba(34,197,94,.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,.3)' };
  if (cons === 'Hold')
    return { background: 'rgba(148,163,184,.12)', color: '#94a3b8', border: '1px solid rgba(148,163,184,.25)' };
  if (cons === 'Sell' || cons === 'Strong Sell')
    return { background: 'rgba(239,68,68,.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,.25)' };
  return { background: 'rgba(250,204,21,.1)', color: '#eab308', border: '1px solid rgba(250,204,21,.22)' };
}

const RATING_COLORS = {
  strongBuy: '#22c55e',
  buy: '#86efac',
  hold: '#94a3b8',
  sell: '#f87171',
  strongSell: '#ef4444',
};

function InsiderActivity({ ia }: { ia: NonNullable<Stock['insiderActivity']> }) {
  const net = ia.netPercent;
  const buy = ia.buyCount ?? 0;
  const sell = ia.sellCount ?? 0;
  const period = ia.period ?? '6m';

  if (net == null && buy === 0 && sell === 0) return null;

  const color = colorInsiderNet(net);
  const displayNet = net == null ? '—' : formatPct(net);
  const caption =
    net == null ? '' : net > 0 ? 'Čisté nákupy insiderů' : net < 0 ? 'Čisté prodeje insiderů' : 'Neutrální';

  return (
    <div className={s.insiderWrap}>
      <div className={s.insiderMain}>
        <div className={s.insiderValue} style={color ? { color } : undefined}>
          {displayNet}
        </div>
        <div className={s.insiderCaption}>{caption}</div>
      </div>
      <div className={s.insiderBreakdown}>
        <div className={s.insiderBreakdownRow}>
          <span className={s.insiderBreakdownKey}>Nákupů ({period})</span>
          <span className={s.insiderBreakdownVal}>{buy}</span>
        </div>
        <div className={s.insiderBreakdownRow}>
          <span className={s.insiderBreakdownKey}>Prodejů ({period})</span>
          <span className={s.insiderBreakdownVal}>{sell}</span>
        </div>
      </div>
    </div>
  );
}

function AnalystBreakdown({ bd }: { bd: NonNullable<Stock['analystBreakdown']> }) {
  const total = bd.strongBuy + bd.buy + bd.hold + bd.sell + bd.strongSell;
  if (total === 0) return null;

  const weightedMean = (bd.strongBuy * 1 + bd.buy * 2 + bd.hold * 3 + bd.sell * 4 + bd.strongSell * 5) / total;
  const markerPct = ((weightedMean - 1) / 4) * 100;

  const bars = [
    { key: 'strongBuy' as const, label: 'Strong Buy', count: bd.strongBuy },
    { key: 'buy' as const, label: 'Buy', count: bd.buy },
    { key: 'hold' as const, label: 'Hold', count: bd.hold },
    { key: 'sell' as const, label: 'Sell', count: bd.sell },
    { key: 'strongSell' as const, label: 'Strong Sell', count: bd.strongSell },
  ];

  return (
    <div className={s.analystWrap}>
      <div className={s.analystStacked}>
        {bars.map((b) =>
          b.count > 0 ? (
            <div
              key={b.key}
              title={`${b.label}: ${b.count}`}
              style={{ flex: b.count, background: RATING_COLORS[b.key], transition: 'flex .3s' }}
            />
          ) : null,
        )}
      </div>
      <div className={s.analystLegend}>
        {bars.map((b) =>
          b.count > 0 ? (
            <div key={b.key} className={s.analystLegendItem}>
              <div className={s.analystLegendDot} style={{ background: RATING_COLORS[b.key] }} />
              <span className={s.analystLegendName}>{b.label}</span>
              <span className={s.analystLegendCount}>{b.count}</span>
            </div>
          ) : null,
        )}
      </div>
      <div className={s.analystScale}>
        <div className={s.analystScaleLabels}>
          <span>Strong Buy</span>
          <span>Buy</span>
          <span>Hold</span>
          <span>Sell</span>
          <span>Strong Sell</span>
        </div>
        <div className={s.analystScaleBar}>
          <div className={s.analystMarker} style={{ left: `${markerPct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function StockModal({ stock, onClose }: StockModalProps) {
  const noteRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!stock) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [stock, onClose]);

  if (!stock) return null;

  const u = upside(stock.price, stock.avgTarget);

  return (
    <div onClick={onClose} className={s.overlay}>
      <div onClick={(e) => e.stopPropagation()} className={s.panel}>
        {/* Header */}
        <div className={s.header}>
          <div>
            <div className={s.titleRow}>
              <span className={s.ticker}>{stock.ticker}</span>
              <span className={s.name}>{stock.name}</span>
            </div>
            <div className={s.subRow}>
              <span>{stock.sector}</span>
              <span>·</span>
              <span>{stock.currency}</span>
              <span>·</span>
              <span className={s.badge} style={ratingBadge(stock.cons)}>
                {stock.cons}
              </span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Zavřít" className={s.closeBtn}>
            ×
          </button>
        </div>

        {/* Vývoj ceny */}
        <div className={s.chartWrap}>
          <StockChart ticker={stock.ticker} currency={stock.currency} />
        </div>

        {/* Cena & valuace */}
        <div className={s.sectionTitle}>Cena a valuace</div>
        <div className={s.grid3}>
          <Metric label="Cena" value={formatPrice(stock.price, stock.currency)} tooltipId="price" />
          <Metric label="P/E (TTM)" value={formatPe(stock.pe)} tooltipId="pe" color={colorPe(stock.pe)} />
          <Metric label="Fwd P/E" value={formatPe(stock.fwdPe)} tooltipId="fwdPe" color={colorFwdPe(stock.fwdPe)} />
          <Metric label="Market Cap" value={formatMarketCap(stock.marketCap)} tooltipId="marketCap" />
          <Metric
            label="EV / EBITDA"
            value={formatRatio(stock.evToEbitda)}
            tooltipId="evEbitda"
            color={colorEvEbitda(stock.evToEbitda)}
          />
          <Metric label="PEG" value={formatRatio(stock.peg)} tooltipId="peg" color={colorPeg(stock.peg)} />
          <Metric
            label="D/E"
            value={formatRatio(stock.debtToEquity)}
            tooltipId="de"
            color={colorDe(stock.debtToEquity)}
          />
        </div>

        {/* Růst */}
        <div className={s.sectionTitle}>Růst</div>
        <div className={s.grid3}>
          <Metric
            label="52W"
            value={formatPct(stock.gain52w)}
            color={colorGain52w(stock.gain52w)}
            tooltipId="gain52w"
          />
          <Metric
            label="Revenue YoY"
            value={formatPct(stock.revenueGrowthYoY ?? null)}
            color={colorRevenueGrowth(stock.revenueGrowthYoY)}
            tooltipId="revenueYoY"
          />
          <Metric
            label="Earnings YoY"
            value={formatPct(stock.earningsGrowthYoY ?? null)}
            color={colorEarningsGrowth(stock.earningsGrowthYoY)}
            tooltipId="earningsYoY"
          />
        </div>

        {/* Ziskovost a kvalita */}
        <div className={s.sectionTitle}>Ziskovost a kvalita</div>
        <div className={s.grid3}>
          <Metric
            label="Gross Margin"
            value={formatPct(stock.grossMargin ?? null)}
            color={colorGrossMargin(stock.grossMargin)}
            tooltipId="grossMargin"
          />
          <Metric
            label="Operating Margin"
            value={formatPct(stock.operatingMargin ?? null)}
            color={colorOperatingMargin(stock.operatingMargin)}
            tooltipId="operatingMargin"
          />
          <Metric
            label="Profit Margin"
            value={formatPct(stock.profitMargin ?? null)}
            color={colorMargin(stock.profitMargin)}
            tooltipId="profitMargin"
          />
          <Metric label="ROE" value={formatPct(stock.roe ?? null)} color={colorRoe(stock.roe)} tooltipId="roe" />
          <Metric label="ROA" value={formatPct(stock.roa ?? null)} color={colorRoa(stock.roa)} tooltipId="roa" />
          <Metric
            label="Free Cash Flow"
            value={formatFcf(stock.freeCashFlow)}
            color={colorFcf(stock.freeCashFlow)}
            tooltipId="freeCashFlow"
          />
        </div>

        {/* Analytici */}
        <div className={s.sectionTitle}>Analytici</div>
        <div className={s.grid3}>
          <Metric
            label="Avg Target"
            value={formatPrice(stock.avgTarget ?? null, stock.currency)}
            tooltipId="avgTarget"
          />
          <Metric label="Upside" value={u != null ? formatPct(u) : '—'} color={colorUpside(u)} tooltipId="upside" />
          <Metric
            label="Počet analytiků"
            value={stock.numAnalysts != null ? String(stock.numAnalysts) : '—'}
            color={colorAnalysts(stock.numAnalysts)}
            tooltipId="numAnalysts"
          />
          <Metric
            label="Target Low"
            value={formatPrice(stock.targetLow ?? null, stock.currency)}
            tooltipId="targetLow"
          />
          <Metric
            label="Target High"
            value={formatPrice(stock.targetHigh ?? null, stock.currency)}
            tooltipId="targetHigh"
          />
          <Metric
            label="Rozpětí"
            value={
              stock.targetHigh != null && stock.targetLow != null && stock.targetLow > 0
                ? `${(stock.targetHigh / stock.targetLow).toFixed(2)}×`
                : '—'
            }
            tooltipId="targetRange"
            color={colorTargetRange(
              stock.targetHigh != null && stock.targetLow != null && stock.targetLow > 0
                ? stock.targetHigh / stock.targetLow
                : null,
            )}
          />
        </div>
        {stock.analystBreakdown && <AnalystBreakdown bd={stock.analystBreakdown} />}
        <AnalystActivitySection
          lastAction={stock.analystLastActionDate}
          metricsUpdatedAt={stock.updatedAt}
          revisions={stock.epsRevisions}
          trend={stock.recommendationTrend}
        />

        {/* Insideři */}
        {stock.insiderActivity && (
          <>
            <div className={s.sectionTitle}>
              Insideři <TooltipIcon id="insiderNet" />
            </div>
            <InsiderActivity ia={stock.insiderActivity} />
          </>
        )}

        {/* Poznámka */}
        {stock.note && (
          <>
            <div className={s.sectionTitle}>Poznámka</div>
            <div ref={noteRef} className={s.noteBox}>
              {stock.note}
            </div>
            <SelectionLookup containerRef={noteRef} context={stock.note} />
            <div className={s.noteDisclaimer}>
              Generováno AI. Nejedná se o investiční doporučení ani nabídku ke koupi či prodeji cenných papírů. Pouze
              informativní účel.
            </div>
            {stock.newsSources && stock.newsSources.length > 0 && (
              <div className={s.newsSection}>
                <div className={s.newsLabel}>Zdroje z Yahoo (recent news)</div>
                <ol className={s.newsList}>
                  {stock.newsSources.map((n, i) => {
                    const date = n.publishedAt
                      ? new Date(n.publishedAt).toLocaleDateString('cs-CZ', {
                          day: 'numeric',
                          month: 'numeric',
                          year: 'numeric',
                        })
                      : '';
                    const shortTitle = n.title.length > 70 ? n.title.slice(0, 70) + '…' : n.title;
                    return (
                      <li key={`${i}-${n.link}`}>
                        <a href={n.link} target="_blank" rel="noreferrer" title={n.title} className={s.newsLink}>
                          {n.publisher || 'Zdroj'}
                          {date ? ` (${date})` : ''}
                        </a>
                        {n.title && <span className={s.newsSnippet}>— {shortTitle}</span>}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </>
        )}

        {/* Metadata */}
        <div className={s.sectionTitle}>Metadata</div>
        <div className={s.meta}>
          <div>
            <span className={s.metaKey}>Aktualizováno:</span> {formatDateTime(stock.updatedAt)}
          </div>
          {stock.sources && stock.sources.length > 0 && (
            <div>
              <span className={s.metaKey}>Zdroje:</span>{' '}
              {stock.sources.map((src, i) => (
                <span key={src}>
                  {i > 0 ? ', ' : ''}
                  <a href={src} target="_blank" rel="noreferrer" className={s.metaLink}>
                    {src.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
