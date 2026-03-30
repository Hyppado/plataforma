# Diagnóstico — Arquitetura do Cron Echotik

> Data: 2026-03-27  
> Branch: `develop`  
> Escopo: leitura e análise — sem alterações de código

---

## 1. Entrypoint

| Item               | Valor                                          |
| ------------------ | ---------------------------------------------- |
| Rota               | `GET /api/cron/echotik`                        |
| Arquivo            | `app/api/cron/echotik/route.ts`                |
| `maxDuration`      | 60 s (limite Vercel)                           |
| Autenticação       | `Authorization: Bearer <CRON_SECRET>`          |
| Parâmetros aceitos | `?task=`, `?region=`, `?force=`                |
| Agendamento        | `vercel.json` → `*/15 * * * *` (a cada 15 min) |

---

## 2. Fluxo de Execução

```
GET /api/cron/echotik
  └─ auth: CRON_SECRET
  └─ runEchotikCron(task?, region?, force?)          ← orchestrator.ts
       ├─ detectNextTask(force?)                     ← orchestrator.ts
       │    ├─ getConfiguredRegions()                ← helpers.ts → Region table
       │    ├─ shouldSkip(source, intervalHours)     ← helpers.ts → IngestionRun
       │    └─ retorna { task, region } | null
       │
       └─ despacha para o sync correspondente:
            ├─ syncCategories(runId, log)            ← syncCategories.ts
            ├─ syncVideoRanklist(runId, region, log) ← syncVideos.ts
            ├─ syncProductRanklist(runId, region, log) ← syncProducts.ts
            └─ syncCreatorRanklist(runId, region, log) ← syncCreators.ts
```

**Quantidade de trabalho por invocação:** 1 task × 1 region.

---

## 3. Fonte de Regiões

- Lidas da tabela `Region` no banco de dados (`isActive = true`, `orderBy sortOrder`).
- Fallback para `["BR", "US", "JP"]` **somente** se a tabela retornar vazio.
- **Nunca** via variável de ambiente `ECHOTIK_REGIONS` (removida / anti-padrão documentado).
- Seed padrão: `prisma/seed.ts` cria BR, US, JP.

---

## 4. Constantes Hardcoded (`lib/echotik/cron/types.ts`)

| Constante                      | Valor | Significado                                            |
| ------------------------------ | ----- | ------------------------------------------------------ |
| `CATEGORIES_INTERVAL_HOURS`    | 24 h  | Intervalo entre sincronizações de categorias           |
| `VIDEO_TREND_INTERVAL_HOURS`   | 24 h  | Intervalo entre sincronizações de vídeos por região    |
| `PRODUCT_TREND_INTERVAL_HOURS` | 24 h  | Intervalo entre sincronizações de produtos por região  |
| `CREATOR_TREND_INTERVAL_HOURS` | 24 h  | Intervalo entre sincronizações de criadores por região |
| `VIDEO_RANKLIST_PAGES`         | 10    | Páginas buscadas por ranklist de vídeos                |
| `PRODUCT_RANKLIST_PAGES`       | 10    | Páginas buscadas por ranklist de produtos              |
| `CREATOR_RANKLIST_PAGES`       | 10    | Páginas buscadas por ranklist de criadores             |
| `PRODUCT_DETAIL_BATCH_SIZE`    | 5     | Produtos enriquecidos por invocação de detalhes        |
| `PRODUCT_DETAIL_MAX_AGE_DAYS`  | 7     | Staleness máximo para buscar detalhes de produto       |

**Rank fields** (`lib/echotik/rankFields.ts`): 2 por entidade

- Vídeos: `sales`, `views`
- Produtos: `sales`, `gmv`
- Criadores: `sales`, `followers`

**Ranking cycles** (hardcoded nos arquivos de sync): `[1, 2, 3]`

---

## 5. Volume por Invocação

| Entidade  | Ciclos | Rank fields | Páginas | Registros estimados |
| --------- | ------ | ----------- | ------- | ------------------- |
| Vídeos    | 3      | 2           | 10      | ~600                |
| Produtos  | 3      | 2           | 10      | ~600                |
| Criadores | 3      | 2           | 10      | ~600                |

> Cada invocação processa **1 entidade × 1 região**. O volume acima é por invocação completa de cada tipo.

---

## 6. Tempo de Ciclo Completo (estimado)

Para **N regiões**, o orquestrador percorre a fila de prioridade:

```
categories (1 invocação)
→ videos × N regiões  (N invocações)
→ products × N regiões (N invocações)
→ creators × N regiões (N invocações)
→ product-details (invocações adicionais)
```

| Regiões | Invocações mínimas | Ciclo @ 15 min/invocação |
| ------- | ------------------ | ------------------------ |
| 3       | ~10                | ~2,5 h                   |
| 5       | ~16                | ~4,0 h                   |
| 10      | ~31                | ~7,8 h                   |

