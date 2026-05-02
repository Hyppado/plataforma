"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Tooltip,
  Stack,
  Box,
  Chip,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  Check as CheckIcon,
  RestartAlt as RestartAltIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Undo as UndoIcon,
  Close as CloseIcon,
  LockOutlined as LockOutlinedIcon,
  ImageOutlined,
  SmartToyOutlined,
  ChatOutlined,
} from "@mui/icons-material";
import type { PromptConfig } from "@/lib/types/admin";
import {
  getDefaultAvatarVideoPrompts,
  AVATAR_IMAGE_VARIABLES,
  VEO_SYSTEM_VARIABLES,
  VEO_USER_VARIABLES,
  type AvatarPromptVariable,
} from "@/lib/admin/config-defaults";
import { getPromptConfig, updatePromptConfig } from "@/lib/admin/admin-client";

type AvatarPromptKey = "image" | "veoSystem" | "veoUser";

interface PromptDef {
  key: AvatarPromptKey;
  step: string;
  title: string;
  flow: string;
  explanation: string;
  icon: React.ReactNode;
  variables: readonly AvatarPromptVariable[];
}

const PROMPT_DEFS: readonly PromptDef[] = [
  {
    key: "image",
    step: "Etapa 1",
    title: "Geração da imagem do influencer",
    flow: "Google Gemini · gera a foto do creator com o produto",
    explanation:
      "Este prompt é enviado ao Google Gemini para criar a imagem do influencer segurando ou usando o produto. É a base visual que o VEO 3.1 vai animar nos próximos passos.",
    icon: <ImageOutlined />,
    variables: AVATAR_IMAGE_VARIABLES,
  },
  {
    key: "veoSystem",
    step: "Etapa 2",
    title: "Instrução de sistema para o VEO 3.1",
    flow: "OpenAI · define o papel e o formato de saída do gerador de prompts",
    explanation:
      "Mensagem de sistema enviada à OpenAI antes da requisição. Define quem ela é (especialista em prompts VEO 3.1), o formato de retorno (JSON) e as regras gerais. Não usa variáveis dinâmicas — é um contrato fixo.",
    icon: <SmartToyOutlined />,
    variables: VEO_SYSTEM_VARIABLES,
  },
  {
    key: "veoUser",
    step: "Etapa 3",
    title: "Instrução de usuário para o VEO 3.1",
    flow: "OpenAI · monta os prompts de cada parte do vídeo",
    explanation:
      "Mensagem que de fato pede a geração dos prompts VEO. Recebe produto, estilo escolhido e a estrutura das partes (Gancho, Apresentação, CTA, etc). O resultado é convertido em vídeo pelo VEO 3.1.",
    icon: <ChatOutlined />,
    variables: VEO_USER_VARIABLES,
  },
] as const;

const UNDO_LIMIT = 50;

interface PromptCardProps {
  def: PromptDef;
  index: number;
  savedValue: string;
  onSaved: (key: AvatarPromptKey, value: string) => void;
}

/**
 * One editable prompt card. Owns its own draft, undo history and edit-mode
 * flag so the three cards in the page do not re-render each other.
 */
