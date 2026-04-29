# Visão Geral do Produto

## O que é o Hyppado

**Hyppado** é uma plataforma SaaS de inteligência de tendências para o TikTok Shop. Ela coleta e apresenta dados de vídeos, produtos e creators em alta de forma organizada, ajudando profissionais do TikTok Shop a tomar decisões mais rápidas e embasadas.

O produto é voltado ao mercado brasileiro, com suporte a múltiplas regiões (BR, US, JP, entre outras configuráveis).

---

## Personas e público-alvo

| Persona                  | Necessidade principal                                          |
| ------------------------ | -------------------------------------------------------------- |
| **Afiliado TikTok Shop** | Descobrir produtos com alta conversão e comissão para promover |
| **Criador de conteúdo**  | Identificar formatos de vídeo que estão viralizando            |
| **Seller / Marca**       | Monitorar concorrência e encontrar creators para parcerias     |
| **Agência de marketing** | Pesquisar tendências em escala para estratégias de clientes    |

---

## Casos de uso principais

### 1. Descobrir vídeos virais

Visualizar os top vídeos com mais receita, vendas ou visualizações nos últimos 7, 30 ou 90 dias, filtrados por região e categoria.

### 2. Encontrar produtos em alta

Ranking de produtos por revenue, vendas, taxa de comissão ou crescimento, com detalhes de preço, creators envolvidos e canais de receita (live, vídeo, shopping). Clicar em "Ver Detalhes" em qualquer produto abre um modal com carrossel de imagens, métricas de vendas e GMV (7d/30d/90d/total), especificações e link para o TikTok Shop.

### 3. Identificar creators de sucesso

Lista dos principais creators por receita, seguidores e engajamento, com dados de lives e vídeos.

### 4. Transcrever vídeos automaticamente

Clicar em "Transcrever" em qualquer vídeo gera uma transcrição via OpenAI Whisper, disponível para todos os usuários (compartilhada globalmente).

### 5. Gerar Insight Hyppado

A partir de um vídeo transcrito, gerar análise estruturada via IA: contexto, gancho, problema, solução, CTA e roteiro reutilizável. Um insight por usuário por vídeo.

### 6. Gerar material para vídeo com avatar

Fluxo guiado de criação de material UGC em três etapas de IA (nesta ordem):

1. **Imagens de referência** — Google AI Studio (Gemini) gera 2 variações de imagem UGC (avatar + produto); o usuário revisa e pode selecionar a preferida
2. **Conceito** — `gpt-4o` (OpenAI) gera ideia, gancho, copy, CTA e lista de cenas a partir dos dados do produto e das URLs das imagens geradas; o usuário pode editar
3. **Prompt VEO 3** — `gpt-4o` (OpenAI) gera prompt estruturado por take, usando o conceito aprovado como direção criativa; o usuário pode editar e copiar

O Hyppado não executa a geração do vídeo final. Sujeito a quota mensal (`avatarVideoQuota`) configurável por plano — 1 crédito por geração de imagens (idempotente por sessão).

### 7. Influencer IA

Wizard de geração de imagens UGC ultra-realistas: o usuário seleciona um produto em alta (ou faz upload de imagem), escolhe um avatar da galeria (ou faz upload de foto própria), configura pose, ambiente, estilo e melhorias, e recebe uma imagem gerada via **Google AI Studio (Gemini)** hospedada no Vercel Blob. Adicionalmente, pode gerar prompts VEO 3.1 para a imagem gerada, especificando estilo (UGC, unboxing, review, tutorial, testemunho) e duração (curto / médio / completo). Disponível na seção **FERRAMENTAS** da sidebar.

Ao clicar em **"Criar vídeo"** em qualquer `ProductCard`, o wizard abre com o produto pré-selecionado no tab "Produtos Hype", exibindo automaticamente o picker de variações de imagem (SKUs). Se o produto não estiver no top-100 de tendências, é buscado individualmente via `GET /api/trending/products/[id]` e mapeado para `ProductDTO`.

