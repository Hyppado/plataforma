# Deploy e Migrações

## Ambientes

| Ambiente   | Branch    | Banco (Neon)   | URL               |
| ---------- | --------- | -------------- | ----------------- |
| Preview    | `develop` | Branch preview | Vercel Preview    |
| Production | `main`    | Branch prod    | Vercel Production |

Ambos os ambientes têm bancos Neon independentes, configurados via `DATABASE_URL` e `DATABASE_URL_UNPOOLED` no painel do Vercel.

---

## CI/CD

### Fluxo completo

```
Push para develop
      ↓
ci.yml — 4 jobs em sequência:
  1. typecheck   (npx tsc --noEmit + prisma generate)
  2. unit-tests  (vitest node + vitest jsdom)
  3. build       (next build)
  4. e2e-smoke   (playwright chromium)
      ↓
auto-deploy.yml (aguarda ci.yml no mesmo SHA)
      ↓
git fast-forward: main → develop
      ↓
Vercel detecta push em main → deploy Production
```

O `main` sempre aponta para o mesmo SHA que o `develop`. Não há merge commits, não há divergência.

### Configuração dos workflows

**`ci.yml`** — roda em push/PR para `develop` e `main`.

Variáveis de ambiente para o job `build`:

- Valores reais se secrets estiverem configurados no GitHub
- Fallback para valores fictícios estruturalmente válidos (ex: `ci-id`, `Y2ktaWQ6Y2...`) — suficientes para `next build` rodar sem conexão real

**`auto-deploy.yml`** — roda apenas em push para `develop`, aguarda `ci.yml` passar.

Se `develop` divergiu de `main` (ex: após hotfix em `main`), o auto-deploy falha com instruções para rebase local.

### Concorrência

O CI usa `concurrency: ci-${{ github.ref }}` com `cancel-in-progress: true` — pushes rápidos cancelam runs anteriores do mesmo branch.

---

## Vercel

### Build command

Configurado em `vercel.json`:

```
npx prisma generate && npx prisma migrate deploy && next build
```

`prisma migrate deploy` aplica migrações pendentes automaticamente em todo deploy. É idempotente: se não houver migrações pendentes, não faz nada.

### Limites

- Funções serverless: **60 segundos** por execução
- O cron de ingestão é projetado para respeitar esse limite (uma tarefa por invocação)

### Variáveis de ambiente

Configure no painel Vercel → Settings → Environment Variables, separadas por ambiente (Preview / Production):

```
DATABASE_URL
DATABASE_URL_UNPOOLED
NEXTAUTH_SECRET
NEXTAUTH_URL
ECHOTIK_USERNAME
ECHOTIK_PASSWORD
ECHOTIK_BASE_URL
CRON_SECRET
RESEND_API_KEY
BLOB_READ_WRITE_TOKEN
```

> Todas as credenciais Hotmart (client_id, client_secret, basic_token, webhook_secret) são configuradas exclusivamente pelo painel admin do Hyppado e armazenadas criptografadas no banco — **não devem estar nas variáveis de ambiente do Vercel**.

> Se `NEXTAUTH_SECRET` for rotacionado, os secrets criptografados no banco ficam ilegíveis. Executar `node scripts/reencrypt-hotmart-secrets.mjs` apontando para o banco correto antes de aplicar a nova chave.

---

## Migrações de banco

### Princípio fundamental

**Migrações devem ser sempre aditivas.** Nunca dropar, truncar ou deletar dados sem processo formal.

| Operação             | Abordagem segura                                            |
| -------------------- | ----------------------------------------------------------- |
| Adicionar coluna     | Sempre com `DEFAULT` ou nullable                            |
| Renomear coluna      | Criar nova → copiar dados → dropar antiga mais tarde        |
| Remover coluna       | Remover referências no código → deploy → confirmar → dropar |
| Mudar tipo de coluna | Criar nova com novo tipo → migrar dados → dropar a antiga   |
| Remover enum value   | Migrar dados primeiro, depois remover o valor               |

