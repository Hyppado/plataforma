# Hyppado — Project Brief

> Documento de referência para desenvolvimento e prompts futuros.  
> Última atualização: Fevereiro 2026

---

## 1. Visão Geral do Produto

**Hyppado** é um web app de inteligência de tendências para o TikTok Shop Brasil, focado em permitir que criadores de conteúdo, afiliados e vendedores descubram rapidamente vídeos virais, produtos em alta e creators de sucesso. O dashboard prioriza a visualização imediata dos "Top 10 Vídeos em Alta" com thumbnails, seguido por rankings de produtos e creators, tudo com filtros de período e categoria. A fonte de dados é o banco de dados PostgreSQL, populado automaticamente via cron job (EchoTik API).

---

## 2. Público-Alvo e Casos de Uso

### Público-Alvo

| Persona                  | Descrição                                                |
| ------------------------ | -------------------------------------------------------- |
| **Afiliado TikTok Shop** | Busca produtos com alta conversão para promover          |
| **Criador de Conteúdo**  | Quer identificar formatos de vídeo que estão viralizando |
| **Seller / Marca**       | Monitora concorrentes e descobre creators para parcerias |
| **Agência de Marketing** | Pesquisa tendências para estratégias de clientes         |

### Casos de Uso Principais

1. **Descobrir vídeos virais** — Ver os Top 10 vídeos com mais receita/vendas nos últimos 7/30/90 dias
2. **Encontrar produtos em alta** — Ranking de produtos por revenue, vendas ou taxa de comissão
3. **Identificar creators de sucesso** — Lista de top creators por receita e engajamento
4. **Salvar e organizar** — Favoritar vídeos/produtos, criar coleções, adicionar notas
5. **Receber alertas** — Notificações de novos produtos ou picos de tendência

---

## 3. Estrutura do App (Mapa de Rotas)

```
/                       → Landing page (público)
/login                  → Autenticação
/app                    → Dashboard principal (home pós-login)
/app/videos             → Lista completa de vídeos com filtros
/app/produtos           → Lista completa de produtos com filtros
/app/creators           → Lista completa de creators com filtros
/app/tendencias         → Análise de tendências e gráficos (futuro)
/app/settings           → Configurações da conta (futuro)
```

### Estrutura de Pastas

```
/app
├── page.tsx                 # Landing page
├── login/page.tsx           # Login
├── app/page.tsx             # Dashboard principal
├── api/
│   ├── trending/
│   │   ├── videos/route.ts
│   │   ├── products/route.ts
│   │   └── creators/route.ts
│   └── me/
│       ├── saved/route.ts
│       ├── collections/route.ts
│       ├── notes/route.ts
│       └── alerts/route.ts
├── components/
│   ├── ui/                  # Componentes base (Skeleton, Button, etc.)
│   └── dashboard/           # Componentes do dashboard
└── theme.ts
```

---

## 4. Definição do Dashboard

### Hierarquia Visual (ordem de prioridade)

| Ordem | Bloco                     | Descrição                                                   |
| ----- | ------------------------- | ----------------------------------------------------------- |
| 1     | **Top 10 Vídeos em Alta** | Grid 5x2 com thumbnails clicáveis, título, creator, revenue |
| 2     | **Top 10 Produtos**       | Tabela com imagem, nome, categoria, preço, vendas, revenue  |
| 3     | **5 Novos Produtos**      | Destaque para lançamentos recentes (badge "Novo")           |
| 4     | **Top 5 Creators**        | Tabela com avatar, handle, seguidores, revenue, vídeos      |

### Filtros Globais

- **Período padrão:** Últimos 7 dias (`7d`)
- **Opções:** 7d, 30d, 90d, custom (date picker)
- **Categoria:** Filtro por categoria de produto (futuro)
- **Busca global:** Pesquisar por nome de vídeo, produto ou creator

### Painel Lateral Direito (RightPanel)

- Lista de itens salvos
- Coleções do usuário
- Notas recentes
- Alertas/notificações

---

## 5. Modelos de Dados (TypeScript Interfaces)

### VideoDTO

```typescript
interface VideoDTO {
  id: string;
  title: string; // Descrição/título do vídeo
  duration: string; // "2:30"
  creatorHandle: string; // "@joaotech"
  publishedAt: string; // ISO date
  revenueBRL: number; // Receita total (R$)
  sales: number; // Quantidade de vendas
  views: number; // Visualizações
  gpmBRL: number; // GMV por mil views (R$)
  cpaBRL: number; // Custo por aquisição (R$)
  adRatio: number; // % de views vindas de ads
  adCostBRL: number; // Custo de publicidade (R$)
  roas: number; // Return on Ad Spend
  sourceUrl: string; // Link da fonte de dados
  tiktokUrl: string; // Link para TikTok
  thumbnailUrl?: string; // URL da thumbnail
  dateRange: string; // "Últimos 7 dias"
}
```

