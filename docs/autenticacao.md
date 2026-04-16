# Autenticação, Acesso e Quotas

## Autenticação

O Hyppado usa **NextAuth 4.24** com provider de credenciais (email + senha com bcrypt).

### Configuração

`lib/auth.ts` contém a configuração do NextAuth e os helpers de proteção de rota:

| Helper           | Retorna                                  | Uso                          |
| ---------------- | ---------------------------------------- | ---------------------------- |
| `requireAuth()`  | `{ session, userId, role }` ou `401`     | Rotas de usuário autenticado |
| `requireAdmin()` | `{ session, userId, role }` ou `401/403` | Rotas administrativas        |
| `isAuthed(r)`    | type guard: sucesso vs resposta de erro  | Verificação de resultado     |

### Uso obrigatório

**Toda rota em `app/api/**` deve ter guarda interna de autenticação\*\*, sem exceção.

```typescript
// Rota privada padrão
const auth = await requireAuth();
if (!isAuthed(auth)) return auth; // retorna 401

// Rota admin
const auth = await requireAdmin();
if (!isAuthed(auth)) return auth; // retorna 401 ou 403
```

Nunca confiar apenas no middleware — toda rota tem sua própria guarda.

### Exceções válidas (sem sessão NextAuth)

| Tipo           | Rota                       | Mecanismo de autenticação           |
| -------------- | -------------------------- | ----------------------------------- |
| Webhooks       | `/api/webhooks/hotmart`    | Validação HMAC / token estático     |
| Cron           | `/api/cron/*`              | `Authorization: Bearer CRON_SECRET` |
| NextAuth       | `/api/auth/[...nextauth]`  | Gerido internamente pelo NextAuth   |
| Reset de senha | `/api/auth/reset-password` | Público — retorna 200 sempre        |

**Regra de cron:** Rotas de cron verificam a variável de ambiente `VERCEL` (definida automaticamente pelo Vercel). Se ausente, retornam 403. Cron jobs nunca executam localmente.

### Sessão e JWT

O JWT do NextAuth carrega `userId`, `role` e `mustChangePassword`. O callback de sessão propaga esses campos para o cliente.

`mustChangePassword = true` ativa o `PasswordChangeGuard` no dashboard, exibindo o modal `ForcePasswordChange` até o usuário trocar a senha via `PUT /api/me/password`.

---

## Controle de acesso

### Cadeia de resolução de acesso

`lib/access/resolver.ts` → `resolveAccess(userId)`:

```
1. Status do usuário bloqueado? (SUSPENDED, deleted) → sem acesso
2. AccessGrant ativo? → acesso garantido
3. Subscription ativa? → acesso garantido
4. Fallback → sem acesso
```

O acesso é **sempre resolvido em runtime**. Nenhum estado derivado é persistido.

### AccessGrant

Concedido manualmente por admin via painel. Permite acesso sem assinatura ativa (ex: usuários de teste, parceiros, suporte).

### Middleware

`middleware.ts` protege `/dashboard/*` e `/api/admin/*` na camada de roteamento. Complementar às guardas internas — não as substitui.

---

## Quotas e uso

### Visão geral

Quotas são definidas por plano e consumidas por período mensal. Toda lógica de quota está em `lib/usage/`.

| Módulo       | Responsabilidade                       |
| ------------ | -------------------------------------- |
| `quota.ts`   | Resolução da quota do usuário          |
| `period.ts`  | Gestão do período de uso corrente      |
| `consume.ts` | `consumeUsage()` — registra consumo    |
| `enforce.ts` | `enforceQuota()` — verifica e bloqueia |

### Tipos de consumo

| `UsageEventType` | Feature             | Quota do plano    |
| ---------------- | ------------------- | ----------------- |
| `TRANSCRIPT`     | Transcrição Whisper | `transcriptQuota` |
| `SCRIPT`         | Insight Hyppado     | `scriptQuota`     |

### Regras importantes

- Quota é consumida apenas para **novas** transcrições/insights, não para reuso
- Consumo é **idempotente** — mesma chave de evento não é contada duas vezes
- Transcrições são globais (uma por vídeo, compartilhada) — apenas o primeiro usuário que solicita consome quota
- Insights são por usuário — cada usuário tem sua própria quota por vídeo
- Não duplicar lógica de quota em componentes, páginas ou handlers

---

## Fluxo de senha e onboarding

### Criação de senha (novo usuário)

```
Admin cria usuário / Hotmart PURCHASE_APPROVED
      ↓
sendOnboardingEmail({ userId })
      ↓
generateSetupToken(userId, 24h)  →  hash salvo em User.setupToken
      ↓
Email com link: /criar-senha?token=<raw>
      ↓
GET /api/auth/setup-password?token=  →  valida token
POST /api/auth/setup-password { token, password }  →  seta senha + limpa token
```

### Reset de senha (usuário existente)

```
/recuperar  →  POST /api/auth/reset-password { email }  →  sempre retorna 200
      ↓
sendPasswordResetEmail({ email })
      ↓
generateSetupToken(userId, 1h)  →  hash salvo em User.setupToken
      ↓
Email com link: /criar-senha?token=<raw>
      ↓
(mesma página /criar-senha, mesmo fluxo de validação)
```

**Propriedades de segurança:**

- Apenas o hash SHA-256 é armazenado — token bruto existe só no email
- Uso único (limpo na primeira utilização)
- Expiração configurável (24h onboarding, 1h reset)
- Mensagens sempre genéricas — sem enumeração de usuário/email
- Senha mínima: 8 caracteres (validado no servidor)

### Senha temporária (admin)

Admin pode resetar a senha de um usuário via `POST /api/admin/users/[id]`:

1. Gera senha temporária e seta `mustChangePassword = true`
2. Envia email com a senha temporária
3. Na próxima sessão, `PasswordChangeGuard` exibe modal de troca obrigatória
4. Após trocar, `mustChangePassword` é limpo e a sessão é recarregada

---

## Segurança

### Regras gerais

- Comparação de secrets: sempre `timingSafeEqual` (módulo `crypto` nativo) — nunca `===`
- Fail closed: se um secret necessário não estiver configurado, a operação é rejeitada
- Erros nunca revelam parte do secret (prefixo, tamanho, hash)
- CORS: não adicionar `Access-Control-Allow-Origin: *` em rotas autenticadas
- Inputs e payloads de rotas sensíveis devem ser validados no servidor
- Secrets: nunca no código cliente, nunca em `localStorage`

### Proteção dupla

Tanto o middleware quanto a guarda interna devem estar presentes para rotas protegidas. Eles são complementares:

| Camada         | Cobre                                                       |
| -------------- | ----------------------------------------------------------- |
| Middleware     | Bloqueia na borda (routing), `/dashboard/*`, `/api/admin/*` |
| Guarda interna | Verifica em runtime dentro de cada handler                  |

---

## LGPD

- `ConsentRecord` — log append-only de consentimentos
- `DataErasureRequest` — rastreamento de solicitações de exclusão de dados
- `lib/lgpd/erasure.ts` — lógica de exclusão

Ao excluir um usuário: soft delete ou exclusão em cascata com limpeza completa, dependendo do estado (usuário sem assinatura pode ser excluído; assinante ativo é apenas desativado).
