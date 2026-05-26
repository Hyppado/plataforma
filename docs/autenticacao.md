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

| Tipo           | Rota                       | Mecanismo de autenticação                   |
| -------------- | -------------------------- | ------------------------------------------- |
| Webhooks       | `/api/webhooks/hotmart`    | Validação HMAC / token estático             |
| Cron           | `/api/cron/*`              | `Authorization: Bearer CRON_SECRET`         |
| NextAuth       | `/api/auth/[...nextauth]`  | Gerido internamente pelo NextAuth           |
| Reset de senha | `/api/auth/reset-password` | Público — retorna 200 sempre                |
| Setup de senha | `/api/auth/setup-password` | Público — GET valida token, POST cria senha |

**Regra de cron:** Rotas de cron verificam a variável de ambiente `VERCEL` (definida automaticamente pelo Vercel). Se ausente, retornam 403. Cron jobs nunca executam localmente.

### Sessão e JWT

O JWT usa estratégia `jwt` com `maxAge = 8 horas`. Campos carregados:

| Campo                | Tipo     | Descrição                                                          |
| -------------------- | -------- | ------------------------------------------------------------------ |
| `userId`             | string   | ID interno do usuário                                              |
| `role`               | string   | `ADMIN` \| `USER`                                                  |
| `mustChangePassword` | boolean  | Força troca de senha no próximo login                              |
| `statusCheckedAt`    | number   | Timestamp (segundos) da última verificação de status no banco      |
| `deactivated`        | boolean? | `true` quando usuário foi desativado/suspenso/deletado mid-session |

**Verificação periódica de status:** a cada 15 minutos (`STATUS_CHECK_INTERVAL`), o callback `jwt` consulta o banco para verificar `status`, `deletedAt`, `mustChangePassword` e `role`. Se o status mudou para inativo/deletado, `deactivated = true` é gravado no token. O `role` também é atualizado, então mudanças de papel (ex: USER → ADMIN) entram em vigor dentro do intervalo sem exigir novo login.

**Tokens desativados:** quando `deactivated = true`, o callback de sessão zera `session.user.id`. `requireAuth()` detecta o `userId` vazio e retorna `{ error: "Sessão expirada" }` com status 401.

`mustChangePassword = true` ativa o `PasswordChangeGuard` no dashboard, exibindo o modal `ForcePasswordChange` até o usuário trocar a senha via `PUT /api/me/password`.

### Rate limiting no login

Login é protegido contra força bruta via janela deslizante armazenada na tabela `AuditLog` — sem dependências extras.

| Parâmetro | Valor      |
| --------- | ---------- |
| Limite    | 10 falhas  |
| Janela    | 15 minutos |

Tentativas falhas são registradas com `action = "LOGIN_FAILED"` e `entityId = email` (normalizado). Emails inexistentes também geram registro para evitar enumeração de usuários por timing. Ao atingir o limite, `authorize()` lança exceção e o NextAuth redireciona para `/login?error=Muitas+tentativas.+Tente+novamente+em+15+minutos.`

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

Permite acesso sem assinatura ativa. É criado em dois cenários:

1. **Criação pelo admin** (`POST /api/admin/users`): sempre criado automaticamente junto com o usuário, em transação atômica. O grant é permanente (`expiresAt = null`), atribuído ao admin que criou (`grantedBy = auth.userId`), e retornado como `accessGrantId` no 201.
2. **Concessão manual** via painel admin: admin concede acesso a um usuário existente com motivo e expiração opcional.

Usuários com AccessGrant ativo têm acesso mesmo sem assinatura. O grant é verificado antes da assinatura na cadeia de resolução.

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

| `UsageEventType`          | Feature             | Quota do plano                                                   |
| ------------------------- | ------------------- | ---------------------------------------------------------------- |
| `TRANSCRIPT`              | Transcrição Whisper | `transcriptsPerMonth` (contagem mensal)                          |
| `SCRIPT`                  | Insight Hyppado     | `scriptsPerMonth` (contagem) + `scriptTokensMonthlyMax` (tokens) |
| `INSIGHT`                 | Insight Hyppado     | `insightTokensMonthlyMax` (tokens apenas)                        |
| `AVATAR_VIDEO_GENERATION` | Vídeo com avatar    | `avatarVideoQuota` (contagem mensal)                             |

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

### Criação de usuário pelo admin (`POST /api/admin/users`)

1. Gera senha temporária aleatória e seta `mustChangePassword = true`
2. Cria `User` e `AccessGrant` em transação atômica (`prisma.$transaction`)
3. Envia email de boas-vindas com a senha temporária
4. Retorna `{ user, accessGrantId, emailSent }` com status 201
5. Na próxima sessão do usuário criado, `PasswordChangeGuard` exibe modal de troca obrigatória
6. Após trocar, `mustChangePassword` é limpo e a sessão é recarregada

Se a transação falhar (ex: email duplicado), nenhum usuário nem grant é criado.

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