function PromptCard({ def, index, savedValue, onSaved }: PromptCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(savedValue);
  const [history, setHistory] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(savedValue);
  }, [savedValue, editing]);

  const dirty = editing && draft !== savedValue;

  const missingRequired = useMemo(
    () =>
      def.variables.filter((v) => v.required && !draft.includes(v.variable)),
    [def.variables, draft],
  );

  const isDefault = useMemo(() => {
    const defaults = getDefaultAvatarVideoPrompts();
    return savedValue === defaults[def.key];
  }, [savedValue, def.key]);

  const pushHistory = useCallback((prev: string) => {
    setHistory((h) => {
      const next = [...h, prev];
      return next.length > UNDO_LIMIT ? next.slice(-UNDO_LIMIT) : next;
    });
  }, []);

  const handleEdit = useCallback(() => {
    setDraft(savedValue);
    setHistory([]);
    setError(null);
    setEditing(true);
  }, [savedValue]);

  const handleCancel = useCallback(() => {
    setDraft(savedValue);
    setHistory([]);
    setError(null);
    setEditing(false);
  }, [savedValue]);

  const handleChange = useCallback(
    (value: string) => {
      pushHistory(draft);
      setDraft(value);
      setJustSaved(false);
    },
    [draft, pushHistory],
  );

  const handleUndo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setDraft(prev);
      return h.slice(0, -1);
    });
  }, []);

  const handleResetToDefault = useCallback(() => {
    const defaults = getDefaultAvatarVideoPrompts();
    pushHistory(draft);
    setDraft(defaults[def.key]);
  }, [draft, def.key, pushHistory]);

  const handleInsertVariable = useCallback(
    (variable: string) => {
      const el = textareaRef.current;
      pushHistory(draft);
      if (el) {
        const start = el.selectionStart ?? draft.length;
        const end = el.selectionEnd ?? draft.length;
        const next = draft.slice(0, start) + variable + draft.slice(end);
        setDraft(next);
        requestAnimationFrame(() => {
          el.focus();
          el.selectionStart = el.selectionEnd = start + variable.length;
        });
      } else {
        setDraft(draft + variable);
      }
    },
    [draft, pushHistory],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      // Re-fetch to merge with latest config (avoids overwriting other prompts).
      const current = await getPromptConfig();
      const next: PromptConfig = {
        ...current,
        avatarVideo: { ...current.avatarVideo, [def.key]: draft },
      };
      await updatePromptConfig(next);
      onSaved(def.key, draft);
      setEditing(false);
      setHistory([]);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [def.key, draft, onSaved]);

  const canSave = dirty && missingRequired.length === 0 && !saving;

  const status: "viewing" | "editing" | "saving" | "saved" = saving
    ? "saving"
    : justSaved
      ? "saved"
      : editing
        ? "editing"
        : "viewing";

  const statusColor =
    status === "editing"
      ? "#FFB74D"
      : status === "saving"
        ? "#7B61FF"
        : status === "saved"
          ? "#66BB6A"
          : "rgba(255,255,255,0.4)";

  const statusLabel =
    status === "editing"
      ? "Editando"
      : status === "saving"
        ? "Salvando…"
        : status === "saved"
          ? "Salvo"
          : "Somente leitura";

  return (
    <Card
      sx={{
        position: "relative",
        background: "rgba(10, 15, 24, 0.7)",
        border: `1px solid ${
          status === "editing"
            ? "rgba(255, 183, 77, 0.4)"
            : status === "saved"
              ? "rgba(102, 187, 106, 0.4)"
              : "rgba(255,255,255,0.06)"
        }`,
        borderRadius: 3,
        transition: "border-color 200ms ease, box-shadow 200ms ease",
        boxShadow:
          status === "editing"
            ? "0 0 0 4px rgba(255, 183, 77, 0.06)"
            : status === "saved"
              ? "0 0 0 4px rgba(102, 187, 106, 0.06)"
              : "none",
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={1.5}
          sx={{ mb: 2 }}
        >
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  "linear-gradient(135deg, rgba(45,212,255,0.18), rgba(123,97,255,0.18))",
                color: "primary.main",
                flexShrink: 0,
              }}
            >
              {def.icon}
            </Box>
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: "primary.main",
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  fontSize: "0.65rem",
                }}
              >
                {def.step} · {String(index + 1).padStart(2, "0")}
              </Typography>
              <Typography
                sx={{ fontSize: "1rem", fontWeight: 600, color: "#fff" }}
              >
                {def.title}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "rgba(255,255,255,0.55)", display: "block" }}
              >
                {def.flow}
              </Typography>
            </Box>
          </Stack>

          <Chip
            size="small"
            label={statusLabel}
            icon={
              status === "viewing" ? (
                <LockOutlinedIcon sx={{ fontSize: 14 }} />
              ) : status === "saved" ? (
                <CheckIcon sx={{ fontSize: 14 }} />
              ) : status === "saving" ? (
                <CircularProgress size={12} sx={{ color: "#fff" }} />
              ) : (
                <EditIcon sx={{ fontSize: 14 }} />
              )
            }
            sx={{
              background: `${statusColor}22`,
              color: statusColor,
              border: `1px solid ${statusColor}55`,
              fontWeight: 600,
              "& .MuiChip-icon": { color: statusColor },
            }}
          />
        </Stack>

        <Typography
          variant="body2"
          sx={{ color: "rgba(255,255,255,0.7)", mb: 2.5, lineHeight: 1.6 }}
        >
          {def.explanation}
        </Typography>

        {def.variables.length > 0 ? (
          <Box
            sx={{
              p: 1.75,
              mb: 2.5,
              borderRadius: 2,
              background: "rgba(0,0,0,0.25)",
              border: "1px dashed rgba(255,255,255,0.08)",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: "rgba(255,255,255,0.55)",
                display: "block",
                mb: 1,
              }}
            >
              Variáveis disponíveis{" "}
              {editing
                ? "— clique em uma para inserir na posição do cursor"
                : "— entre em modo edição para usá-las"}
            </Typography>
            <Stack
              direction="row"
              spacing={0.75}
              flexWrap="wrap"
              useFlexGap
              sx={{ rowGap: 0.75 }}
            >
              {def.variables.map((v) => {
                const present = draft.includes(v.variable);
                const missingButRequired = v.required && !present;
                return (
                  <Tooltip
                    key={v.variable}
                    title={
                      <Box>
                        <Box
                          sx={{ fontFamily: "monospace", fontSize: "0.7rem" }}
                        >
                          {v.variable}
                        </Box>
                        <Box sx={{ mt: 0.5 }}>{v.description}</Box>
                        {v.required && (
                          <Box sx={{ mt: 0.5, color: "#ff9e80" }}>
                            Obrigatória — não pode ser removida
                          </Box>
                        )}
                      </Box>
                    }
                  >
                    <Chip
                      label={
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                        >
                          <Box component="span" sx={{ fontWeight: 600 }}>
                            {v.label}
                          </Box>
                          {v.required && (
                            <Box
                              component="span"
                              sx={{
                                fontSize: "0.6rem",
                                opacity: 0.7,
                                fontWeight: 700,
                              }}
                            >
                              ★
                            </Box>
                          )}
                        </Stack>
                      }
                      size="small"
                      onClick={
                        editing
                          ? () => handleInsertVariable(v.variable)
                          : undefined
                      }
                      disabled={!editing}
                      sx={{
                        fontSize: "0.72rem",
                        cursor: editing ? "pointer" : "default",
                        background: missingButRequired
                          ? "rgba(244,67,54,0.18)"
                          : present
                            ? "rgba(46,204,113,0.14)"
                            : "rgba(255,255,255,0.06)",
                        color: missingButRequired
                          ? "#ff7043"
                          : present
                            ? "#7ee2a8"
                            : "rgba(255,255,255,0.7)",
                        border: `1px solid ${
                          missingButRequired
                            ? "rgba(244,67,54,0.4)"
                            : present
                              ? "rgba(46,204,113,0.3)"
                              : "rgba(255,255,255,0.1)"
                        }`,
                        "&.Mui-disabled": {
                          opacity: 0.85,
                          color: missingButRequired
                            ? "#ff7043"
                            : present
                              ? "#7ee2a8"
                              : "rgba(255,255,255,0.5)",
                        },
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Stack>
          </Box>
        ) : (
          <Alert
            severity="info"
            icon={false}
            sx={{
              mb: 2.5,
              background: "rgba(45,212,255,0.06)",
              color: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(45,212,255,0.15)",
            }}
          >
            Este prompt não usa variáveis dinâmicas. Edite livremente o texto.
          </Alert>
        )}

        {editing && missingRequired.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Para salvar, mantenha as variáveis obrigatórias no texto:{" "}
            {missingRequired.map((v) => v.label).join(", ")}.
          </Alert>
        )}

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        <Box sx={{ position: "relative" }}>
          <TextField
            multiline
            minRows={12}
            maxRows={30}
            fullWidth
            value={draft}
            onChange={(e) => handleChange(e.target.value)}
            disabled={!editing}
            inputRef={textareaRef}
            sx={{
              "& .MuiOutlinedInput-root": {
                fontFamily: "monospace",
                fontSize: "0.78rem",
                background: editing
                  ? "rgba(0,0,0,0.45)"
                  : "rgba(255,255,255,0.02)",
                "& fieldset": {
                  borderColor: editing
                    ? "rgba(255, 183, 77, 0.4)"
                    : "rgba(255,255,255,0.08)",
                },
                "&:hover fieldset": {
                  borderColor: editing
                    ? "rgba(255, 183, 77, 0.6)"
                    : "rgba(255,255,255,0.12)",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#FFB74D",
                },
                "&.Mui-disabled": {
                  "& fieldset": {
                    borderColor: "rgba(255,255,255,0.06)",
                  },
                },
              },
              "& .MuiOutlinedInput-input": {
                color: "rgba(255,255,255,0.88)",
                lineHeight: 1.6,
              },
              "& .MuiOutlinedInput-input.Mui-disabled": {
                WebkitTextFillColor: "rgba(255,255,255,0.55)",
                color: "rgba(255,255,255,0.55)",
              },
            }}
          />
          {!editing && (
            <Box
              sx={{
                position: "absolute",
                top: 8,
                right: 12,
                px: 1,
                py: 0.25,
                borderRadius: 1,
                background: "rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                fontSize: "0.65rem",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              <LockOutlinedIcon sx={{ fontSize: 12 }} />
              Somente leitura
            </Box>
          )}
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={{ mt: 2.5 }}
        >
          <Typography
            variant="caption"
            sx={{ color: "rgba(255,255,255,0.5)" }}
          >
            {editing
              ? dirty
                ? `${history.length} alteração(ões) — desfaça com o botão abaixo`
                : "Modo edição ativo"
              : isDefault
                ? "Texto padrão (nunca foi editado)"
                : "Texto personalizado pelo admin"}
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {!editing ? (
              <Button
                variant="contained"
                size="medium"
                startIcon={<EditIcon />}
                onClick={handleEdit}
                sx={{
                  background: "linear-gradient(135deg, #2DD4FF, #7B61FF)",
                  color: "#fff",
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": {
                    background: "linear-gradient(135deg, #2DD4FF, #7B61FF)",
                    filter: "brightness(1.1)",
                  },
                }}
              >
                Editar prompt
              </Button>
            ) : (
              <>
                <Button
                  variant="outlined"
                  size="medium"
                  startIcon={<UndoIcon />}
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  sx={{
                    color: "rgba(255,255,255,0.85)",
                    borderColor: "rgba(255,255,255,0.2)",
                    textTransform: "none",
                    "&:hover": {
                      borderColor: "rgba(255,255,255,0.4)",
                      background: "rgba(255,255,255,0.04)",
                    },
                  }}
                >
                  Desfazer ({history.length})
                </Button>
                <Button
                  variant="outlined"
                  size="medium"
                  startIcon={<RestartAltIcon />}
                  onClick={handleResetToDefault}
                  sx={{
                    color: "#FFB74D",
                    borderColor: "rgba(255, 183, 77, 0.5)",
                    textTransform: "none",
                    fontWeight: 600,
                    "&:hover": {
                      borderColor: "#FFB74D",
                      background: "rgba(255, 183, 77, 0.08)",
                    },
                  }}
                >
                  Restaurar padrão
                </Button>
                <Button
                  variant="text"
                  size="medium"
                  startIcon={<CloseIcon />}
                  onClick={handleCancel}
                  disabled={saving}
                  sx={{
                    color: "rgba(255,255,255,0.6)",
                    textTransform: "none",
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="contained"
                  size="medium"
                  startIcon={
                    saving ? (
                      <CircularProgress size={14} sx={{ color: "#fff" }} />
                    ) : (
                      <SaveIcon />
                    )
                  }
                  onClick={handleSave}
                  disabled={!canSave}
                  sx={{
                    background: canSave
                      ? "linear-gradient(135deg, #2DD4FF, #7B61FF)"
                      : "rgba(255,255,255,0.08)",
                    color: "#fff",
                    fontWeight: 600,
                    textTransform: "none",
                    "&:hover": {
                      background: canSave
                        ? "linear-gradient(135deg, #2DD4FF, #7B61FF)"
                        : "rgba(255,255,255,0.08)",
                      filter: canSave ? "brightness(1.1)" : "none",
                    },
                  }}
                >
                  {saving ? "Salvando…" : "Salvar"}
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function AvatarPromptsSection() {
  const [config, setConfig] = useState<PromptConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPromptConfig()
      .then((c) => {
        if (!cancelled) setConfig(c);
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaved = useCallback((key: AvatarPromptKey, value: string) => {
    setConfig((prev) =>
      prev
        ? { ...prev, avatarVideo: { ...prev.avatarVideo, [key]: value } }
        : prev,
    );
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress sx={{ color: "primary.main" }} />
      </Box>
    );
  }

  if (!config) {
    return (
      <Alert severity="error">
        {loadError ?? "Erro ao carregar configuração de prompts."}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography
          sx={{ color: "#fff", fontWeight: 600, mb: 0.5, fontSize: "1.1rem" }}
        >
          Prompts de IA — fluxo do vídeo com avatar
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}
        >
          Os três prompts abaixo são executados em sequência, na ordem em que
          aparecem. Você pode reorganizar variáveis e reescrever qualquer texto
          ao redor delas — desde que as variáveis marcadas como{" "}
          <Box component="span" sx={{ color: "#ff7043", fontWeight: 700 }}>
            obrigatórias ★
          </Box>{" "}
          permaneçam presentes (do contrário a geração quebra).
        </Typography>
      </Box>

      <Stack spacing={0} sx={{ position: "relative" }}>
        {PROMPT_DEFS.map((def, i) => (
          <Box key={def.key}>
            <PromptCard
              def={def}
              index={i}
              savedValue={config.avatarVideo[def.key]}
              onSaved={handleSaved}
            />
            {i < PROMPT_DEFS.length - 1 && (
              <Box
                sx={{
                  width: 2,
                  height: 32,
                  background:
                    "linear-gradient(180deg, rgba(45,212,255,0.4), rgba(123,97,255,0.2))",
                  ml: { xs: 4, md: 6 },
                }}
              />
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
