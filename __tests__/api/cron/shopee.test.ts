/**
 * Tests: Cron route — /api/cron/shopee
 *
 * Fronteira de segurança. Esta rota dispara trabalho pago (Whisper, GPT,
 * Shopee) e roda sem sessão de usuário — a única coisa entre ela e a internet
 * é o CRON_SECRET. Cobre: guardas de auth, bloqueio fora da Vercel, roteamento
 * de tarefas, clamp do count e propagação de erros.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const runShopeeRankingsCron = vi.fn();
const runShopeeAchadinhosCron = vi.fn();

// A rota sincroniza a taxonomia de categorias antes do ranking; sem este mock
// o teste tentaria alcançar o banco de verdade.
vi.mock("@/lib/shopee/categories-sync", () => ({
  syncShopeeCategoriesIfStale: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/shopee/cron/syncShopee", () => ({
  runShopeeRankingsCron: (...args: unknown[]) => runShopeeRankingsCron(...args),
  runShopeeAchadinhosCron: (...args: unknown[]) =>
    runShopeeAchadinhosCron(...args),
}));

import { GET } from "@/app/api/cron/shopee/route";

const SECRET = "test-cron-secret";

function makeRequest(
  params: Record<string, string> = {},
  authorization?: string,
): NextRequest {
  const url = new URL("http://localhost/api/cron/shopee");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  return new NextRequest(url.toString(), {
    headers: authorization ? { authorization } : {},
  });
}

/** Requisição autenticada como o Vercel Cron faria. */
function authed(params: Record<string, string> = {}) {
  return makeRequest(params, `Bearer ${SECRET}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = SECRET;
  process.env.VERCEL = "1";
  runShopeeRankingsCron.mockResolvedValue(10);
  runShopeeAchadinhosCron.mockResolvedValue(5);
});

afterEach(() => {
  delete process.env.VERCEL;
});

describe("guardas de autenticação", () => {
  it("rejeita requisição sem Authorization", async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    expect(runShopeeRankingsCron).not.toHaveBeenCalled();
    expect(runShopeeAchadinhosCron).not.toHaveBeenCalled();
  });

  it("rejeita token errado", async () => {
    const res = await GET(makeRequest({}, "Bearer errado"));

    expect(res.status).toBe(401);
    expect(runShopeeRankingsCron).not.toHaveBeenCalled();
  });

  it("rejeita token de tamanho diferente sem quebrar o timingSafeEqual", async () => {
    // timingSafeEqual lança se os buffers tiverem tamanhos distintos — a rota
    // precisa comparar o tamanho ANTES de chamar.
    const res = await GET(makeRequest({}, "Bearer x"));

    expect(res.status).toBe(401);
  });

  it("falha FECHADO quando CRON_SECRET não está configurado", async () => {
    // Nunca fail-open: sem segredo, ninguém executa
    delete process.env.CRON_SECRET;

    const res = await GET(makeRequest({}, "Bearer qualquer"));

    expect(res.status).toBe(500);
    expect(runShopeeRankingsCron).not.toHaveBeenCalled();
  });

  it("falha FECHADO quando CRON_SECRET está vazio", async () => {
    process.env.CRON_SECRET = "";

    const res = await GET(makeRequest({}, "Bearer "));

    expect(res.status).toBe(500);
  });

  it("aceita o token correto", async () => {
    const res = await GET(authed());

    expect(res.status).toBe(200);
  });

  it("aceita 'bearer' em caixa baixa", async () => {
    const res = await GET(makeRequest({}, `bearer ${SECRET}`));

    expect(res.status).toBe(200);
  });
});

describe("bloqueio fora da Vercel", () => {
  it("recusa execução em ambiente local mesmo com token válido", async () => {
    delete process.env.VERCEL;

    const res = await GET(authed());

    expect(res.status).toBe(403);
    expect(runShopeeRankingsCron).not.toHaveBeenCalled();
    expect(runShopeeAchadinhosCron).not.toHaveBeenCalled();
  });
});

describe("roteamento de tarefas", () => {
  it("task=ranking roda só o ranking", async () => {
    await GET(authed({ task: "ranking" }));

    expect(runShopeeRankingsCron).toHaveBeenCalled();
    expect(runShopeeAchadinhosCron).not.toHaveBeenCalled();
  });

  it("task=achadinhos roda só o pipeline", async () => {
    await GET(authed({ task: "achadinhos" }));

    expect(runShopeeAchadinhosCron).toHaveBeenCalled();
    expect(runShopeeRankingsCron).not.toHaveBeenCalled();
  });

  it("sem task roda ambos (default 'all')", async () => {
    await GET(authed());

    expect(runShopeeRankingsCron).toHaveBeenCalled();
    expect(runShopeeAchadinhosCron).toHaveBeenCalled();
  });

  it("task desconhecida não executa nada", async () => {
    const res = await GET(authed({ task: "banana" }));

    expect(res.status).toBe(200);
    expect(runShopeeRankingsCron).not.toHaveBeenCalled();
    expect(runShopeeAchadinhosCron).not.toHaveBeenCalled();
  });

  it("devolve os resultados de cada tarefa", async () => {
    const res = await GET(authed());
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.results).toEqual({ rankings: 10, achadinhos: 5 });
  });
});

describe("parâmetros force e count", () => {
  it("force=true é repassado adiante", async () => {
    await GET(authed({ task: "ranking", force: "true" }));

    expect(runShopeeRankingsCron).toHaveBeenCalledWith(true);
  });

  it("sem force, roda com o gate de frequência ativo", async () => {
    await GET(authed({ task: "ranking" }));

    expect(runShopeeRankingsCron).toHaveBeenCalledWith(false);
  });

  it("limita count ao teto de 400", async () => {
    await GET(authed({ task: "achadinhos", count: "5000" }));

    expect(runShopeeAchadinhosCron).toHaveBeenCalledWith(false, 400);
  });

  it("limita count ao piso de 20", async () => {
    await GET(authed({ task: "achadinhos", count: "1" }));

    expect(runShopeeAchadinhosCron).toHaveBeenCalledWith(false, 20);
  });

  it("count não numérico vira o piso, não NaN", async () => {
    await GET(authed({ task: "achadinhos", count: "abc" }));

    expect(runShopeeAchadinhosCron).toHaveBeenCalledWith(false, 20);
  });

  it("sem count, deixa a Setting do admin decidir", async () => {
    await GET(authed({ task: "achadinhos" }));

    expect(runShopeeAchadinhosCron).toHaveBeenCalledWith(false, undefined);
  });
});

describe("tratamento de erro", () => {
  it("devolve 500 quando uma tarefa lança", async () => {
    runShopeeRankingsCron.mockRejectedValue(new Error("Shopee fora do ar"));

    const res = await GET(authed({ task: "ranking" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Shopee fora do ar");
  });
});
