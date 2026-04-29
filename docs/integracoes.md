# Integrações

## Echotik (TikTok Shop)

### Visão geral

A Echotik é a fonte primária de dados do Hyppado. Todos os dados de vídeos, produtos e creators vêm da API Echotik, ingeridos pelo cron e armazenados no banco. **Nenhuma rota voltada ao usuário chama a API Echotik diretamente.**

### Arquivos principais

| Arquivo                                 | Responsabilidade                                      |
| --------------------------------------- | ----------------------------------------------------- |
| `lib/echotik/client.ts`                 | HTTP client (`echotikRequest`)                        |
| `lib/echotik/cron/orchestrator.ts`      | `detectNextTask()` — determina próxima tarefa do cron |
| `lib/echotik/cron/syncVideos.ts`        | Ingestão de vídeos por região                         |
| `lib/echotik/cron/syncProducts.ts`      | Ingestão de produtos por região                       |
| `lib/echotik/cron/syncCreators.ts`      | Ingestão de creators por região                       |
| `lib/echotik/cron/syncCategories.ts`    | Ingestão de categorias                                |
| `lib/echotik/cron/uploadImages.ts`      | Upload de imagens para Vercel Blob                    |
| `lib/echotik/cron/cacheDownloadUrls.ts` | Cache de URLs de download de vídeo                    |
| `lib/echotik/cron/cleanupOrphans.ts`    | Limpeza de blobs e linhas órfãs                       |
| `app/api/cron/echotik/route.ts`         | Endpoint do cron (aceita `?task=&region=&force=`)     |

### Fluxo de ingestão

```
Vercel Cron → GET /api/cron/echotik
                    ↓
             detectNextTask()
               ↓ retorna { task, region }
   syncVideoRanklist(runId, region)
   syncProductRanklist(runId, region)
   syncCreatorRanklist(runId, region)
   uploadPendingImages()
   cachePendingDownloadUrls()
   cleanupOrphanedBlobs()
```

Cada invocação processa **uma tarefa** dentro do limite de 60s do Vercel. O orchestrator usa skip keys para garantir que cada tarefa seja processada uma vez por ciclo.

### Sequência de prioridade do orchestrator

1. Categorias (uma vez)
2. Vídeos — uma região por vez (BR, US, JP, ...)
3. Produtos — uma região por vez
4. Creators — uma região por vez
5. `upload-images` — une uploads pendentes
6. `cache-download-urls` — pré-busca URLs de download
7. `cleanup-orphans` — uma vez por 24h

### Regra crítica

`echotikRequest` de `lib/echotik/client.ts` só pode ser chamado por:

- Módulos de ingestão em `lib/echotik/cron/`
- Cron de upload de imagens
- Cron de cache de download URLs
- Proxy de imagem `app/api/proxy/` (fallback deprecado)
- Transcrição `lib/transcription/media.ts` (fallback — quando URL cacheada não está disponível)

**Nunca** usar `echotikRequest` em rotas voltadas ao usuário.

### Imagens

Imagens são armazenadas no Vercel Blob (`@vercel/blob`). Rotas de trending servem `blobUrl`/`avatarBlobUrl` quando disponíveis, com fallback para o proxy.

### Regiões

Regiões vêm exclusivamente da tabela `Region` no banco. Nunca de variáveis de ambiente. Fallback para `["BR", "US", "JP"]` se o banco retornar vazio.

---

## Hotmart

### Visão geral

O Hotmart é a plataforma de pagamentos. O Hyppado recebe eventos via webhook e provisiona/cancela assinaturas automaticamente.

### Credenciais

Credenciais são armazenadas **exclusivamente no banco** (tabela `Setting`) com valores sensíveis criptografados (AES-256-GCM). São gerenciadas pelo painel admin em `CredentialsCard`.

Resolução via `getHotmartConfig()` em `lib/hotmart/config.ts` — sem fallback para variáveis de ambiente. Se qualquer credencial estiver ausente no banco, a operação falha com erro explícito.