### ProductDTO

```typescript
interface ProductDTO {
  id: string;
  name: string; // Nome do produto
  imageUrl: string; // Imagem do produto
  category: string; // Categoria
  priceBRL: number; // Preço atual (R$)
  launchDate: string; // Data de lançamento
  isNew?: boolean; // Flag de produto novo
  rating: number; // Nota média (0-5)
  sales: number; // Vendas totais
  avgPriceBRL: number; // Preço médio por unidade
  commissionRate: number; // Taxa de comissão (0-1)
  revenueBRL: number; // Receita total
  liveRevenueBRL: number; // Receita de lives
  videoRevenueBRL: number; // Receita de vídeos
  mallRevenueBRL: number; // Receita de shopping
  creatorCount: number; // Qtd de creators vendendo
  creatorConversionRate: number;
  sourceUrl: string;
  tiktokUrl: string;
  dateRange: string;
}
```

### CreatorDTO

```typescript
interface CreatorDTO {
  id: string;
  name: string; // Nome do creator
  handle: string; // "@handle"
  followers: number; // Seguidores
  revenueBRL: number; // Receita total
  productCount: number; // Produtos promovidos
  liveCount: number; // Lives realizadas
  liveGmvBRL: number; // GMV de lives
  videoCount: number; // Vídeos publicados
  videoGmvBRL: number; // GMV de vídeos
  views: number; // Views totais
  debutDate: string; // Data de estreia
  sourceUrl: string;
  tiktokUrl: string;
  dateRange: string;
}
```

### CategoryDTO (a implementar)

```typescript
interface CategoryDTO {
  id: string;
  name: string; // "Beleza", "Eletrônicos", etc.
  slug: string; // "beleza", "eletronicos"
  productCount: number;
  revenueBRL: number;
  growthPercent?: number; // Crescimento vs período anterior
}
```

---

## 6. Regras de UX e Estados

### Estados de Componente

| Estado    | Comportamento                                                                      |
| --------- | ---------------------------------------------------------------------------------- |
| `loading` | Exibir skeletons com shimmer animation; manter layout estável                      |
| `error`   | Banner de erro discreto acima do conteúdo; skeletons visíveis abaixo               |
| `empty`   | Mensagem "Nenhum dado encontrado" + ilustração sutil; manter grid com cards vazios |
| `success` | Renderizar dados normalmente                                                       |

### Regras de Skeleton

- **VideoGrid:** Sempre renderizar 10 slots (independente de quantos vídeos retornarem)
- **Thumbnails:** Skeleton com aspect ratio 16:9 e shimmer animation
- **Cards:** Borda suave (`1px solid rgba(255,255,255,0.06)`), blur leve
- **Transição:** Fade suave de skeleton → conteúdo (opacity 0→1, 200ms)

### Princípios de Resiliência

1. Erro em um bloco não quebra os outros
2. Fallback para placeholder se `thumbnailUrl` falhar
3. Mensagens de erro nunca devem alterar altura do container
4. Loading states devem ser indistinguíveis do layout final em tamanho

---

## 7. Design System (Tokens)

### Cores

```css
/* Background */
--bg-base: #06080f /* Fundo principal */ --bg-surface: #0a0f18
  /* Cards, painéis */ --bg-elevated: #0d1520 /* Modais, dropdowns */ /* Text */
  --text-primary: #ffffff --text-secondary: rgba(255, 255, 255, 0.7)
  --text-muted: rgba(255, 255, 255, 0.5) /* Accent */ --accent-primary: #2dd4ff
  /* Ciano principal */ --accent-glow: rgba(45, 212, 255, 0.25)
  --accent-subtle: rgba(45, 212, 255, 0.08) /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.06)
  --border-medium: rgba(255, 255, 255, 0.12) /* Status */ --success: #22c55e
  --warning: #f59e0b --error: #ef4444 --info: #3b82f6;
```

### Espaçamento

```css
--space-1: 4px --space-2: 8px --space-3: 12px --space-4: 16px --space-5: 20px
  --space-6: 24px --space-8: 32px --space-10: 40px --space-12: 48px;
```

