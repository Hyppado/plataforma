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
}

/** Busca planos ativos do banco via API. */
export async function fetchPlans(baseUrl = ""): Promise<PlanDisplay[]> {
  try {
    const res = await fetch(`${baseUrl}/api/admin/plans`);
    if (!res.ok) return [];
    const { plans } = await res.json();
    return (plans ?? [])
      .filter((p: Record<string, unknown>) => p.isActive)
      .map((p: Record<string, unknown>) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        displayPrice:
          p.displayPrice ??
          `R$ ${((p.priceAmount as number) / 100).toFixed(2).replace(".", ",")}`,
        period: p.periodicity === "ANNUAL" ? "ano" : "mês",
        description: p.description,
        features: (p.features as string[]) ?? [],
        highlight: p.highlight ?? false,
        badge: p.badge,
      }));
  } catch {
    return [];
  }
}