**Chave de criptografia:** derivada do `NEXTAUTH_SECRET` via SHA-256 (32 bytes). Se `NEXTAUTH_SECRET` for trocado, os secrets no banco ficam ilegíveis — executar `node scripts/reencrypt-hotmart-secrets.mjs` para re-criptografar com a nova chave.

`getSecretSetting()` trata erros de descriptografia com try/catch — retorna `null` em vez de lançar exceção, permitindo que `getHotmartConfig()` produza uma mensagem de erro clara.

### Webhook

Endpoint: `POST /api/webhooks/hotmart`

**Validação:** token estático `X-Hotmart-Hottok` comparado com `timingSafeEqual`. Fail closed: se o secret não estiver configurado **no banco**, a requisição é rejeitada com 500.

**Idempotência:** dedup por `idempotencyKey` (SHA-256 determinístico). Eventos duplicados retornam 200 sem reprocessamento.

### PURCHASE_APPROVED — Provisionamento principal

Fluxo de provisionamento ao receber `PURCHASE_APPROVED`:

1. Resolve ou cria usuário + `ExternalAccountLink`
2. Reactiva usuário INACTIVE (SUSPENDED permanece para revisão admin)
3. Resolve plano via `getProvisioningPlan(fields)` — match por `planCode` → fallback para primeiro plano ativo
4. Upsert `Subscription` + `HotmartSubscription` com status ACTIVE
5. Upsert `SubscriptionCharge` com status PAID
6. Acesso é runtime-driven (`resolveAccess()`) — nenhum estado derivado persistido
7. Audit log: `WEBHOOK_PURCHASE_APPROVED` (primeira compra) ou `WEBHOOK_PURCHASE_RENEWED`
8. Notificação admin: `SUBSCRIPTION_ACTIVATED` (apenas primeira compra)
9. Email de onboarding: apenas nova conta, não renovação (`.catch()` protegido)

**Renovação:** `recurrenceNumber > 1` = renovação.

### SUBSCRIPTION_CANCELLATION — Cancelamento definitivo

Fluxo ao receber `SUBSCRIPTION_CANCELLATION`:

1. Resolve identidade via subscriber email/code (sem bloco `buyer`)
2. Resolve plano
3. Upsert subscription com status CANCELLED
4. Define `cancelledAt` e `endedAt` = data de cancelamento do evento
5. Usuário **não** é deletado nem suspenso — apenas o status da assinatura muda
6. Audit log: `WEBHOOK_SUBSCRIPTION_CANCELLATION`
7. Notificação admin: `SUBSCRIPTION_CANCELLATION` (severity: WARNING)

### Eventos de revogação imediata

Alguns eventos revogam o acesso imediatamente (sem período de graça), definindo `endedAt = occurredAt`:

- `PURCHASE_REFUNDED`
- `PURCHASE_CHARGEBACK`
- `SUBSCRIPTION_CANCELLATION` com motivo de cancelamento administrativo (`CANCELLED_BY_ADMIN`)

Os demais cancelamentos preservam `endedAt` original (fim do período pago).

### Planos e sincronização

`lib/hotmart/plans.ts` gerencia a sincronização:

- `listPlansForProduct()` — busca planos do produto na API Hotmart
- `syncPlansFromHotmart()` — cria/atualiza planos locais (quotas não são sobrescritas)
- `resolveOrSyncPlan(planCode)` — encontra plano local por `hotmartPlanCode`, sincroniza se não existir

**Regra:** Quotas (`transcriptQuota`, `scriptQuota`) são locais. Só alteradas pelo admin. Nunca sobrescritas pela sincronização.

**Produto configurado:** a sincronização usa o `HOTMART_PRODUCT_ID` salvo no banco para buscar o `ucode` do produto e listar apenas os planos desse produto. Planos de outros produtos nunca entram no banco.

---

## Email transacional (Resend)

### Visão geral

Emails são enviados via Resend. O cliente está em `lib/email/client.ts`.

- Remetente: `Hyppado <suporte@hyppado.com>`
- Reply-To: `suportehyppado@gmail.com`
- Sem `RESEND_API_KEY`: degrada graciosamente (retorna `{success: false}`)

