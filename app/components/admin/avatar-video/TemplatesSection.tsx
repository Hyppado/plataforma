"use client";

import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Collapse,
  Stack,
  Typography,
  TextField,
  Button,
  Alert,
  Chip,
} from "@mui/material";
import {
  Save as SaveIcon,
  Check as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from "@mui/icons-material";
import { DEFAULT_IMAGE_PROMPT_EXAMPLE } from "@/lib/avatar-video/image-prompt-defaults";

// Read-only reference: exactly what buildConceptMessages() sends as user message
const CONCEPT_USER_MESSAGE_REFERENCE = `Based on the product information below, create a UGC video concept for TikTok Shop.
The video must be authentic, engaging, and optimised for conversion.
Respond ONLY with valid JSON, no markdown. Expected structure:
{
  "videoIdea": "string — overall video idea summary (1-2 sentences)",
  "hook": "string — opening line that grabs attention, in Brazilian Portuguese",
  "copy": "string — main video script/copy in Brazilian Portuguese",
  "cta": "string — final call-to-action in Brazilian Portuguese",
  "scenes": [/* {takeCount} scene(s) */]
}

Scene structure (generate exactly {takeCount} scene(s)):
[
  {
    "sceneNumber": 1,
    "goal": "string — purpose of this scene",
    "description": "string — visual and narrative description of the scene in Brazilian Portuguese"
  }
]

Product and video context:
Product: {productName}
Category: {productCategory}
Price: {productCurrency} {productPrice}
Desired tone: {tone}
Target duration: {duration}
Number of takes/scenes: {takeCount}
Generated reference images (avatar + product): {imageUrls}
Custom scenario description: {customScenarioDescription}   ← only when filled`;

// Read-only reference: exactly what buildVeoPromptMessages() sends as user message
const VEO_USER_MESSAGE_REFERENCE = `Based on the information below, generate a structured VEO 3 prompt in JSON format.
The prompt must be optimized for a UGC video in 9:16 format for TikTok Shop.
cameraDirection and visualDirection must be in English. spokenLines must be in Portuguese (pt-BR).
Each take must be max 8 seconds.
Respond ONLY with valid JSON, no markdown. Expected structure:
{
  "prompt": "string — overall VEO 3 video description in English",
  "duration": {takeCount * 8},
  "aspectRatio": "9:16",
  "style": "ugc",
  "language": "pt-BR",
  "takes": [/* {takeCount} take(s) */]
}

Structure of each take (generate exactly {takeCount} take(s)):
[
  {
    "index": 1,
    "cameraDirection": "string — framing and camera movement in English",
    "visualDirection": "string — what the avatar does with the product, in English. Max 8 seconds.",
    "spokenLines": "string — exact spoken dialogue in Portuguese (pt-BR)"
  }
]

Context:
Product: {productName}
Category: {productCategory}
Price: {productCurrency} {productPrice}
Avatar: {avatarName} — {avatarDescription}
Scenario: {scenarioName} — {scenarioDescription}
Hint: {scenarioPromptHint}
Tone: {tone}
Duration: {duration}
Number of takes: {takeCount}
Generated reference images: {imageUrls}

[Approved concept — injected automatically when available:]
Video idea: {concept.videoIdea}
Hook (opening line): {concept.hook}
Copy/script: {concept.copy}
CTA: {concept.cta}
Scenes: [{ sceneNumber, goal, description }, ...]`;

const DEFAULT_CONCEPT_SYSTEM_PROMPT =
  "You are an expert TikTok Shop content marketing strategist. " +
  "You create authentic, persuasive UGC video concepts optimised for sales conversions. " +
  "Always respond with valid JSON exactly as requested, no markdown, no extra explanations. " +
  "Write hook, copy, and CTA in Brazilian Portuguese (pt-BR).";

const DEFAULT_VEO_SYSTEM_PROMPT =
  "You are an expert at writing prompts for video generation models such as VEO 3. " +
  "Always respond with valid JSON exactly as requested, no markdown, no extra explanations. " +
  "Create creative, authentic prompts suited for TikTok Shop UGC content.";

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

function UserMessagePreview({
  label,
  content,
}: {
  label: string;
  content: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ mt: 2 }}>
      <Button
        size="small"
        variant="text"
        onClick={() => setOpen((v) => !v)}
        endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ color: "rgba(255,255,255,0.5)", fontSize: 12, pl: 0 }}
      >
        {label}
      </Button>
      <Collapse in={open}>
        <Box
          component="pre"
          sx={{
            mt: 1,
            p: 2,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 2,
            fontSize: 12,
            fontFamily: "monospace",
            color: "rgba(255,255,255,0.55)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowX: "auto",
          }}
        >
          {content}
        </Box>
        <Typography
          variant="caption"
          sx={{ color: "rgba(255,255,255,0.35)", mt: 0.5, display: "block" }}
        >
          Montado dinamicamente pelo código — não editável aqui. Os tokens entre
          chaves são preenchidos com os dados do wizard.
        </Typography>
      </Collapse>
    </Box>
  );
}