### Bordas e Sombras

```css
--radius-sm: 4px --radius-md: 8px --radius-lg: 12px --radius-xl: 16px
  --radius-full: 9999px --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.4)
  --shadow-glow: 0 0 24px var(--accent-glow) --blur-card: blur(8px)
  --blur-header: blur(24px);
```

### Tipografia

```css
--font-family:
  "Inter", -apple-system,
  sans-serif --text-xs: 0.75rem /* 12px */ --text-sm: 0.875rem /* 14px */
    --text-md: 1rem /* 16px */ --text-lg: 1.125rem /* 18px */ --text-xl: 1.25rem
    /* 20px */ --text-2xl: 1.5rem /* 24px */ --text-3xl: 1.875rem /* 30px */;
```

---

## 8. Stack e Estrutura de Código

### Stack Principal

| Camada     | Tecnologia                                |
| ---------- | ----------------------------------------- |
| Framework  | Next.js 14.1 (App Router)                 |
| UI Library | MUI v5 (Material UI)                      |
| Styling    | Emotion (via MUI) + CSS custom properties |
| Linguagem  | TypeScript 5.3                            |
| Runtime    | React 18.2                                |

### Estrutura de Diretórios

```
/app
├── api/                  # API Routes (Next.js Route Handlers)
├── app/                  # Rotas autenticadas (/app/*)
├── components/
│   ├── ui/               # Primitivos reutilizáveis
│   │   └── Skeleton.tsx
│   └── dashboard/        # Componentes específicos do dashboard
│       ├── VideoGrid.tsx
│       ├── VideoCard.tsx
│       ├── DataTable.tsx
│       ├── DashboardHeader.tsx
│       └── RightPanel.tsx
├── data/                 # Dados estáticos (planos, configs)
├── login/                # Página de login
├── globals.css
├── layout.tsx
├── page.tsx              # Landing page
└── theme.ts              # MUI theme configuration

/lib
├── types/
│   └── dto.ts            # Todas as interfaces DTO
├── format.ts             # Utilitários de formatação
├── echotik/              # Client e cron da API EchoTik
└── prisma.ts             # Prisma client

/prisma                   # Schema do banco (futuro)
/public                   # Assets estáticos
```

### Convenções de Código

- **Componentes:** PascalCase, um arquivo por componente
- **Hooks:** `use` prefix (ex: `useVideoData`)
- **Types:** Sufixo `DTO` para data transfer objects
- **API Routes:** `/api/{domain}/{resource}/route.ts`
- **Imports:** Usar alias `@/` para paths absolutos

---

## 9. Critérios de Pronto (Definition of Done)

Uma feature é considerada **pronta** quando:

### Funcionalidade

- [ ] Implementa todos os requisitos descritos
- [ ] Funciona nos estados: loading, error, empty, success
- [ ] Não quebra funcionalidades existentes

### Qualidade de Código

- [ ] TypeScript sem erros (`npm run build` passa)
- [ ] Sem warnings no console do browser
- [ ] Componentes seguem padrões existentes
- [ ] Código limpo e legível

### UX/UI

- [ ] Segue design system (cores, espaçamento, tipografia)
- [ ] Skeletons/loading states implementados
- [ ] Mensagens de erro claras e não-intrusivas
- [ ] Responsivo (mobile-first quando aplicável)

### Acessibilidade

- [ ] Elementos interativos têm `aria-label` quando necessário
- [ ] Contraste adequado (WCAG AA)
- [ ] Navegável por teclado

---

## 10. Perguntas Abertas (para definição futura)

> Perguntas que impactam diretamente a implementação:

### Autenticação

1. **Qual provider de auth usar?** (NextAuth, Clerk, Supabase Auth, custom JWT?)
2. **Quais métodos de login?** (email/senha, Google, magic link?)

### Dados

3. **Qual a frequência de atualização dos dados?** (real-time, hourly, daily?)
4. **Haverá cache?** (Redis, ISR, SWR?)

### Paginação e Limites

5. **Qual o limite máximo de itens por lista?** (100, 500, 1000?)
6. **Paginação ou infinite scroll nas listas completas?**

### Monetização

7. **Quais features são exclusivas de planos pagos?**

### Persistência

8. **Salvos/coleções/notas já devem persistir em DB ou localStorage?**

---

## Changelog

| Data       | Alteração                       |
| ---------- | ------------------------------- |
| 2026-02-09 | Versão inicial do Project Brief |

---

_Este documento deve ser atualizado conforme o projeto evolui._
