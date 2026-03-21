/**
 * Prompt configuration for LLM generation.
 * FRONT-END ONLY - templates and settings for Product Insights and Scripts.
 *
 * These templates are used when generating:
 * - Product Insights: Analysis of a product's potential based on data
 * - Product Scripts: Video script suggestions for TikTok creators
 */

import type { ModelSettings, PromptConfig } from "@/lib/types/admin";

/**
 * Available template variables.
 * These will be replaced with actual data when generating.
 */
export const PROMPT_VARIABLES = [
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

/**
 * Default insight prompt template.
 * Generates analysis and recommendations for a product.
 */
export const DEFAULT_INSIGHT_PROMPT = `Você é um especialista em análise de produtos para TikTok Shop no Brasil.

## Produto
Nome: {{product_name}}
Categoria: {{product_category}}
Preço: {{product_price}}
Comissão: {{product_commission}}
Loja: {{product_store}}

## Dados de Mercado ({{time_range}})
País: {{market_country}}

### Top Vídeos Relacionados
{{top_videos_summary}}

### Top Creators do Nicho
{{top_creators_summary}}

## Tarefa
Analise este produto e forneça:
1. **Potencial de Vendas**: Avalie o potencial baseado nos dados de mercado
2. **Pontos Fortes**: O que torna este produto atrativo
3. **Pontos de Atenção**: Riscos ou desafios
4. **Estratégia Recomendada**: Como abordar a promoção deste produto
5. **Score de Oportunidade**: Nota de 1-10 com justificativa

Seja objetivo e baseie-se nos dados fornecidos.`;

/**
 * Default script prompt template.
 * Generates video script suggestions for TikTok.
 */
export const DEFAULT_SCRIPT_PROMPT = `Você é um roteirista especializado em vídeos virais para TikTok Shop no Brasil.

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

/**
 * Default model settings.
 */
export const DEFAULT_MODEL_SETTINGS: {
  insight: ModelSettings;
  script: ModelSettings;
} = {
  insight: {
    model: "gpt-4o-mini",
    temperature: 0.7,
    top_p: 0.9,
    max_output_tokens: 800,
  },
  script: {
    model: "gpt-4o-mini",
    temperature: 0.8,
    top_p: 0.95,
    max_output_tokens: 1500,
  },
};

/**
 * Get default prompt configuration.
 */
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

/**
 * Local storage key for prompt config.
 */
export const PROMPT_CONFIG_STORAGE_KEY = "hyppado_prompt_config";

/**
 * Save prompt config to localStorage.
 */
export function savePromptConfigLocally(config: PromptConfig): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(PROMPT_CONFIG_STORAGE_KEY, JSON.stringify(config));
  }
}

/**
 * Load prompt config from localStorage, falling back to defaults.
 */
export function loadPromptConfigLocally(): PromptConfig {
  if (typeof window === "undefined") {
    return getDefaultPromptConfig();
  }

  const stored = localStorage.getItem(PROMPT_CONFIG_STORAGE_KEY);
  if (!stored) {
    return getDefaultPromptConfig();
  }

  try {
    return JSON.parse(stored) as PromptConfig;
  } catch {
    return getDefaultPromptConfig();
  }
}
