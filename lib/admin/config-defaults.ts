/**
 * lib/admin/config-defaults.ts
 *
 * Client-safe constants and default values for admin configuration.
 * No server-only imports — safe to use in both client and server components.
 *
 * Server-only logic (DB read/write) lives in lib/admin/config.ts.
 */

import type {
  QuotaPolicy,
  PromptConfig,
  ModelSettings,
} from "@/lib/types/admin";

// ---------------------------------------------------------------------------
// Quota defaults
// ---------------------------------------------------------------------------

export const DEFAULT_QUOTA_POLICY: QuotaPolicy = {
  transcriptsPerMonth: 40,
  scriptsPerMonth: 70,
  insightTokensPerMonth: 50_000,
  scriptTokensPerMonth: 20_000,
  insightMaxOutputTokens: 800,
  scriptMaxOutputTokens: 1500,
};

// ---------------------------------------------------------------------------
// Available template variables (UI metadata for the admin prompts editor)
// ---------------------------------------------------------------------------

export const PROMPT_VARIABLES = [
  {
    variable: "{{transcript_text}}",
    description: "Transcrição completa do vídeo",
    required: true,
    source: "VideoTranscript (gerado automaticamente)",
  },
  {
    variable: "{{video_title}}",
    description: "Título ou ID do vídeo",
    required: false,
    source: "Dados do vídeo",
  },
  {
    variable: "{{video_creator}}",
    description: "Nome/handle do creator",
    required: false,
    source: "Dados do vídeo",
  },
  {
    variable: "{{product_name}}",
    description: "Nome do produto",
    required: true,
    source: "Produto selecionado",
  },
  {
    variable: "{{product_category}}",
    description: "Categoria do produto",
    required: true,
    source: "Dados do produto",
  },
  {
    variable: "{{product_price}}",
    description: "Preço do produto",
    required: false,
    source: "Dados do produto",
  },
  {
    variable: "{{product_commission}}",
    description: "Comissão do afiliado",
    required: false,
    source: "Dados do produto (se disponível)",
  },
  {
    variable: "{{product_store}}",
    description: "Loja/vendedor do produto",
    required: false,
    source: "Dados do produto",
  },
  {
    variable: "{{product_url}}",
    description: "URL do produto",
    required: false,
    source: "Dados do produto",
  },
  {
    variable: "{{top_videos_summary}}",
    description: "Resumo dos top vídeos relacionados",
    required: false,
    source: "Análise de vídeos em alta",
  },
  {
    variable: "{{top_creators_summary}}",
    description: "Resumo dos top creators do nicho",
    required: false,
    source: "Análise de creators em alta",
  },
  {
    variable: "{{market_country}}",
    description: "País do mercado (ex: Brasil)",
    required: true,
    source: "Configuração do workspace",
  },
  {
    variable: "{{time_range}}",
    description: "Período de análise (ex: últimos 7 dias)",
    required: true,
    source: "Filtro selecionado",
  },
] as const;

// ---------------------------------------------------------------------------
// Default prompt templates
// ---------------------------------------------------------------------------

const DEFAULT_INSIGHT_PROMPT = `Você é um analista de conteúdo viral especializado em TikTok Shop.

Analise a transcrição de um vídeo e extraia um "Insight Hyppado" — uma análise estruturada que identifique os elementos persuasivos usados pelo creator.

## Vídeo
Título: {{video_title}}
Creator: {{video_creator}}

## Transcrição
{{transcript_text}}

## Tarefa
Analise a transcrição acima e retorne um JSON com os seguintes campos:

1. **contexto**: Descreva em 1-2 frases o contexto geral da discussão. O que o vídeo aborda?
2. **gancho**: Qual técnica de gancho foi usada nos primeiros segundos para capturar atenção? Descreva a técnica e o efeito.
3. **problema**: Qual problema ou dor o vídeo apresenta? Como o público se identifica?
4. **solucao**: Qual solução é oferecida? Como é apresentada de forma convincente?
5. **cta**: Qual é o call-to-action? Como a urgência é criada?
6. **copie_o_que_funcionou**: Reescreva o roteiro completo do vídeo de forma genérica e reutilizável. Substitua nomes específicos de produtos por [PRODUTO], benefícios específicos por [BENEFÍCIO 1], [BENEFÍCIO 2], etc., problemas específicos por [PROBLEMA], e valores por [VALOR]. Preserve a estrutura persuasiva intacta — o roteiro deve ser copyable e adaptável para qualquer produto similar.

Formato de resposta (JSON válido apenas):
{
  "contexto": "...",
  "gancho": "...",
  "problema": "...",
  "solucao": "...",
  "cta": "...",
  "copie_o_que_funcionou": "..."
}

Regras:
- Responda APENAS com JSON válido, sem markdown, sem texto extra.
- Tudo em português do Brasil.
- O campo "copie_o_que_funcionou" deve ser detalhado e manter a estrutura completa do roteiro original.
- Se algum elemento não estiver claro no vídeo, descreva o que existe ou indique "Não identificado claramente no vídeo".`;

const DEFAULT_SCRIPT_PROMPT = `Você é um roteirista especializado em vídeos virais para TikTok Shop no Brasil.

## Produto
Nome: {{product_name}}
Categoria: {{product_category}}
Preço: {{product_price}}
URL: {{product_url}}

## Referências de Sucesso ({{time_range}})
### Vídeos que Performaram Bem
{{top_videos_summary}}

### Creators de Referência
{{top_creators_summary}}

## Tarefa
Crie 3 roteiros de vídeo curto (15-60 segundos) para promover este produto no TikTok:

### Roteiro 1: Hook de Problema
- Comece com uma dor/problema que o produto resolve
- Formato: problema → descoberta → solução → CTA

### Roteiro 2: Demonstração Rápida
- Mostre o produto em ação
- Formato: atenção → demonstração → benefícios → CTA

### Roteiro 3: Storytelling
- Conte uma história envolvente
- Formato: contexto → jornada → transformação → CTA

Para cada roteiro inclua:
- Hook (primeiros 3 segundos)
- Corpo do vídeo (texto/narração)
- CTA final
- Dicas de edição
- Hashtags sugeridas`;

// ---------------------------------------------------------------------------
// Default model settings
// ---------------------------------------------------------------------------

const DEFAULT_MODEL_SETTINGS: Record<"insight" | "script", ModelSettings> = {
  insight: {
    model: "gpt-4o-mini",
    temperature: 0.7,
    top_p: 0.9,
    max_output_tokens: 2000,
  },
  script: {
    model: "gpt-4o-mini",
    temperature: 0.8,
    top_p: 0.95,
    max_output_tokens: 1500,
  },
};

// ---------------------------------------------------------------------------
// getDefaultPromptConfig
// ---------------------------------------------------------------------------

export function getDefaultPromptConfig(): PromptConfig {
  return {
    insight: {
      template: DEFAULT_INSIGHT_PROMPT,
      settings: { ...DEFAULT_MODEL_SETTINGS.insight },
    },
    script: {
      template: DEFAULT_SCRIPT_PROMPT,
      settings: { ...DEFAULT_MODEL_SETTINGS.script },
    },
  };
}
