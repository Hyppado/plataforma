/**
 * @deprecated Este módulo é scaffolding não utilizado. Dados de tenant
 * devem vir do banco de dados via sessão NextAuth (session.user.id).
 * Esta arquivo será removido numa versão futura.
 *
 * Tenant store for front-end only.
 * In production, tenant data would come from a backend/database.
 */

import type { Tenant, Usage } from "@/lib/types/admin";

/**
 * Default tenant for UI scaffolding.
 * In production, this would be fetched from the backend based on session.
 */
export const DEFAULT_TENANT: Tenant = {
  id: "default-workspace",
  name: "Workspace Padrão",
  email: undefined,
  planId: "starter",
  hotmart: {
    connected: false,
    producerId: undefined,
    lastWebhookAt: undefined,
    status: "not_configured",
  },
  createdAt: new Date().toISOString(),
};

/**
 * Get current tenant.
 * For now, returns the default tenant.
 * In production, this would check session/auth.
 */
export function getCurrentTenant(): Tenant {
  return DEFAULT_TENANT;
}

/**
 * Get tenant usage for current period.
 * Returns null values since we have no backend connection.
 */
export function getTenantUsage(tenantId: string): Usage {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
  );

  return {
    tenantId,
    period: {
      startISO: startOfMonth.toISOString(),
      endISO: endOfMonth.toISOString(),
    },
    // null = unknown (no backend connected)
    insightTokensUsed: null,
    scriptTokensUsed: null,
  };
}

/**
 * Format period for display.
 */
export function formatPeriod(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

/**
 * Get all available tenants.
 * For now, returns only the default tenant.
 * Multi-tenant support is scaffolded but not implemented.
 */
export function getAllTenants(): Tenant[] {
  return [DEFAULT_TENANT];
}
