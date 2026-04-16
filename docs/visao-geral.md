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

Ranking de produtos por revenue, vendas, taxa de comissão ou crescimento, com détalhes de preço, creators envolvidos e canais de receita (live, vídeo, shopping).

### 3. Identificar creators de sucesso

Lista dos principais creators por receita, seguidores e engajamento, com dados de lives e vídeos.

### 4. Transcrever vídeos automaticamente

Clicar em "Transcrever" em qualquer vídeo gera uma transcrição via OpenAI Whisper, disponível para todos os usuários (compartilhada globalmente).

### 5. Gerar Insight Hyppado

A partir de um vídeo transcrito, gerar análise estruturada via IA: contexto, gancho, problema, solução, CTA e roteiro reutilizável. Um insight por usuário por vídeo.

### 6. Salvar e organizar

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

### Painel administrativo

- Gestão de usuários (criar, editar, resetar senha, desativar, excluir)
- Gestão de planos (sincronização com Hotmart, edição de quotas, visibilidade)
- Métricas de assinaturas e lista de assinantes (dados em tempo real via Hotmart)
- Configuração de credenciais Hotmart e Echotik
- Configuração da chave OpenAI e templates de prompt
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
