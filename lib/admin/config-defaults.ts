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
// Avatar Video / Influencer IA — default prompt templates
// ---------------------------------------------------------------------------

/**
 * Default Influencer IA image prompt (Gemini).
 * Variables filled at runtime by lib/influencer-ia/generate.ts:
 *   {{subject_block}}      — full SUBJECT line (or "Só Produto" variant)
 *   {{product_block}}      — full PRODUCT line with name + reference rules
 *   {{placement_block}}    — full PLACEMENT line (category-aware), or empty
 *   {{pose}}               — pose description (preset or custom)
 *   {{environment}}        — environment description (preset or custom)
 *   {{style_block}}        — full INFLUENCER STYLE line, or empty
 *   {{enhancements_block}} — bullet list of enhancements, or empty
 */
const DEFAULT_AVATAR_IMAGE_PROMPT = `Photorealistic UGC-style product placement photo for TikTok Shop.

{{subject_block}}
{{product_block}}
READING THE REFERENCE IMAGE — CRITICAL RULES:
- IGNORE everything that is NOT part of the physical product: price stickers, promotional stamps, watermarks, e-commerce badges, review stars, shipping labels, certification seals, website URLs, or any text/graphic overlaid on the photo background. These are photo artifacts, NOT product features. Reproduce only what is physically ON the product.
- Infer the REAL-WORLD SIZE of the product from its shape and category. A supplement bottle should look like a hand-sized bottle (~15–20 cm tall). A serum should look small in the palm. A clothing item should drape over a full body. Scale the product PROPORTIONALLY and REALISTICALLY relative to the person or hand — never make it unnaturally large or tiny compared to a real human hand or body.
{{placement_block}}
POSE: {{pose}}.
SETTING: {{environment}}.
{{style_block}}

TECHNICAL REQUIREMENTS:
- Vertical 9:16 portrait format
- Photorealistic editorial quality — must look like a real professional photo, NOT AI-generated
- No text overlays, watermarks, or UI elements in the final image
- Product must be the clear hero of the image and perfectly sharp
- The product color must EXACTLY match the reference — do not change or approximate the shade
- If the product is clothing, the influencer MUST be wearing it — not holding it
- Product scale must match real-world proportions relative to the person's hands and body
{{enhancements_block}}`;

/**
 * Default VEO 3.1 system message (OpenAI gpt-4o).
 * No variables — admin can edit text freely.
 */
const DEFAULT_VEO_SYSTEM_PROMPT = `You are a VEO 3.1 video prompt expert for TikTok Shop UGC content. You write vivid, cinematic English prompts for vertical (9:16) short-form video generation. Each prompt must describe exactly 8 seconds of content: camera direction + visual action + spoken dialogue in PT-BR. Respond ONLY with a JSON object: { "parts": ["prompt1", "prompt2", ...] }`;

/**
 * Default VEO 3.1 user message (OpenAI gpt-4o).
 * Variables filled at runtime by lib/influencer-ia/veo-prompt.ts:
 *   {{product_name}}        — product name
 *   {{product_category}}    — formatted as " (category)" or empty
 *   {{style_description}}   — long style description
 *   {{style_label}}         — UPPERCASE style label
 *   {{total}}               — number of parts (2/4/8)
 *   {{part_descriptions}}   — multi-line list "  Part X/Y — label: goal"
 */
const DEFAULT_VEO_USER_PROMPT = `Product: {{product_name}}{{product_category}}
Style: {{style_description}}

Generate exactly {{total}} VEO 3.1 prompts for the following parts:
{{part_descriptions}}

Rules:
- Each prompt string must start with "Realistic {{style_label}} TikTok video PART X/{{total}}."
- Describe camera framing (e.g. "Medium shot, stable camera, slight push in")
- Describe what the creator does visually and how they interact with the product
- Include: "Keep the same person, product and environment as the reference image."
- Include: "No on-screen text, logos, subtitles, watermarks, distorted hands, faces or product."
- End each prompt with: Audio: "[spoken lines in PT-BR]"
- Max 8 seconds per part — keep it focused and punchy

Return JSON: { "parts": ["part1 prompt...", "part2 prompt...", ...] }`;

// ---------------------------------------------------------------------------
// Avatar Video — variable metadata for the admin editor
// ---------------------------------------------------------------------------

export interface AvatarPromptVariable {
  variable: string;
  description: string;
  required: boolean;
}

export const AVATAR_IMAGE_VARIABLES: readonly AvatarPromptVariable[] = [
  {
    variable: "{{subject_block}}",
    description: "Linha SUBJECT — descreve o creator (ou modo Só Produto)",
    required: true,
  },
  {
    variable: "{{product_block}}",
    description: "Linha PRODUCT — nome do produto + regras da imagem de referência",
    required: true,
  },
  {
    variable: "{{placement_block}}",
    description: "Linha PLACEMENT — onde/como o produto aparece (varia por categoria)",
    required: true,
  },
  {
    variable: "{{pose}}",
    description: "Descrição da pose (preset ou customizada)",
    required: true,
  },
  {
    variable: "{{environment}}",
    description: "Descrição do cenário (preset ou customizado)",
    required: true,
  },
  {
    variable: "{{style_block}}",
    description: "Linha INFLUENCER STYLE — vazio se não houver estilo",
    required: false,
  },
  {
    variable: "{{enhancements_block}}",
    description: "Lista de bullets com aprimoramentos selecionados — vazio se nenhum",
    required: false,
  },
] as const;

export const VEO_SYSTEM_VARIABLES: readonly AvatarPromptVariable[] = [];

export const VEO_USER_VARIABLES: readonly AvatarPromptVariable[] = [
  {
    variable: "{{product_name}}",
    description: "Nome do produto",
    required: true,
  },
  {
    variable: "{{product_category}}",
    description: 'Categoria entre parênteses, ex: " (Beleza)" — vazio se não houver',
    required: false,
  },
  {
    variable: "{{style_description}}",
    description: "Descrição longa do estilo escolhido (UGC, Unboxing, etc)",
    required: true,
  },
  {
    variable: "{{style_label}}",
    description: "Rótulo do estilo em MAIÚSCULAS (UGC, UNBOXING, etc)",
    required: true,
  },
  {
    variable: "{{total}}",
    description: "Número total de partes do vídeo (2, 4 ou 8)",
    required: true,
  },
  {
    variable: "{{part_descriptions}}",
    description: 'Lista das partes (Gancho, Apresentação, CTA, etc) com seus objetivos',
    required: true,
  },
] as const;

// ---------------------------------------------------------------------------
// getDefaultPromptConfig
// ---------------------------------------------------------------------------

export function getDefaultAvatarVideoPrompts() {
  return {
    image: DEFAULT_AVATAR_IMAGE_PROMPT,
    veoSystem: DEFAULT_VEO_SYSTEM_PROMPT,
    veoUser: DEFAULT_VEO_USER_PROMPT,
  };
}

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
    avatarVideo: getDefaultAvatarVideoPrompts(),
  };
}
