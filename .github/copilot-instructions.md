# Copilot Instructions — Hyppado

## Produto

Hyppado é um SaaS de inteligência para TikTok Shop.
O produto ajuda usuários a encontrar vídeos, produtos e creators em alta, com recortes por região e período.
O acesso é autenticado e parte da experiência depende de assinatura/controle de acesso via Hotmart. :contentReference[oaicite:2]{index=2}

## Objetivo destas instruções

Estas instruções existem para manter consistência arquitetural, segurança, legibilidade e compatibilidade.
Antes de propor mudanças, entenda como o projeto já funciona hoje e preserve as decisões que já estão corretas.
Não introduza complexidade sem necessidade.

## Git Workflow

- Trabalhar na branch `develop`.
- Para produção, abrir PR de `develop` para `main`.
- Não fazer push direto em `main`, exceto hotfix crítico.
- Usar conventional commits:
  - `feat:`
  - `fix:`
  - `security:`
  - `refactor:`
  - `test:`
  - `chore:` :contentReference[oaicite:3]{index=3}

## Stack

- Next.js 14 com App Router
- MUI v5
- Prisma 5
- PostgreSQL com Neon em produção
- NextAuth 4
- Vitest
- Deploy na Vercel
- Integrações principais: Echotik e Hotmart :contentReference[oaicite:4]{index=4}

## Estrutura atual do projeto

- `app/`: páginas, layouts e route handlers do App Router
- `app/api/`: rotas de API
- `app/dashboard/`: área autenticada (/dashboard/\*)
- `app/components/`: componentes de UI
- `lib/`: lógica de negócio, integrações, auth, acesso, quotas e serviços
- `prisma/`: schema e seed
- `__tests__/`: testes automatizados
- `middleware.ts`: proteção de rotas
- `docs/`: documentação auxiliar :contentReference[oaicite:5]{index=5}

## Regras obrigatórias de código

- Usar sempre o singleton Prisma de `lib/prisma.ts`.
- Nunca criar `new PrismaClient()` em handlers, páginas ou serviços novos.
- Toda rota admin deve ter proteção server-side.
- Toda rota de API deve tratar erro com resposta JSON consistente.
- O idioma do código deve ser inglês:
  - variáveis
  - funções
  - tipos
  - nomes internos
- Texto de interface pode permanecer em português.
- Não usar `any` em tipos de domínio quando houver alternativa tipada.
- Preferir DTOs e tipos já existentes em `lib/types/`. :contentReference[oaicite:6]{index=6}

## Regras para API routes

- Route handlers devem ser finos.
- A lógica de negócio deve ir para `lib/<domínio>/`.
- API route não deve concentrar regra de negócio complexa.
- Sempre usar `try/catch`.
- Respostas de erro devem seguir padrão JSON com campo `error`.
- Não duplicar validação de regra de negócio na rota se ela já existir no serviço. :contentReference[oaicite:7]{index=7}

## Arquitetura — onde colocar cada coisa

- Lógica de negócio: `lib/<domínio>/`
  - exemplos: `lib/hotmart/`, `lib/usage/`, `lib/access/`, `lib/echotik/`
- Integrações externas: dentro do domínio correspondente em `lib/`
- Route handlers: `app/api/<domínio>/`
- Componentes visuais: `app/components/<categoria>/`
- Hooks compartilhados: `lib/hooks/`
- Tipos compartilhados:
  - `lib/types/dto.ts`
  - `lib/types/admin.ts`
- Configuração persistida em banco: `lib/settings.ts` e rotas/serviços correlatos :contentReference[oaicite:8]{index=8}

## Auth e acesso

- O middleware protege `/dashboard/*` e `/api/admin/*`.
- Rotas admin exigem role de admin no servidor.
- O controle de acesso é calculado em runtime.
- A cadeia de acesso atual é:
  1. status do usuário bloqueia acesso se suspenso/deletado
  2. `AccessGrant` pode conceder override
  3. assinatura ativa concede acesso
  4. fallback sem acesso
