/**
 * Utilitários globais de região/país
 * - Chave persistida em localStorage: hyppado_region
 * - Padrão: BR
 * - Lista de regiões disponíveis vem do banco de dados via /api/regions
 */

export const REGION_STORAGE_KEY = "hyppado_region";
export const DEFAULT_REGION = "BR";

export const REGION_FLAGS: Record<string, string> = {
  US: "🇺🇸",
  BR: "🇧🇷",
  UK: "🇬🇧",
  GB: "🇬🇧",
  MX: "🇲🇽",
  CA: "🇨🇦",
  AU: "🇦🇺",
  DE: "🇩🇪",
  FR: "🇫🇷",
  ES: "🇪🇸",
  IT: "🇮🇹",
  ID: "🇮🇩",
  PH: "🇵🇭",
  TH: "🇹🇭",
  VN: "🇻🇳",
  SG: "🇸🇬",
  MY: "🇲🇾",
};

/** Lê a região armazenada no browser. Retorna BR em SSR. */
export function getStoredRegion(): string {
  if (typeof window === "undefined") return DEFAULT_REGION;
  return (
    localStorage.getItem(REGION_STORAGE_KEY) || DEFAULT_REGION
  ).toUpperCase();
}

/** Grava a região escolhida no localStorage. */
export function setStoredRegion(region: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(REGION_STORAGE_KEY, region.toUpperCase());
  }
}