### Templates

| Template                    | Uso                                        |
| --------------------------- | ------------------------------------------ |
| `buildOnboardingEmail`      | Novo usuário — link para criar senha (24h) |
| `buildPasswordResetEmail`   | Reset de senha — link para redefinir (1h)  |
| `buildWelcomePasswordEmail` | Senha temporária enviada por admin         |

Todos os templates usam `wrapTemplate()` para layout consistente. XSS-safe via `escapeHtml`.

### Tokens de setup/reset

`lib/email/setup-token.ts` gerencia tokens seguros:

- Geração: 32 bytes aleatórios, base64url → apenas o **hash SHA-256** é salvo no banco
- Expiração: 24h (onboarding), 1h (reset)
- Uso único: token é consumido (limpo) na primeira utilização
- Nunca há enumeração de email — resposta sempre genérica

### Pontos de disparo

| Evento                             | Email enviado            |
| ---------------------------------- | ------------------------ |
| `PURCHASE_APPROVED` (novo usuário) | Onboarding (criar senha) |
| Admin cria usuário (`sendEmail`)   | Onboarding (criar senha) |
| Admin reseta senha                 | Senha temporária         |
| Usuário solicita reset             | Reset de senha           |

---

## OpenAI

### Transcrição (Whisper)

`lib/transcription/whisper.ts` → OpenAI Whisper API.

Pipeline: URL Echotik cacheada → download do buffer → Whisper → verificação de alucinação → salva no banco.

Alucinação: outputs do tipo "apenas música" são detectados e rejeitados.

### Insight Hyppado

`lib/insight/generate.ts` → OpenAI Chat Completions com output estruturado.

Input: texto da transcrição + template de prompt (configurável pelo admin).

Output: `contexto`, `gancho`, `problema`, `solução`, `CTA`, `roteiro reutilizável`.

### Geração de conceito de vídeo (Chat Completions)

`lib/avatar-video/concept.ts` → OpenAI Chat Completions (`gpt-4o`).

Gera o conceito inicial do vídeo UGC a partir de dados do produto + imagens de referência já geradas. Retorna estrutura JSON validada. Timeout: 60s.

**Dados usados na geração:**

| Campo                                   | Origem                                                    |
| --------------------------------------- | --------------------------------------------------------- |
| `productName`                           | `AvatarVideoCreation.productName`                         |
| `productCategory`                       | `AvatarVideoCreation.productCategory`                     |
| `productPriceCents` + `productCurrency` | `AvatarVideoCreation`                                     |
| `tone`                                  | `AvatarVideoCreation.tone`                                |
| `duration`                              | `AvatarVideoCreation.duration`                            |
| `takeCount`                             | `AvatarVideoCreation.takeCount` (padrão: 1)               |
| `customScenarioDescription`             | `AvatarVideoCreation.customScenarioDescription`           |
| URLs das imagens geradas                | `AvatarVideoImageVariation.blobUrl` (apenas status READY) |

**Nota:** avatar, cenário/`promptHint`, descrição do produto, especificações e payload `extra` do Echotik **não** são passados diretamente ao conceito — a IA recebe o snapshot desnormalizado em `AvatarVideoCreation` e as URLs de blob das variações de imagem.

**Output (JSON validado pela lib):**

| Campo       | Tipo           | Descrição                                                                     |
| ----------- | -------------- | ----------------------------------------------------------------------------- |
| `videoIdea` | string         | Resumo da ideia geral do vídeo (obrigatório)                                  |
| `hook`      | string         | Frase de abertura (em português, obrigatório)                                 |
| `copy`      | string         | Roteiro/copy principal (em português)                                         |
| `cta`       | string         | Call-to-action (em português)                                                 |
| `scenes`    | ConceptScene[] | N cenas — `sceneNumber`, `goal`, `description` (obrigatório, N = `takeCount`) |

**Validação de campos:** `videoIdea`, `hook` e `scenes` são obrigatórios — se ausentes ou mal formados, a geração falha com `FAILED` e a mensagem de erro é persistida em `AvatarVideoConcept.errorMessage`.

