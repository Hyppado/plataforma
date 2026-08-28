/**
 * Tests: aviso de indisponibilidade (faixa no topo da plataforma)
 *
 * app/api/maintenance-banner/route.ts        — leitura pelo usuário
 * app/api/admin/settings/maintenance-banner  — liga/desliga e edição
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedUser,
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  makeGetRequest,
  makePostRequest,
} from "@tests/helpers/auth";

vi.mock("@/lib/prisma");

const getSetting = vi.fn();
const upsertSetting = vi.fn();
vi.mock("@/lib/settings", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/settings")>("@/lib/settings");
  return {
    ...real,
    getSetting: (...a: unknown[]) => getSetting(...a),
    upsertSetting: (...a: unknown[]) => upsertSetting(...a),
  };
});

import { GET } from "@/app/api/maintenance-banner/route";
import {
  GET as ADMIN_GET,
  POST as ADMIN_POST,
} from "@/app/api/admin/settings/maintenance-banner/route";
import { MAINTENANCE_BANNER_DEFAULT_MESSAGE } from "@/lib/settings";

/** Responde por chave, como o getSetting real. */
function settings(map: Record<string, string | null>) {
  getSetting.mockImplementation(async (key: string) => map[key] ?? null);
}

beforeEach(() => {
  vi.clearAllMocks();
  upsertSetting.mockResolvedValue({});
  (prismaMock.auditLog.create as any).mockResolvedValue({});
});

describe("GET /api/maintenance-banner", () => {
  it("rejeita não autenticado", async () => {
    mockUnauthenticated();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("devolve a mensagem quando o aviso está ligado", async () => {
    mockAuthenticatedUser();
    settings({
      "maintenance.banner_enabled": "true",
      "maintenance.banner_message": "Downloads instáveis hoje",
    });

    const body = await (await GET()).json();
    expect(body).toEqual({
      enabled: true,
      message: "Downloads instáveis hoje",
    });
  });

  /** A mensagem configurada não deve vazar para quem não deveria vê-la. */
  it("não expõe a mensagem quando o aviso está desligado", async () => {
    mockAuthenticatedUser();
    settings({
      "maintenance.banner_enabled": "false",
      "maintenance.banner_message": "rascunho ainda não publicado",
    });

    const body = await (await GET()).json();
    expect(body.enabled).toBe(false);
    expect(body.message).toBe("");
  });

  it("cai no texto padrão quando ligado sem mensagem", async () => {
    mockAuthenticatedUser();
    settings({ "maintenance.banner_enabled": "true" });

    const body = await (await GET()).json();
    expect(body.message).toBe(MAINTENANCE_BANNER_DEFAULT_MESSAGE);
  });

  /**
   * Ler a configuração é acessório: se essa consulta falhar, a plataforma
   * segue funcionando — só não mostra o aviso.
   */
  it("degrada para 'sem aviso' se a leitura falhar", async () => {
    mockAuthenticatedUser();
    getSetting.mockRejectedValue(new Error("banco fora do ar"));

    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).enabled).toBe(false);
  });
});

describe("POST /api/admin/settings/maintenance-banner", () => {
  it("exige admin", async () => {
    mockAuthenticatedUser();
    const res = await ADMIN_POST(
      makePostRequest("/api/admin/settings/maintenance-banner", {
        enabled: true,
      }) as any,
    );
    expect(res.status).toBe(403);
  });

  it("liga o aviso e grava a mensagem", async () => {
    mockAuthenticatedAdmin();

    const res = await ADMIN_POST(
      makePostRequest("/api/admin/settings/maintenance-banner", {
        enabled: true,
        message: "Instabilidade nos downloads",
      }) as any,
    );

    expect(res.status).toBe(200);
    expect(upsertSetting).toHaveBeenCalledWith(
      "maintenance.banner_enabled",
      "true",
      expect.any(Object),
    );
    expect(upsertSetting).toHaveBeenCalledWith(
      "maintenance.banner_message",
      "Instabilidade nos downloads",
      expect.any(Object),
    );
  });

  /** Ligar sem texto exibiria uma faixa vazia. */
  it("usa o texto padrão ao ligar sem mensagem", async () => {
    mockAuthenticatedAdmin();

    await ADMIN_POST(
      makePostRequest("/api/admin/settings/maintenance-banner", {
        enabled: true,
        message: "   ",
      }) as any,
    );

    expect(upsertSetting).toHaveBeenCalledWith(
      "maintenance.banner_message",
      MAINTENANCE_BANNER_DEFAULT_MESSAGE,
      expect.any(Object),
    );
  });

  it("recusa mensagem longa demais para a faixa", async () => {
    mockAuthenticatedAdmin();

    const res = await ADMIN_POST(
      makePostRequest("/api/admin/settings/maintenance-banner", {
        enabled: true,
        message: "x".repeat(281),
      }) as any,
    );

    expect(res.status).toBe(400);
    expect(upsertSetting).not.toHaveBeenCalled();
  });

  it("recusa enabled que não é booleano", async () => {
    mockAuthenticatedAdmin();

    const res = await ADMIN_POST(
      makePostRequest("/api/admin/settings/maintenance-banner", {
        enabled: "sim",
      }) as any,
    );

    expect(res.status).toBe(400);
  });

  /** Afeta todos os usuários — precisa ficar registrado quem acionou. */
  it("registra em audit log quem ligou o aviso", async () => {
    mockAuthenticatedAdmin();

    await ADMIN_POST(
      makePostRequest("/api/admin/settings/maintenance-banner", {
        enabled: true,
        message: "Instabilidade",
      }) as any,
    );

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "MAINTENANCE_BANNER_ENABLED",
        }),
      }),
    );
  });

  it("registra em audit log quem desligou", async () => {
    mockAuthenticatedAdmin();

    await ADMIN_POST(
      makePostRequest("/api/admin/settings/maintenance-banner", {
        enabled: false,
        message: "",
      }) as any,
    );

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "MAINTENANCE_BANNER_DISABLED",
        }),
      }),
    );
  });
});

describe("GET /api/admin/settings/maintenance-banner", () => {
  it("devolve a mensagem salva mesmo com o aviso desligado", async () => {
    mockAuthenticatedAdmin();
    settings({
      "maintenance.banner_enabled": "false",
      "maintenance.banner_message": "rascunho pronto",
    });

    const body = await (await ADMIN_GET()).json();
    expect(body.enabled).toBe(false);
    // O admin precisa ver o rascunho para editá-lo antes de acionar.
    expect(body.message).toBe("rascunho pronto");
  });
});
