# Copilot Instructions — Hyppado

## Git Workflow

- **Sempre commitar na branch `develop`.**
- Para levar mudanças para produção: abrir PR de `develop` → `main` e fazer merge.
- **Nunca fazer push direto em `main` (produção)**, a não ser que seja extremamente necessário (hotfix crítico).
- Commits devem seguir conventional commits: `feat:`, `fix:`, `security:`, `refactor:`, `test:`, `chore:`.

## Stack

- Next.js 14 (App Router), Prisma 5, PostgreSQL (Neon em prod), Vitest, NextAuth 4
- Banco: apenas `DATABASE_URL` (pooled) e `DATABASE_URL_UNPOOLED` (direct/migrations)
- Deploy: Vercel (develop → preview, main → production)

## Código

- Usar o singleton Prisma de `lib/prisma.ts` — nunca `new PrismaClient()` em arquivos de app
- Rotas admin: `requireAdmin()` + `isAuthed()` guard
- Testes: Vitest com `prismaMock` de `@tests/helpers/prisma-mock`
- Idioma do código: inglês (variáveis, funções, tipos). Comentários e mensagens UI: português.
