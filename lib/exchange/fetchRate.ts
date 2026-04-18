/**
 * lib/exchange/fetchRate.ts
 *
 * Fetches the latest USD→BRL sell rate from the Brazilian Central Bank (BCB)
 * PTAX public API. Queries the last 10 days to handle weekends and holidays.
 *
 * Stores the result in the Setting table under key "exchange.usd_brl".
 * If the fetch fails, the existing stored value is preserved (fail-safe).
 */

import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const log = createLogger("exchange/fetchRate");

const SETTING_KEY = "exchange.usd_brl";

export interface ExchangeRatePayload {
  rate: number;
  date: string; // ISO date string, e.g. "2026-04-18"
  fetchedAt: string; // ISO datetime string
}

/**
 * Fetches the latest USD sell rate (cotacaoVenda) from BCB PTAX.
 * Queries a rolling 10-day window so weekends/holidays are handled gracefully.
 */
export async function fetchAndStoreUsdRate(): Promise<ExchangeRatePayload> {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 10);

  const fmt = (d: Date) =>
    `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;

  const url =
    `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/` +
    `CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
    `?@dataInicial='${fmt(start)}'&@dataFinalCotacao='${fmt(today)}'` +
    `&$top=1&$orderby=dataHoraCotacao%20desc&$format=json&$select=cotacaoVenda,dataHoraCotacao`;

  log.info("Fetching BCB PTAX rate", { url });

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // No cache — always fresh
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`BCB PTAX responded with HTTP ${res.status}`);
  }

  const json = await res.json();
  const entry = json?.value?.[0];

  if (!entry || typeof entry.cotacaoVenda !== "number") {
    throw new Error("BCB PTAX returned no rate data");
  }

  const rate: number = entry.cotacaoVenda;
  // dataHoraCotacao format: "2026-04-18 13:03:15.783"
  const rawDate: string = entry.dataHoraCotacao ?? fmt(today);
  const date = rawDate.split(" ")[0]; // "2026-04-18"

  const payload: ExchangeRatePayload = {
    rate,
    date,
    fetchedAt: new Date().toISOString(),
  };

  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(payload) },
    create: {
      key: SETTING_KEY,
      value: JSON.stringify(payload),
      label: "Taxa de câmbio USD → BRL (PTAX BCB)",
      group: "general",
      type: "text",
    },
  });

  log.info("USD→BRL rate stored", { rate, date });

  return payload;
}

/**
 * Returns the last stored exchange rate payload, or null if never fetched.
 */
export async function getStoredUsdRate(): Promise<ExchangeRatePayload | null> {
  const setting = await prisma.setting.findUnique({
    where: { key: SETTING_KEY },
  });
  if (!setting) return null;
  try {
    return JSON.parse(setting.value) as ExchangeRatePayload;
  } catch {
    return null;
  }
}
