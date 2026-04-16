/**
 * app/data/plans.ts
 *
 * Tipos e helper para planos na UI.
 * Dados reais vêm do banco (API /api/admin/plans).
 * Este arquivo fornece apenas o tipo e um helper fetch.
 */

export interface PlanDisplay {
  id: string;
  code: string;
  name: string;
  displayPrice: string | null;
  period: string;
  description: string | null;
  features: string[];
  highlight: boolean;
  badge?: string | null;
  checkoutUrl?: string | null;
}

/** Busca planos ativos do banco via endpoint público. */
export async function fetchPlans(baseUrl = ""): Promise<PlanDisplay[]> {
  try {
    const res = await fetch(`${baseUrl}/api/plans`, { cache: "no-store" });
    if (!res.ok) return [];
    const { plans } = await res.json();
    return (plans ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      code: p.code as string,
      name: p.name as string,
      displayPrice:
        (p.displayPrice as string | null) ??
        `R$ ${((p.priceAmount as number) / 100).toFixed(2).replace(".", ",")}`,
      period: p.periodicity === "ANNUAL" ? "ano" : "mês",
      description: (p.description as string | null) ?? null,
      features: (p.features as string[]) ?? [],
      highlight: (p.highlight as boolean) ?? false,
      badge: (p.badge as string | null) ?? null,
      checkoutUrl: (p.checkoutUrl as string | null) ?? null,
    }));
  } catch {
    return [];
  }
}