- Não persistir estado derivado de acesso se ele puder ser resolvido corretamente em runtime.
- Não criar bypass novo de autorização fora do padrão existente. :contentReference[oaicite:9]{index=9}

## Quotas e uso

- Toda lógica de quotas deve passar por `lib/usage/`.
- Não duplicar lógica de plano para limites.
- Não reimplementar cálculo de quotas em componentes, páginas ou handlers.
- Consumo de quota deve continuar idempotente.
- Se precisar alterar limites por plano, centralizar no ponto correto do domínio de usage. :contentReference[oaicite:10]{index=10}

## Integração com Echotik

- O client principal fica em `lib/echotik/client.ts`.
- A ingestão principal roda via cron.
- O cron atual existe, mas é grande demais; portanto, novas mudanças devem evitar aumentar acoplamento.
- Não misturar regra de ingestão, transformação, persistência e observabilidade no mesmo bloco quando for refatorar.
- Se adicionar comportamento novo, preferir extrair módulos em vez de crescer `cron.ts`. :contentReference[oaicite:11]{index=11}

## Integração com Hotmart

- Webhooks ficam em `/api/webhooks/hotmart`.
- O processamento fica em `lib/hotmart/processor.ts`.
- Reconciliação roda por cron dedicado.
- Notificações administrativas automáticas já existem.
- Novas mudanças em Hotmart devem preservar:
  - retry
  - auditabilidade
  - separação entre recepção do webhook e processamento
  - compatibilidade com fluxo atual de assinaturas e reconciliação. :contentReference[oaicite:12]{index=12}

## Admin

- A área admin deve continuar protegida no servidor.
- Admin é área operacional, não lugar para lógica solta de frontend.
- Novas funcionalidades administrativas devem preferir:
  - serviços em `lib/admin/` ou domínio correspondente
  - route handlers finos
  - tipagem forte
  - logs/auditoria quando fizer sentido
- Não colocar segredo administrativo no frontend.
- Não usar `localStorage` ou `sessionStorage` para armazenar segredo, token privilegiado ou credencial sensível.

## Frontend e componentes

- O frontend atual tem páginas e componentes muito grandes; não repetir esse padrão. :contentReference[oaicite:13]{index=13}
- Não criar componente novo com centenas de linhas se ele puder ser dividido.
- Preferir componentização por responsabilidade.
- Extrair partes reutilizáveis quando houver duplicação real.
- Não deixar lógica de negócio complexa dentro de componente visual.
- Se um componente crescer demais, quebrar por:
  - seção
  - card
  - tabela
  - diálogo
  - hook
  - helper de transformação

## Temas, design tokens e UI

- O projeto já usa MUI com `sx` como abordagem principal.
- Não criar novo `createTheme()` sem necessidade real.
- Não criar mais objetos `UI = { ... }` espalhados com tokens inline.
- Reutilizar o padrão existente e preparar o terreno para futura consolidação de theme/tokens.
- Manter coerência visual dark-first já existente. :contentReference[oaicite:14]{index=14}

## Data fetching no frontend

- Hoje o projeto usa `fetch()` nativo e padrão manual de `useEffect` + `useState`.
- Não introduzir biblioteca nova de dados sem motivo claro e sem alinhar com a arquitetura.
- Se precisar mexer em fetching:
  - manter tratamento de erro
  - manter loading state
  - evitar duplicação
  - considerar cache/dedup como melhoria arquitetural futura, não gambiarra local
- Não fazer fetch do próprio servidor via HTTP quando estiver em código server-side; chamar o serviço diretamente. :contentReference[oaicite:15]{index=15}

## localStorage e persistência no cliente

- `localStorage` só pode ser usado para comportamento realmente local do usuário, como itens salvos no cliente, se já fizer parte do fluxo.
- Não usar `localStorage` para:
  - segredos
  - credenciais
  - configurações críticas de sistema
  - estado que precisa ser persistido no backend
- Configuração que seja do sistema ou admin deve persistir no servidor, não apenas no navegador. :contentReference[oaicite:16]{index=16}

## Testes