export function TemplatesSection({
  initialConceptTemplate,
  initialPromptTemplate,
  initialImageTemplate,
  onSaved,
}: {
  initialConceptTemplate: string;
  initialPromptTemplate: string;
  initialImageTemplate: string;
  onSaved: () => Promise<void> | void;
}) {
  const [conceptTemplate, setConceptTemplate] = useState(
    initialConceptTemplate,
  );
  const [promptTemplate, setPromptTemplate] = useState(initialPromptTemplate);
  const [imageTemplate, setImageTemplate] = useState(initialImageTemplate);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/admin/avatar-video/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptTemplate,
          promptTemplate,
          imageTemplate,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Falha ao salvar");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}

      <Card sx={cardStyle}>
        <CardHeader
          title="System Prompt — Geração de Conceito"
          subheader="Papel/persona da IA (role: system). Controla o comportamento geral do modelo ao gerar hook, copy, CTA e cenas."
          titleTypographyProps={{ color: "#fff", fontWeight: 600 }}
          subheaderTypographyProps={{ color: "rgba(255,255,255,0.6)" }}
        />
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
            <Chip
              label="role: system"
              size="small"
              sx={{
                fontSize: 11,
                bgcolor: "rgba(45,212,255,0.1)",
                color: "primary.main",
              }}
            />
            <Chip
              label="OpenAI gpt-4o"
              size="small"
              sx={{
                fontSize: 11,
                bgcolor: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.5)",
              }}
            />
          </Stack>
          <TextField
            value={conceptTemplate}
            onChange={(e) => setConceptTemplate(e.target.value)}
            fullWidth
            multiline
            minRows={5}
            placeholder={DEFAULT_CONCEPT_SYSTEM_PROMPT}
            sx={{
              "& .MuiInputBase-input": {
                fontFamily: "monospace",
                fontSize: 13,
              },
            }}
          />
          <Typography
            variant="caption"
            sx={{ color: "rgba(255,255,255,0.5)", mt: 1, display: "block" }}
          >
            Setting key:{" "}
            <code style={{ color: "#2DD4FF" }}>
              avatar_video.concept_template
            </code>{" "}
            · Se vazio, o sistema usa o template padrão.
          </Typography>
          <UserMessagePreview
            label="Ver mensagem do usuário (role: user) — gerada automaticamente"
            content={CONCEPT_USER_MESSAGE_REFERENCE}
          />
        </CardContent>
      </Card>

      <Card sx={cardStyle}>
        <CardHeader
          title="System Prompt — Geração de Prompt VEO"
          subheader="Papel/persona da IA (role: system). Controla o comportamento ao gerar takes, direção de câmera, direção visual e falas."
          titleTypographyProps={{ color: "#fff", fontWeight: 600 }}
          subheaderTypographyProps={{ color: "rgba(255,255,255,0.6)" }}
        />
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
            <Chip
              label="role: system"
              size="small"
              sx={{
                fontSize: 11,
                bgcolor: "rgba(45,212,255,0.1)",
                color: "primary.main",
              }}
            />
            <Chip
              label="OpenAI gpt-4o"
              size="small"
              sx={{
                fontSize: 11,
                bgcolor: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.5)",
              }}
            />
          </Stack>
          <TextField
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            fullWidth
            multiline
            minRows={5}
            placeholder={DEFAULT_VEO_SYSTEM_PROMPT}
            sx={{
              "& .MuiInputBase-input": {
                fontFamily: "monospace",
                fontSize: 13,
              },
            }}
          />
          <Typography
            variant="caption"
            sx={{ color: "rgba(255,255,255,0.5)", mt: 1, display: "block" }}
          >
            Setting key:{" "}
            <code style={{ color: "#2DD4FF" }}>
              avatar_video.prompt_template
            </code>{" "}
            · Se vazio, o sistema usa o template padrão.
          </Typography>
          <UserMessagePreview
            label="Ver mensagem do usuário (role: user) — gerada automaticamente com dados do wizard"
            content={VEO_USER_MESSAGE_REFERENCE}
          />
        </CardContent>
      </Card>

      <Card sx={cardStyle}>
        <CardHeader
          title="Template de Geração de Imagem"
          subheader="Prompt enviado ao Google AI Studio (Gemini) para compor a imagem de referência."
          titleTypographyProps={{ color: "#fff", fontWeight: 600 }}
          subheaderTypographyProps={{ color: "rgba(255,255,255,0.6)" }}
        />
        <CardContent>
          <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
            Quando preenchido, este texto substitui{" "}
            <strong>integralmente</strong> o prompt construído automaticamente
            pelo código — incluindo a lógica de categoria (roupa, beleza,
            tecnologia, etc.). Deixe vazio para usar o prompt automático.
          </Alert>
          <TextField
            value={imageTemplate}
            onChange={(e) => setImageTemplate(e.target.value)}
            fullWidth
            multiline
            minRows={12}
            placeholder={DEFAULT_IMAGE_PROMPT_EXAMPLE}
            sx={{
              "& .MuiInputBase-input": {
                fontFamily: "monospace",
                fontSize: 13,
              },
            }}
          />
          <Typography
            variant="caption"
            sx={{ color: "rgba(255,255,255,0.5)", mt: 1, display: "block" }}
          >
            Setting key:{" "}
            <code style={{ color: "#2DD4FF" }}>
              avatar_video.image_template
            </code>{" "}
            · Se vazio, o sistema usa o prompt construído automaticamente.
          </Typography>
        </CardContent>
      </Card>

      <Box>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saved ? <CheckIcon /> : <SaveIcon />}
          sx={{ bgcolor: "primary.main", color: "#000" }}
        >
          {saved ? "Salvo" : saving ? "Salvando..." : "Salvar templates"}
        </Button>
      </Box>
    </Stack>
  );
}