> Se qualquer invocação falhar ou demorar > 60 s, o ciclo se estende proporcionalmente.

---

## 7. Estado e Checkpoint

| Mecanismo               | Detalhe                                                                           |
| ----------------------- | --------------------------------------------------------------------------------- |
| Tabela de estado        | `IngestionRun` — uma linha por task+region+runId                                  |
| Status persistidos      | `RUNNING`, `SUCCESS`, `ERROR`                                                     |
| Skip logic              | `shouldSkip(source, intervalHours)` → consulta `IngestionRun` por SUCCESS recente |
| Skip keys               | Formato `echotik:videos:BR`, `echotik:products:US`, etc.                          |
| Cursor intra-tarefa     | **Não existe** — se a invocação falhar no meio, reinicia da página 1              |
| Idempotência por página | Depende do upsert no banco por chave natural de cada entidade                     |

---

## 8. Observabilidade

| Aspecto            | Estado atual                                              |
| ------------------ | --------------------------------------------------------- |
| Logger             | `createLogger('echotik-cron', runId)` — logs estruturados |
| Correlação         | `runId` passado por toda a cadeia de sync                 |
| Erros de rede      | Capturados e logados; `IngestionRun` marcado como `ERROR` |
| Métricas de volume | Logadas ao final de cada sync (registros upsertados)      |
| Alertas            | Sem alerta ativo configurado por padrão                   |
| Dashboard          | Sem painel de monitoramento dedicado                      |

---

## 9. Dinâmico vs Fixo

| Aspecto             | Dinâmico             | Fixo (hardcoded)     |
| ------------------- | -------------------- | -------------------- |
| Regiões             | ✅ (tabela `Region`) | —                    |
| Intervalos          | —                    | ✅ (`types.ts`)      |
| Páginas por sync    | —                    | ✅ (`types.ts`)      |
| Rank fields         | —                    | ✅ (`rankFields.ts`) |
| Ranking cycles      | —                    | ✅ (sync files)      |
| Ordem de prioridade | —                    | ✅ (orchestrator)    |
| Schedule do cron    | —                    | ✅ (`vercel.json`)   |

---

## 10. Riscos Identificados

| Risco                            | Severidade | Observação                                                                                                           |
| -------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| Sem cursor intra-tarefa          | Médio      | Falha no meio reinicia da pg 1; dados parciais não são problemáticos por causa do upsert, mas o tempo é desperdiçado |
| Ciclo longo com muitas regiões   | Alto       | Com 10+ regiões, o ciclo completo pode ultrapassar 24 h e dados ficam defasados                                      |
| Sem alerta em falha de ingestion | Médio      | Uma task em `ERROR` é silenciosa — detectada só por consulta manual a `IngestionRun`                                 |
| Constantes não configuráveis     | Baixo      | Mudar intervalos ou volume exige deploy; sem risco imediato mas limita operação                                      |
| Product details desacoplados     | Baixo      | Lote de 5 por invocação pode ser insuficiente se houver backlog grande                                               |

---

## 11. O Que Deve Ser Preservado

- Modularidade: 1 task × 1 region por invocação (respeita o limite de 60 s do Vercel)
- Regiões lidas do banco — nunca via env var
- `IngestionRun` como registro de auditoria e base do skip logic
- Logger estruturado com `runId` como correlação
- Separação entre recepção, orquestração e execução
- Autenticação por `CRON_SECRET` no header `Authorization: Bearer`

---

## 12. Pontos a Confirmar Antes de Evoluir a Estratégia

1. **Volume de regiões esperado a médio prazo** — define se o ciclo atual (2,5 h para 3 regiões) é aceitável
2. **Tolerância a defasagem de dados** — determina se intervalos de 24 h são adequados ou precisam ser menores
3. **Necessidade de alertas** — se sim, via webhook interno, e-mail, ou integração com ferramenta de monitoramento
4. **Capacidade de tornar constantes configuráveis** — via `lib/settings.ts` ou painel admin existente
5. **Comportamento desejado em falha parcial** — reiniciar task inteira ou pular para a próxima região

---

## 13. Problemas que Justificam Evolução Futura

- **Cursor intra-tarefa**: se o sync de vídeos tem 10 páginas e falha na pg 7, as 7 páginas são re-buscadas na próxima invocação. Sem impacto em dados (upsert), mas aumenta custo de API.
- **Falta de alerta em ERROR**: falhas são silenciosas. Um mecanismo de notificação (mesmo simples) seria valioso.
- **Constantes não operáveis**: intervalos e páginas poderiam ser configuráveis via `lib/settings.ts` sem necessidade de deploy.
- **Ciclo não escalável**: com 15+ regiões, o ciclo completo ultrapassaria 24 h, tornando alguns dados permanentemente defasados.