### Workflow de migration

```bash
# 1. Editar prisma/schema.prisma

# 2. Gerar arquivo SQL de migration (sem aplicar)
npx prisma migrate dev --name <descricao> --create-only

# 3. REVISAR o SQL gerado em prisma/migrations/<timestamp>_<descricao>/migration.sql
#    Verificar: não contém DROP COLUMN, DROP TABLE, DELETE, TRUNCATE não intencionais
#    Verificar: todo ADD COLUMN tem DEFAULT ou é nullable

# 4. Aplicar localmente (opcional)
npx prisma migrate dev

# 5. Commitar o arquivo SQL junto com a mudança no schema

# 6. No próximo deploy do Vercel, prisma migrate deploy aplica automaticamente
```

### Scripts npm

| Script                | Comando                 | Uso                                            |
| --------------------- | ----------------------- | ---------------------------------------------- |
| `npm run db:migrate`  | `prisma migrate dev`    | Criar + aplicar migration (desenvolvimento)    |
| `npm run db:deploy`   | `prisma migrate deploy` | Aplicar migrações pendentes (produção/preview) |
| `npm run db:status`   | `prisma migrate status` | Ver status das migrações vs banco              |
| `npm run db:generate` | `prisma generate`       | Regenerar Prisma Client                        |

### Checklist antes de commitar uma migration

- [ ] O SQL gerado foi lido e verificado
- [ ] Não contém `DROP`, `DELETE` ou `TRUNCATE` não intencionais
- [ ] Todo `ADD COLUMN` tem `DEFAULT` ou é nullable
- [ ] O arquivo SQL **não está vazio** (não rodar `--create-only` duas vezes)
- [ ] `prisma migrate dev` aplicou sem erros localmente

### Proibido

- `prisma db push` em Preview ou Production — bypassa o histórico de migrações
- `prisma migrate reset` em Preview ou Production
- Rodar `--create-only` duas vezes para a mesma migration (sobrescreve o SQL com arquivo vazio)
- Commitar migration sem revisar o SQL

### Recuperação de dados (Neon PITR)

O Neon oferece **Point-in-Time Recovery (PITR)**:

- Free: janela de 7 dias
- Paid: janela de 30 dias

Para restaurar: Neon Console → Project → Branches → branch desejada → **Restore**.

Para inspecionar dados sem afetar produção: criar uma branch a partir de um timestamp específico.

---

## Git workflow

- Desenvolvimento em `develop`
- `main` = Production (avançado automaticamente pelo auto-deploy)
- Nunca fazer push direto para `main` (exceto hotfixes críticos)
- Commits seguem conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `security:`

### Hotfix em production

```bash
git checkout main
git pull origin main
# fazer a correção
git add . && git commit -m "fix: descrição do hotfix"
git push origin main
# depois: rebase develop sobre main
git checkout develop
git rebase main
git push origin develop --force-with-lease
```

---

## Testes

### Configurações Vitest

| Config                       | Ambiente | Inclui                                    |
| ---------------------------- | -------- | ----------------------------------------- |
| `vitest.config.ts`           | node     | `__tests__/**/*.test.ts` (unitários)      |
| `vitest.component.config.ts` | jsdom    | `__tests__/components/**/*.test.{ts,tsx}` |

### Scripts

```bash
npm run test              # vitest node
npm run test:components   # vitest jsdom
npm run test:all          # ambos
npm run test:e2e          # playwright chromium
npm run test:coverage     # vitest com cobertura
```

### Obrigatório antes de commitar

```bash
npx tsc --noEmit         # zero erros de tipo
npm run build            # build de produção sem erros
npm run test:all         # todos os testes passando
```

Nenhum código com erros de tipo, falha de teste ou build quebrado deve ser commitado — sem exceções.
