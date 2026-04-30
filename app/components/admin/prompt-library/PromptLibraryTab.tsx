"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Autocomplete,
  Box,
  Card,
  CardContent,
  Button,
  IconButton,
  Stack,
  Typography,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  CircularProgress,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  Add,
  Edit,
  Delete,
  CloudUpload,
  PlayCircleOutline,
  ViewList,
  GridView,
} from "@mui/icons-material";
import { resolveEmbed } from "@/lib/prompt-library/embed";

// ---------------------------------------------------------------------------
// Video thumbnail — shows static poster when available, falls back to play icon
// ---------------------------------------------------------------------------

function VideoThumb({
  url,
  width,
  height,
  onClick,
}: {
  url: string;
  width: number | string;
  height: number | string;
  onClick?: () => void;
}) {
  const embed = resolveEmbed(url);
  const sx = {
    width,
    height,
    flexShrink: 0,
    borderRadius: 1.5,
    bgcolor: "#000",
    overflow: "hidden",
    position: "relative" as const,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: onClick ? "pointer" : "default",
    border: "1px solid rgba(255,255,255,0.08)",
    transition: "border-color 0.15s",
    "&:hover": onClick ? { borderColor: "primary.main" } : undefined,
  };

  // Static thumbnail (YouTube / Vimeo)
  if (embed?.thumbnail) {
    return (
      <Box sx={sx} onClick={onClick}>
        <Box
          component="img"
          src={embed.thumbnail}
          alt=""
          loading="lazy"
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%)",
          }}
        >
          <PlayCircleOutline
            sx={{ color: "#fff", fontSize: 28, opacity: 0.9 }}
          />
        </Box>
      </Box>
    );
  }

  // Direct video file — use first frame as poster
  if (embed?.kind === "video") {
    return (
      <Box sx={sx} onClick={onClick}>
        <Box
          component="video"
          src={`${embed.src}#t=0.5`}
          preload="metadata"
          muted
          playsInline
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%)",
          }}
        >
          <PlayCircleOutline
            sx={{ color: "#fff", fontSize: 28, opacity: 0.9 }}
          />
        </Box>
      </Box>
    );
  }

  // Unknown / TikTok / Instagram — placeholder
  return (
    <Box sx={sx} onClick={onClick}>
      <PlayCircleOutline
        sx={{ color: "primary.main", fontSize: 28, opacity: 0.8 }}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PromptLibraryItem {
  id: string;
  title: string;
  category: string;
  description: string | null;
  videoBlobUrl: string;
  promptText: string;
  isActive: boolean;
  createdByName: string | null;
  createdAt: string;
}

interface FormState {
  id?: string;
  title: string;
  category: string;
  description: string;
  videoBlobUrl: string;
  promptText: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  title: "",
  category: "",
  description: "",
  videoBlobUrl: "",
  promptText: "",
  isActive: true,
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PromptLibraryTab() {
  const [items, setItems] = useState<PromptLibraryItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Persist view-mode preference per user across sessions.
  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("hyppado:promptLibraryAdminView")
        : null;
    if (stored === "grid" || stored === "list") setViewMode(stored);
  }, []);

  const handleViewModeChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, next: "list" | "grid" | null) => {
      if (!next) return;
      setViewMode(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("hyppado:promptLibraryAdminView", next);
      }
    },
    [],
  );

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/prompt-library");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
        setCategories(data.categories ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // ---------------------------------------------------------------------------
  // Dialog helpers
  // ---------------------------------------------------------------------------

  function openCreate() {
    setError(null);
    setUploadedFileName(null);
    setForm({ ...emptyForm });
  }

  function openEdit(item: PromptLibraryItem) {
    setError(null);
    setUploadedFileName(null);
    setForm({
      id: item.id,
      title: item.title,
      category: item.category,
      description: item.description ?? "",
      videoBlobUrl: item.videoBlobUrl,
      promptText: item.promptText,
      isActive: item.isActive,
    });
  }

  function closeDialog() {
    setForm(null);
    setError(null);
    setUploadedFileName(null);
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  async function handleSave() {
    if (!form) return;
    setError(null);

    if (!form.title.trim()) {
      setError("Título é obrigatório");
      return;
    }
    if (!form.category.trim()) {
      setError("Categoria é obrigatória");
      return;
    }
    if (!form.videoBlobUrl.trim()) {
      setError("Vídeo é obrigatório");
      return;
    }
    if (!form.promptText.trim()) {
      setError("Prompt é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        category: form.category.trim(),
        description: form.description.trim() || null,
        videoBlobUrl: form.videoBlobUrl.trim(),
        promptText: form.promptText.trim(),
        isActive: form.isActive,
      };
      const url = form.id
        ? `/api/admin/prompt-library/${form.id}`
        : "/api/admin/prompt-library";
      const res = await fetch(url, {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Falha ao salvar");
        return;
      }
      closeDialog();
      await loadItems();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(item: PromptLibraryItem) {
    await fetch(`/api/admin/prompt-library/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    await loadItems();
  }

  async function handleDeactivate(item: PromptLibraryItem) {
    if (
      !confirm(
        `Desativar "${item.title}"? O item não será mais exibido aos usuários.`,
      )
    )
      return;
    await fetch(`/api/admin/prompt-library/${item.id}`, { method: "DELETE" });
    await loadItems();
  }

  async function handleHardDelete(item: PromptLibraryItem) {
    if (
      !confirm(
        `Excluir permanentemente "${item.title}"? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    await fetch(`/api/admin/prompt-library/${item.id}?hard=true`, {
      method: "DELETE",
    });
    await loadItems();
  }

  async function handleVideoUpload(file: File) {
    if (!form) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/prompt-library/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Falha no upload");
        return;
      }
      const data = await res.json();
      setForm((prev) =>
        prev ? { ...prev, videoBlobUrl: data.videoBlobUrl } : prev,
      );
      setUploadedFileName(file.name);
    } finally {
      setUploading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress sx={{ color: "primary.main" }} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography
        variant="body2"
        sx={{ color: "rgba(255,255,255,0.6)", mb: 2 }}
      >
        Gerencie os exemplos da Biblioteca de Prompts. Apenas itens ativos são
        visíveis para os usuários.
      </Typography>

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h6" sx={{ color: "#fff" }}>
          Itens ({items.length})
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
            aria-label="modo de visualização"
            sx={{
              "& .MuiToggleButton-root": {
                color: "rgba(255,255,255,0.5)",
                borderColor: "rgba(255,255,255,0.12)",
                px: 1.25,
              },
              "& .Mui-selected": {
                color: "primary.main !important",
                bgcolor: "rgba(45,212,255,0.08) !important",
              },
            }}
          >
            <ToggleButton value="list" aria-label="lista">
              <ViewList fontSize="small" />
            </ToggleButton>
            <ToggleButton value="grid" aria-label="grade">
              <GridView fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={openCreate}
            sx={{ bgcolor: "primary.main", color: "#000", fontWeight: 700 }}
          >
            Novo item
          </Button>
        </Stack>
      </Stack>

      {items.length === 0 ? (
        <Card sx={cardStyle}>
          <CardContent>
            <Typography sx={{ color: "rgba(255,255,255,0.5)" }}>
              Nenhum item cadastrado.
            </Typography>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, 1fr)",
              sm: "repeat(3, 1fr)",
              md: "repeat(4, 1fr)",
              lg: "repeat(5, 1fr)",
            },
            gap: 2,
          }}
        >
          {items.map((item) => (
            <Card key={item.id} sx={cardStyle}>
              <Box
                sx={{
                  position: "relative",
                  aspectRatio: "9/16",
                  bgcolor: "#000",
                  overflow: "hidden",
                  borderTopLeftRadius: 12,
                  borderTopRightRadius: 12,
                }}
              >
                <VideoThumb
                  url={item.videoBlobUrl}
                  width="100%"
                  height="100%"
                  onClick={() => setPreviewOpen(item.videoBlobUrl)}
                />
                {!item.isActive && (
                  <Chip
                    label="Inativo"
                    size="small"
                    sx={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      bgcolor: "rgba(0,0,0,0.7)",
                      color: "rgba(255,255,255,0.7)",
                      fontSize: 10,
                      height: 20,
                    }}
                  />
                )}
              </Box>
              <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography
                  sx={{
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 13,
                    lineHeight: 1.3,
                    mb: 0.75,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {item.title}
                </Typography>
                <Chip
                  label={item.category}
                  size="small"
                  sx={{
                    bgcolor: "rgba(45,212,255,0.1)",
                    color: "primary.main",
                    fontSize: 10,
                    height: 20,
                    mb: 1,
                  }}
                />
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Tooltip title={item.isActive ? "Desativar" : "Ativar"}>
                    <Switch
                      checked={item.isActive}
                      onChange={() => handleToggleActive(item)}
                      size="small"
                    />
                  </Tooltip>
                  <Box sx={{ display: "flex", gap: 0.25 }}>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => openEdit(item)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Desativar / Excluir">
                      <IconButton
                        size="small"
                        onClick={() =>
                          item.isActive
                            ? handleDeactivate(item)
                            : handleHardDelete(item)
                        }
                        sx={{ color: "secondary.main" }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {items.map((item) => (
            <Card key={item.id} sx={cardStyle}>
              <CardContent
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  py: 1.5,
                  flexWrap: "wrap",
                  "&:last-child": { pb: 1.5 },
                }}
              >
                {/* Video thumbnail */}
                <VideoThumb
                  url={item.videoBlobUrl}
                  width={56}
                  height={80}
                  onClick={() => setPreviewOpen(item.videoBlobUrl)}
                />

                {/* Info */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    flexWrap="wrap"
                  >
                    <Typography sx={{ color: "#fff", fontWeight: 600 }}>
                      {item.title}
                    </Typography>
                    <Chip
                      label={item.category}
                      size="small"
                      sx={{
                        bgcolor: "rgba(45,212,255,0.1)",
                        color: "primary.main",
                        fontSize: 11,
                      }}
                    />
                    {!item.isActive && (
                      <Chip
                        label="Inativo"
                        size="small"
                        sx={{
                          bgcolor: "rgba(255,255,255,0.05)",
                          color: "rgba(255,255,255,0.4)",
                          fontSize: 11,
                        }}
                      />
                    )}
                  </Stack>
                  {item.description && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "rgba(255,255,255,0.5)",
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 480,
                      }}
                    >
                      {item.description}
                    </Typography>
                  )}
                </Box>

                {/* Active toggle */}
                <Tooltip title={item.isActive ? "Desativar" : "Ativar"}>
                  <Switch
                    checked={item.isActive}
                    onChange={() => handleToggleActive(item)}
                    size="small"
                  />
                </Tooltip>

                {/* Edit */}
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={() => openEdit(item)}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>

                {/* Delete/deactivate */}
                <Tooltip title="Desativar / Excluir">
                  <IconButton
                    size="small"
                    onClick={() =>
                      item.isActive
                        ? handleDeactivate(item)
                        : handleHardDelete(item)
                    }
                    sx={{ color: "secondary.main" }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Create / Edit dialog                                                */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={!!form} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ color: "secondary.main" }}>
          {form?.id ? "Editar item" : "Novo item"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Título"
              value={form?.title ?? ""}
              onChange={(e) =>
                form && setForm({ ...form, title: e.target.value })
              }
              required
              fullWidth
            />

            <Autocomplete
              freeSolo
              options={categories}
              value={form?.category ?? ""}
              onInputChange={(_e, value) =>
                form && setForm({ ...form, category: value })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Categoria"
                  helperText="Digite ou selecione uma categoria existente"
                  required
                  fullWidth
                />
              )}
            />

            <TextField
              label="Descrição (opcional)"
              value={form?.description ?? ""}
              onChange={(e) =>
                form && setForm({ ...form, description: e.target.value })
              }
              fullWidth
              multiline
              minRows={2}
            />

            {/* Video upload */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                {form?.videoBlobUrl && !uploading ? (
                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1,
                      color: "text.secondary",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {uploadedFileName ?? form.videoBlobUrl}
                  </Typography>
                ) : !uploading ? (
                  <TextField
                    label="URL do vídeo"
                    value={form?.videoBlobUrl ?? ""}
                    onChange={(e) =>
                      form && setForm({ ...form, videoBlobUrl: e.target.value })
                    }
                    helperText="Cole uma URL pública ou use o botão Upload"
                    required
                    fullWidth
                    size="small"
                  />
                ) : null}

                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<CloudUpload />}
                  disabled={uploading}
                  sx={{ flexShrink: 0 }}
                >
                  {uploading
                    ? "Enviando..."
                    : form?.videoBlobUrl
                      ? "Trocar vídeo"
                      : "Upload"}
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleVideoUpload(file);
                    }}
                  />
                </Button>
              </Stack>

              {/* Video preview */}
              {form?.videoBlobUrl &&
                !uploading &&
                (() => {
                  const embed = resolveEmbed(form.videoBlobUrl);
                  if (!embed) return null;
                  if (embed.kind === "iframe") {
                    return (
                      <Box
                        component="iframe"
                        src={embed.src}
                        allow="autoplay; fullscreen; picture-in-picture"
                        frameBorder={0}
                        sx={{
                          mt: 1.5,
                          width: "100%",
                          height: 200,
                          borderRadius: 2,
                          bgcolor: "#000",
                          border: "none",
                          display: "block",
                        }}
                      />
                    );
                  }
                  return (
                    <Box
                      component="video"
                      src={embed.src}
                      autoPlay
                      loop
                      muted
                      playsInline
                      sx={{
                        mt: 1.5,
                        width: "100%",
                        maxHeight: 200,
                        borderRadius: 2,
                        bgcolor: "#000",
                        objectFit: "contain",
                      }}
                    />
                  );
                })()}
            </Box>

            <TextField
              label="Prompt"
              value={form?.promptText ?? ""}
              onChange={(e) =>
                form && setForm({ ...form, promptText: e.target.value })
              }
              required
              fullWidth
              multiline
              minRows={4}
              inputProps={{ style: { fontFamily: "monospace", fontSize: 13 } }}
            />

            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                checked={form?.isActive ?? true}
                onChange={(e) =>
                  form && setForm({ ...form, isActive: e.target.checked })
                }
                size="small"
              />
              <Typography
                variant="body2"
                sx={{ color: "rgba(255,255,255,0.7)" }}
              >
                {form?.isActive
                  ? "Ativo (visível para usuários)"
                  : "Inativo (oculto)"}
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || uploading}
            sx={{ bgcolor: "primary.main", color: "#000", fontWeight: 700 }}
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Video preview dialog                                                */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={!!previewOpen}
        onClose={() => setPreviewOpen(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ color: "primary.main" }}>
          Pré-visualização
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center", pb: 3 }}>
          {previewOpen &&
            (() => {
              const embed = resolveEmbed(previewOpen);
              if (!embed) return null;
              if (embed.kind === "iframe") {
                return (
                  <Box
                    component="iframe"
                    src={embed.src}
                    allow="autoplay; fullscreen; picture-in-picture"
                    frameBorder={0}
                    sx={{
                      width: "100%",
                      height: 480,
                      borderRadius: 2,
                      bgcolor: "#000",
                      border: "none",
                      display: "block",
                    }}
                  />
                );
              }
              return (
                <Box
                  component="video"
                  src={embed.src}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                  sx={{
                    width: "100%",
                    maxHeight: 480,
                    borderRadius: 2,
                    bgcolor: "#000",
                  }}
                />
              );
            })()}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
