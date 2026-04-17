#!/usr/bin/env python3
"""Fetch stock data via yfinance and write to public/data/stocks.json.

Usage:
    pip install yfinance
    python scripts/generate-stocks.py
"""

import json
import sys
from datetime import date
from pathlib import Path

try:
    import yfinance as yf
except ImportError:
    sys.stderr.write("Install yfinance first: pip install yfinance\n")
    sys.exit(1)


# Just the app ticker — name and sector are fetched automatically from yfinance.
# For stocks where the Yahoo Finance symbol differs, add an entry to YF_SYMBOL_OVERRIDE.
# For non-USD stocks, add an entry to CURRENCY_OVERRIDE.
STOCKS = [
    "MU", "MSFT", "META", "GOOGL", "NVDA", "AMD", "TSM", "AVGO",
    "KLAC", "AMAT", "LRCX", "ASML", "V", "MA", "DUOL",
    "DSY", "FICO", "SPGI", "MCO", "GE", "AMZN", "NFLX"
]

YF_SYMBOL_OVERRIDE = {
    "DSY": "DSY.PA",
}

RATING_MAP = {
    "strong_buy":   "Strong Buy",
    "buy":          "Buy",
    "outperform":   "Buy",
    "hold":         "Hold",
    "underperform": "Sell",
    "sell":         "Sell",
    "strong_sell":  "Strong Sell",
}


def num(v, digits=2):
    return None if v is None else round(float(v), digits)


def pct(v):
    """yfinance returns decimals (0.7054 = 70.54 %). Convert to number-as-percent."""
    return None if v is None else round(float(v) * 100, 2)


def ratio_from_pct(v):
    """yfinance returns debtToEquity as % (e.g. 15.5 means 0.155 ratio). Divide by 100."""
    return None if v is None else round(float(v) / 100, 3)


def billions(v):
    return None if v is None else round(float(v) / 1e9, 2)


def rating(key, mean):
    if key:
        mapped = RATING_MAP.get(key.lower())
        if mapped:
            return mapped
    if mean is not None:
        # Yahoo recommendationMean: 1 = Strong Buy, 5 = Strong Sell
        if mean <= 1.5: return "Strong Buy"
        if mean <= 2.5: return "Buy"
        if mean <= 3.5: return "Hold"
        if mean <= 4.5: return "Sell"
        return "Strong Sell"
    return "Hold"


def get_fx_rate(pair: str) -> float | None:
    """Return current FX rate, e.g. EURUSD=X. Returns None on failure."""
    try:
        info = yf.Ticker(pair).info
        rate = info.get("regularMarketPrice") or info.get("previousClose")
        return float(rate) if rate else None
    except Exception:
        return None


def get_analyst_breakdown(t) -> dict | None:
    """Fetch current-month analyst buy/hold/sell breakdown from recommendations_summary."""
    try:
        df = t.recommendations_summary
        if df is None or df.empty:
            return None
        row = df.iloc[0]
        result = {
            "strongBuy": int(row.get("strongBuy", 0) or 0),
            "buy": int(row.get("buy", 0) or 0),
            "hold": int(row.get("hold", 0) or 0),
            "sell": int(row.get("sell", 0) or 0),
            "strongSell": int(row.get("strongSell", 0) or 0),
        }
        if sum(result.values()) == 0:
            return None
        return result
    except Exception:
        return None


def fetch_stock(ticker: str, yf_symbol: str, fx_rates: dict[str, float]) -> dict:
    t = yf.Ticker(yf_symbol)
    info = t.info

    name = info.get("longName") or info.get("shortName") or ticker
    sector = info.get("sector") or info.get("industry") or "Other"
    currency = info.get("currency") or "USD"

    price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
    market_cap_local = info.get("marketCap")
    fx_to_usd = fx_rates.get(currency, 1.0)
    market_cap_usd_b = (
        billions(market_cap_local * fx_to_usd)
        if market_cap_local is not None and currency != "USD"
        else billions(market_cap_local)
    )

    gain52w = info.get("52WeekChange") or info.get("fiftyTwoWeekChange")

    return {
        "ticker": ticker,
        "name": name,
        "sector": sector,
        "currency": currency,
        "price": num(price),
        "pe": num(info.get("trailingPE")),
        "fwdPe": num(info.get("forwardPE")),
        "gain52w": pct(gain52w),
        "avgTarget": num(info.get("targetMedianPrice") or info.get("targetMeanPrice")),
        "cons": rating(info.get("recommendationKey"), info.get("recommendationMean")),
        "marketCap": market_cap_usd_b,
        "revenueGrowthYoY": pct(info.get("revenueGrowth")),
        "profitMargin": pct(info.get("profitMargins")),
        "roe": pct(info.get("returnOnEquity")),
        "debtToEquity": ratio_from_pct(info.get("debtToEquity")),
        "peg": num(info.get("trailingPegRatio") or info.get("pegRatio")),
        "targetHigh": num(info.get("targetHighPrice")),
        "targetLow": num(info.get("targetLowPrice")),
        "numAnalysts": info.get("numberOfAnalystOpinions"),
        "analystBreakdown": get_analyst_breakdown(t),
        "sources": [f"https://finance.yahoo.com/quote/{yf_symbol}"],
        "updatedAt": date.today().isoformat(),
    }


def main():
    sys.stderr.write("Fetching FX rates...\n")
    fx_rates = {
        "EUR": get_fx_rate("EURUSD=X") or 1.08,
        "GBP": get_fx_rate("GBPUSD=X") or 1.27,
    }
    for code, rate in fx_rates.items():
        sys.stderr.write(f"  {code}/USD = {rate:.4f}\n")

    sys.stderr.write("Fetching stocks from yfinance...\n")
    stocks = []
    for ticker in STOCKS:
        yf_symbol = YF_SYMBOL_OVERRIDE.get(ticker, ticker)
        sys.stderr.write(f"  {ticker:5s} ({yf_symbol})... ")
        sys.stderr.flush()
        try:
            stocks.append(fetch_stock(ticker, yf_symbol, fx_rates))
            sys.stderr.write("ok\n")
        except Exception as e:
            sys.stderr.write(f"ERR: {e}\n")

    dataset = {
        "dataAsOf": date.today().isoformat(),
        "sources": ["https://finance.yahoo.com (via yfinance)"],
        "disclaimer": "Není investiční doporučení. Data jsou informativní, ceny se mění v reálném čase.",
        "stocks": stocks,
    }

    out_path = Path(__file__).resolve().parent.parent / "public" / "data" / "stocks.json"
    out_path.write_text(json.dumps(dataset, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    sys.stderr.write(f"\nWrote {len(stocks)}/{len(STOCKS)} stocks to {out_path}\n")


if __name__ == "__main__":
    main()