**Persistência:** Upsert em `AvatarVideoConcept` (1:1 por criação). Status: `PROCESSING` → `READY` ou `FAILED`. Regeneração é permitida quando status da criação é `CONCEPT_READY` — sobrescreve o conceito anterior.

**Template de sistema:** configurável pelo admin via `avatar_video.concept_template` (`getSetting`). Quando ausente, usa o prompt embutido na lib (em português).

### Geração de imagem de referência (gpt-image-1)

`lib/avatar-video/image-prompt.ts` → OpenAI Images API (`gpt-image-1`).

Gera **2 variações de imagem** de referência por criação, em paralelo. Cada variação passa por:

1. `buildImagePromptText()` — monta prompt em inglês, category-aware (ver abaixo)
2. Download em paralelo das imagens de referência: avatar e produto (timeout 15s cada)
3. Se referências disponíveis: `POST /v1/images/edits` (multipart, `gpt-image-1`) com `image[]` para grounding visual
4. Se referências indisponíveis: `POST /v1/images/generations` (JSON, fallback texto-only)
5. Resultado decodificado (base64) e enviado ao Vercel Blob
6. `AvatarVideoImageVariation.blobUrl` atualizado; status → `READY` ou `FAILED`

**Imagens de referência usadas:**

| Referência      | Origem                                                                   |
| --------------- | ------------------------------------------------------------------------ |
| Avatar (pessoa) | `AvatarVideoCreation.uploadedAvatarImageUrl` ou `AvatarProfile.imageUrl` |
| Produto         | `AvatarVideoCreation.productSelectedImageUrl`                            |

**Prompt builder — placement category-aware (`buildImagePromptText`):**

| Categoria detectada        | Instrução de placement                                    |
| -------------------------- | --------------------------------------------------------- |
| Roupa / moda               | Pessoa vestindo o produto (mesmo corte/cor/estampa)       |
| Acessório / joia / bolsa   | Pessoa usando ou carregando o acessório                   |
| Beleza / cosmético         | Pessoa segurando o produto próximo ao rosto               |
| Tecnologia / eletrônicos   | Pessoa usando o dispositivo naturalmente                  |
| Alimento / bebida          | Pessoa segurando ou apresentando o produto                |
| Casa / cozinha / decoração | Produto no ambiente; pessoa gesticulando em direção a ele |
| Outros                     | Pessoa segurando e apresentando o produto à câmera        |

O cenário (`VideoScenario.promptHint` ou `customScenarioDescription`) define o ambiente (setting). Formato: vertical 9:16, iluminação natural, sem overlays.

**Nota:** O conceito gerado na etapa anterior **não** é usado como entrada para a geração de imagem — a imagem é construída exclusivamente a partir dos dados do produto, avatar e cenário via prompt de texto.

**Parâmetros fixos:** `size: "1024x1024"`, `quality: "medium"`, `n: 1`. Timeout: 110s.

**Quota:** consumida (`AVATAR_VIDEO_GENERATION`) após ambas as variações serem geradas com sucesso (ver seção Quota abaixo).

### Geração de prompt VEO 3 (Chat Completions)

`lib/avatar-video/veo-prompt.ts` → OpenAI Chat Completions (`gpt-4o`).

Gera prompt estruturado (`Veo3Prompt`) para VEO 3, incluindo takes com direção de câmera, direção visual e falas. Timeout: 60s.

**Dados usados na geração:**

| Campo                    | Origem                                                    |
| ------------------------ | --------------------------------------------------------- |
| `productName`            | `AvatarVideoCreation.productName`                         |
| `productCategory`        | `AvatarVideoCreation.productCategory`                     |
| Preço                    | `productPriceCents` + `productCurrency`                   |
| Avatar                   | `AvatarProfile.name` + `description`                      |
| Cenário                  | `VideoScenario.name`, `description`, `promptHint`         |
| `tone`                   | `AvatarVideoCreation.tone`                                |
| `duration`               | `AvatarVideoCreation.duration`                            |
| `takeCount`              | `AvatarVideoCreation.takeCount`                           |
| URLs das imagens geradas | `AvatarVideoImageVariation.blobUrl` (status READY)        |
| Conceito aprovado        | `AvatarVideoConcept` (videoIdea, hook, copy, cta, scenes) |