- O projeto já possui suíte de testes relevante em Vitest, com 281 testes passando e thresholds por módulo. :contentReference[oaicite:17]{index=17}
- Novas mudanças em backend, auth, acesso, usage, Hotmart, admin e cron devem vir com testes.
- Novos testes devem ficar em `__tests__/` espelhando a estrutura de `lib/` ou `app/api/`.
- Usar o padrão atual com `prismaMock` quando aplicável.
- Não criar teste decorativo; testar regra real.
- Priorizar:
  - autenticação/autorização
  - acesso
  - quotas
  - webhooks
  - integrações
  - cron
  - admin
- Se alterar regra de negócio crítica, atualizar ou criar teste antes de refatorar.

## Logs e observabilidade

- `console.log` não deve ser usado como debugging solto.
- Só usar logs para eventos operacionais realmente significativos.
- Preservar auditabilidade das ações admin e eventos relevantes.
- Não vazar segredos, tokens ou payloads sensíveis nos logs.
- Quando tocar em observabilidade, preferir estrutura que facilite correlação e leitura, sem poluir código. :contentReference[oaicite:18]{index=18}

## Segurança

- Não confiar em checagem apenas de frontend.
- Toda autorização relevante deve existir no servidor.
- Não expor secrets em código cliente.
- Não criar bypass novo fora do padrão de ambiente já existente.
- Validar entradas e payloads em rotas sensíveis.
- Em integrações e cron, falhar com segurança e registrar o suficiente para diagnóstico.
- Em webhooks, preservar o comportamento do sistema atual quando ele já for deliberado para evitar reentrega indevida. :contentReference[oaicite:19]{index=19}

## Regras de organização

- Não deixar arquivo crescer sem controle.
- Não introduzir duplicação funcional.
- Não criar diretórios, helpers ou serviços “cenográficos”.
- Se algo parecer temporário, documentar ou remover; não deixar resíduo ambíguo.
- Se encontrar código morto, só remover após validar impacto.
- Mudanças devem ser incrementais e seguras.

## Anti-patterns que não podem ser repetidos

- Não criar mais objetos inline de design tokens tipo `UI = { ... }`.
- Não criar novos themes divergentes.
- Não criar componentes monolíticos com 500+ linhas.
- Não duplicar lógica de quotas.
- Não fazer fetch do próprio servidor por HTTP em contexto server-side.
- Não deixar configuração importante só em `localStorage`.
- Não aumentar arquivos já monolíticos sem extrair responsabilidade antes. :contentReference[oaicite:20]{index=20}

## Prioridades de manutenção ao mexer no projeto

Quando precisar escolher o que preservar e o que melhorar, a ordem é:

1. segurança
2. compatibilidade funcional
3. regras de acesso e quotas
4. integridade de Hotmart/Echotik/cron
5. testes
6. organização e componentização
7. melhorias cosméticas

## Validação obrigatória antes de marcar tarefa como concluída

- Nunca declarar uma tarefa como feita sem antes rodar `npm run build` e confirmar exit code 0.
- Nunca declarar uma tarefa como feita sem antes rodar `npx vitest run` e confirmar que todos os testes passam.
- Se o build ou os testes quebrarem, corrigir antes de commitar ou reportar ao usuário.
- Isso vale para qualquer mudança: refatoração, remoção de arquivos, nova feature, fix, etc.

## Como responder mudanças neste projeto

Ao implementar algo:

- primeiro entender como a área já funciona
- depois apontar impacto
- depois aplicar mudança mínima segura
- só então sugerir refatoração maior, se necessário

Ao criar código:

- preferir solução simples
- preservar convenções existentes
- não reinventar fluxo já consolidado
- evitar abstração excessiva
- evitar mock/fachada que pareça pronto sem estar pronto

## Quando refatorar

Refatorar quando houver:

- duplicação real
- risco de bug
- acoplamento excessivo
- arquivo muito grande
- baixa testabilidade
- regra duplicada em mais de um lugar

Não refatorar só por estética se isso aumentar risco sem ganho real.
