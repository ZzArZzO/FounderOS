/**
 * Lightweight, key-free market grounding for marketing/newsletter copy.
 * Pulls live EUR FX cross-rates (Frankfurter) and crypto prices (CoinGecko) —
 * Sunday's exact asset universe (EU stocks priced in EUR + crypto). Best-effort:
 * returns "" if a source is unavailable so generation never blocks.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchJson(url: string, ms = 8000): Promise<any | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function getMarketContext(): Promise<string> {
  const [fx, crypto] = await Promise.all([
    fetchJson("https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,CHF"),
    fetchJson(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=eur",
    ),
  ]);

  const lines: string[] = [];
  if (fx?.rates) {
    lines.push(
      `FX (as of ${fx.date}): EUR/USD ${fx.rates.USD}, EUR/GBP ${fx.rates.GBP}, EUR/CHF ${fx.rates.CHF}.`,
    );
  }
  if (crypto?.bitcoin?.eur) {
    lines.push(
      `Crypto (EUR): BTC €${crypto.bitcoin.eur}, ETH €${crypto.ethereum?.eur}, SOL €${crypto.solana?.eur}.`,
    );
  }
  return lines.join("\n");
}