O conceito (etapa anterior) é incluído como "direção criativa" — cada cena do conceito é traduzida para um take VEO 3 com `cameraDirection` e `visualDirection` em inglês e `spokenLines` em português (PT-BR). Duração máxima por take: 8 segundos.

**Output (`Veo3Prompt`):**

| Campo         | Tipo       | Descrição                                                              |
| ------------- | ---------- | ---------------------------------------------------------------------- |
| `prompt`      | string     | Descrição geral do vídeo em inglês                                     |
| `duration`    | number     | Duração total em segundos (`takeCount × 8`)                            |
| `aspectRatio` | string     | `"9:16"`                                                               |
| `style`       | string     | `"ugc"`                                                                |
| `language`    | string     | `"pt-BR"`                                                              |
| `takes`       | Veo3Take[] | N takes — `index`, `cameraDirection`, `visualDirection`, `spokenLines` |
| `metadata`    | object?    | Opcional                                                               |

**Persistência:** Upsert em `AvatarVideoPrompt` (1:1 por criação). `promptJson` = objeto `Veo3Prompt` completo (com todos os takes). `promptText` = **apenas** o campo `prompt` (visão geral textual) do `Veo3Prompt` — **não** é o JSON serializado completo. Regeneração permitida quando status é `PROMPT_READY` — sobrescreve o prompt anterior.

**Edição manual:** o usuário pode editar `promptText` via `PATCH /edit-prompt`; `isEdited = true` e `editedAt` são persistidos.

**Template de sistema:** configurável via `avatar_video.prompt_template` (`getSetting`). Quando ausente, usa o prompt embutido.

### Geração de prompt VEO 3.1 — Influencer IA (Chat Completions)

`lib/influencer-ia/veo-prompt.ts` → OpenAI Chat Completions (`gpt-4o`).

Gera `N` prompts estruturados em inglês para VEO 3.1 com base em: nome do produto, categoria, estilo de vídeo (`ugc` / `unboxing` / `review` / `tutorial` / `testemunho`) e duração (`short` = 2 partes / `medium` = 4 partes / `full` = 8 partes). Cada parte descreve exatamente 8 segundos de conteúdo vertical (9:16) com direção de câmera, ação visual e falas em PT-BR.

Endpoint: `POST /api/influencer-ia/generate-veo-prompt`

Se a IA retornar menos partes do que o esperado, o sistema preenche o restante com fallbacks determinísticos para que a resposta tenha sempre o número correto de partes.

### Chave da API (OpenAI)

Armazenada criptografada no banco via painel admin (OpenAITab). Nunca enviada ao browser. Resolução em runtime via `getSetting` / `getSecretSetting`.

---

## Vídeo com Avatar — fluxo completo

### Visão geral

O fluxo de **Vídeo com Avatar** é um wizard guiado multi-etapa que produz:

1. Imagens de referência UGC (avatar + produto)
2. Conceito de vídeo (hook, copy, CTA, cenas) — gerado por IA
3. Prompt estruturado VEO 3 (takes com direção de câmera, visual e falas) — gerado por IA

O Hyppado não executa a geração do vídeo final. O usuário recebe as imagens e o prompt para produzir o vídeo em VEO 3.

### Fluxo de estados (`AvatarVideoCreationStatus`)

```
DRAFT
  ↓ (produto + avatar + cenário configurados)
  → POST /generate-image
PENDING_IMAGES
  ↓
IMAGES_READY
  → (usuário revisa e opcionalmente seleciona variação preferida)
  → POST /generate-concept
PENDING_CONCEPT
  ↓
CONCEPT_READY
  → (usuário revisa e opcionalmente edita o conceito)
  → POST /generate-prompt
PENDING_PROMPT
  ↓
PROMPT_READY
  → (usuário revisa e opcionalmente edita o prompt)
  → POST /complete
COMPLETED

(qualquer etapa pode → FAILED em erro irrecuperável)
```