### 8. Biblioteca de Prompts

Galeria curada de exemplos de prompt UGC, gerenciados pelo admin. Exibida como inspiração para criadores. Cada item contém um vídeo curto em loop, título, categoria, descrição e o texto do prompt copiável. Filtro por categoria e modal de detalhe com layout vídeo + prompt lado a lado. Sem quota — acesso universal para assinantes autenticados. Disponível na seção **FERRAMENTAS** da sidebar (badge **NOVO**).

Favoritar vídeos e produtos, criar coleções, escrever notas e configurar alertas por item.

---

## Funcionalidades da plataforma

### Dashboard autenticado

- **Vídeos em alta** — rankings filtráveis por região, período e categoria
- **Produtos em alta** — rankings com métricas de receita e canais
- **Creators em alta** — rankings com dados de lives e vídeos
- **Vídeos salvos** — coleção pessoal do usuário
- **Produtos salvos** — lista de produtos favoritados
- **Tendências** — análise de tendências (em desenvolvimento)
- **Suporte** — página de suporte in-app
- **Influencer IA** (FERRAMENTAS) — wizard de geração de imagens UGC (Gemini) com produto e avatar + geração de prompts VEO 3.1; deep-link de `ProductCard` pré-seleciona produto com picker de variações
- **Biblioteca de Prompts** (FERRAMENTAS) — galeria de exemplos de prompt curados pelo admin (badge NOVO)

### Painel administrativo

- Gestão de usuários (criar, editar, resetar senha, desativar, excluir)
- Gestão de planos (sincronização com Hotmart, edição de quotas, visibilidade)
- Métricas de assinaturas e lista de assinantes (dados em tempo real via Hotmart)
- Configuração de credenciais Hotmart e Echotik
- Configuração da chave OpenAI e templates de prompt
- Configuração de **Avatar Video** (em `/dashboard/config` → aba "Avatar Video"): CRUD de avatares (`AvatarProfile`) e cenários (`VideoScenario`) com upload de imagem, ativação/desativação e cenário padrão; editor dos templates de sistema `avatar_video.concept_template` e `avatar_video.prompt_template` (vazio = usa default embutido no código)
- **Biblioteca de Prompts** (em `/dashboard/config` → aba "Biblioteca de Prompts"): CRUD de `PromptLibraryItem` com upload de vídeo (Vercel Blob), título, categoria (com sugestões), descrição e prompt; ativação/desativação; sugestão de categorias existentes
- **Biblioteca de Prompts** (em `/dashboard/config` → aba "Biblioteca de Prompts"): CRUD de `PromptLibraryItem` com upload de vídeo (Vercel Blob), título, categoria (com sugestões), descrição e prompt; ativação/desativação; sugestão de categorias existentes
- Notificações de eventos de sistema e webhooks
- Logs de auditoria
- Política de quotas por período

### Acesso e cobrança

O acesso ao dashboard é controlado por:

- **Assinatura ativa** via Hotmart (provisionamento automático por webhook)
- **AccessGrant** administrativo (acesso manual concedido por admin)

Os planos têm quotas configuráveis para transcrições e insights por período.

---

## Regiões suportadas

As regiões são configuradas no banco de dados (tabela `Region`). As regiões padrão são:

| Código | País           |
| ------ | -------------- |
| `BR`   | Brasil         |
| `US`   | Estados Unidos |
| `JP`   | Japão          |

Novas regiões podem ser adicionadas via seed ou diretamente no banco. O sistema nunca usa variáveis de ambiente para definir regiões.

---

## Branding

Os únicos nomes de marca permitidos no projeto são **Hyppe** e **Hyppado**.

- Funcionalidades seguem o padrão: "Insight Hyppado", "Hyppado Trends", etc.
- Nunca usar nomes de terceiros como nomes de funcionalidades próprias.
- Isso se aplica a: código, comentários, UI, prompts, documentação, commits.