### Etapas do wizard (componentes)

| Componente               | Etapa | Status esperado              |
| ------------------------ | ----- | ---------------------------- |
| `StepProductConfirm.tsx` | 1     | DRAFT                        |
| `StepAvatarSelect.tsx`   | 2     | DRAFT                        |
| `StepScenarioSelect.tsx` | 3     | DRAFT                        |
| `StepImageGenerate.tsx`  | 4     | DRAFT / IMAGES_READY         |
| `StepConceptEdit.tsx`    | 5     | IMAGES_READY / CONCEPT_READY |
| `StepPromptEdit.tsx`     | 6     | CONCEPT_READY / PROMPT_READY |
| `StepDelivery.tsx`       | 7     | COMPLETED                    |

### Quota (`AVATAR_VIDEO_GENERATION`)

- **Verificação:** `assertAvatarVideoQuota(userId)` — chamada **antes** do início da geração de imagens (etapa 4). Lança `QuotaExceededError` se o limite mensal foi atingido.
- **Consumo:** `consumeAvatarVideoQuota(userId, creationId)` — chamada **após** ambas as imagens serem geradas com sucesso.
- **Idempotência:** a chave de idempotência é `"avatar-video:<creationId>"`. Regenerar imagens dentro da mesma criação **não** consome um crédito adicional.
- **Regeneração de conceito:** não verifica nem consome quota.
- **Regeneração de prompt:** não verifica nem consome quota.
- **Configuração:** `Plan.avatarVideoQuota` — definido pelo admin no painel (PlansCard em HotmartTab).
- **Exibição ao usuário:** via hook `useUserQuota` → `GET /api/usage` (quota disponível no cabeçalho do wizard).

### Configuração admin

| Item                            | Como configurar                                             |
| ------------------------------- | ----------------------------------------------------------- |
| Avatares disponíveis            | Admin → aba Avatar Video → gerenciar `AvatarProfile`        |
| Cenários disponíveis            | Admin → aba Avatar Video → gerenciar `VideoScenario`        |
| Chave OpenAI                    | Admin → OpenAI tab → `openai.api_key` (criptografado)       |
| Template de conceito            | Admin → prompt-config → `avatar_video.concept_template`     |
| Template de prompt VEO 3        | Admin → prompt-config → `avatar_video.prompt_template`      |
| Quota por plano                 | Admin → Hotmart tab → PlansCard → `avatarVideoQuota`        |
| Chave Google AI (Influencer IA) | Admin → Google AI tab → `google_ai.api_key` (criptografado) |

### Diferença: Vídeo com Avatar × Influencer IA

| Dimensão                      | Vídeo com Avatar                                   | Influencer IA                                                 |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| Objetivo                      | Wizard guiado → imagens + conceito + prompt VEO 3  | Geração direta de imagem UGC de alta qualidade                |
| Modelo de imagem              | OpenAI `gpt-image-1` (Images edits API)            | Google Gemini (`gemini-3.1-flash-image-preview`)              |
| Conceito de vídeo             | Sim — `gpt-4o` gera hook, copy, CTA, cenas         | Não                                                           |
| Prompt VEO                    | VEO 3 (takes estruturados, editáveis pelo usuário) | VEO 3.1 (partes de 8s, via `lib/influencer-ia/veo-prompt.ts`) |
| Quota                         | Sim — `AVATAR_VIDEO_GENERATION` (por imagem)       | Não — acesso universal para assinantes                        |
| Entrada de produto            | Produto de trending selecionado (snapshot no DB)   | Produto de trending ou upload direto                          |
| Entrada de avatar             | `AvatarProfile` do banco ou upload do usuário      | `AvatarProfile` do banco ou upload do usuário                 |
| Modelos/lógica compartilhados | `AvatarProfile`, `lib/storage/blob.ts`             | `AvatarProfile`, `lib/storage/blob.ts`                        |
| Fluxo                         | Wizard multi-passo (página dedicada)               | Painel lateral wizard (página dedicada)                       |
| Rota frontend                 | `/dashboard/avatar-video/[id]`                     | `/dashboard/influencer-ia`                                    |

### Lacunas conhecidas / próximas implementações

As seguintes lacunas foram confirmadas na inspeção do código-fonte:

1. **`StepPromptEdit`** — o editor de takes está implementado por take (um card por take, cada um com um textarea JSON). O `promptText` salvo no banco é **apenas o texto de visão geral** (`parsed.prompt` — campo `prompt` do `Veo3Prompt`); o objeto completo com todos os takes fica em `promptJson`. Após edição pelo usuário, `promptText = updatedJson.prompt || copyAllText` e `promptJson` = `Veo3Prompt` completo com takes editados.
2. **`StepDelivery`** — exibe o VEO 3 prompt como JSON copiável, mas **não** exibe o copy (falas) take a take de forma destacada — a entrega não separa visualmente hook, copy por take e CTA.
3. **Concept stage não usa** `productDescription`, `productSpecifications` nem `EchotikProductDetail.extra` — apenas o snapshot denormalizado em `AvatarVideoCreation`.
4. **UI de quota** — a verificação de quota existe no backend, mas não há feedback visual claro de "X de Y gerações usadas" diretamente no wizard (depende do cabeçalho genérico de quota).

---

## Google AI Studio (Gemini)

### Visão geral

Usado exclusivamente pela feature **Influencer IA** para gerar imagens UGC ultra-realistas combinando imagem de avatar + imagem de produto.

### Arquivos principais

| Arquivo                                   | Responsabilidade                                   |
| ----------------------------------------- | -------------------------------------------------- |
| `lib/influencer-ia/generate.ts`           | `generateInfluencerImage()` — orquestra geração    |
| `app/api/influencer-ia/generate/`         | Endpoint POST — auth, parse body, chama lib        |
| `app/api/influencer-ia/product-images/`   | Endpoint GET — retorna URLs de variação do produto |
| `app/api/influencer-ia/upload-reference/` | Endpoint POST — upload de referências (Blob)       |

### Fluxo de geração

```
Browser → POST /api/influencer-ia/generate
             ↓
         requireAuth()
             ↓
         [opcional] prisma.avatarProfile.findUnique(avatarId)
             ↓
         generateInfluencerImage(input)
             ↓  buildPrompt() — prompt em inglês com pose / env / style / enhancements
             ↓  fetchImageBuffer(avatarUrl)  — download com timeout 15s
             ↓  fetchImageBuffer(productUrl) — download com timeout 15s
             ↓  generateWithGemini(apiKey, modelId, prompt, avatarBuf, productBuf)
             ↓  uploadBufferToBlob() → Vercel Blob
             ↓
         { imageUrl: string }  ← URL pública do Blob
```

### Prompt builder (category-aware)

O `buildPrompt()` detecta a categoria do produto e ajusta a instrução de placement:

| Categoria detectada | Instrução de placement             |
| ------------------- | ---------------------------------- |
| Roupa / moda        | `IS WEARING` — garment focal point |
| Acessório / joia    | `wearing or carrying`              |
| Beleza / cosmético  | `holding near face`                |
| Outros              | `holding and presenting`           |

### Modelo configurável

O modelo padrão é `gemini-3.1-flash-image-preview`. Pode ser sobrescrito via `GOOGLE_AI_MODEL` na tabela `Setting` (painel admin). A resolução é feita em runtime em cada chamada.

### Chave da API

Armazenada criptografada no banco via painel admin. Resolução via `getSecretSetting(SETTING_KEYS.GOOGLE_AI_API_KEY)`. Fail closed: se ausente, a geração lança `"Chave Google AI Studio não configurada"` e retorna HTTP 500.

### Sem quota

A geração de imagem via Influencer IA não consome quota — acesso universal a usuários autenticados com assinatura ativa (via `resolveAccess`).
