"use client";

import { useState, useEffect, useCallback } from "react";
import {
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
} from "@mui/material";
import { Add, Edit, Delete, CloudUpload, PlayCircleOutline } from "@mui/icons-material";

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
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/prompt-library");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
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

    if (!form.title.trim()) { setError("Título é obrigatório"); return; }
    if (!form.category.trim()) { setError("Categoria é obrigatória"); return; }
    if (!form.videoBlobUrl.trim()) { setError("Vídeo é obrigatório"); return; }
    if (!form.promptText.trim()) { setError("Prompt é obrigatório"); return; }

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
    if (!confirm(`Desativar "${item.title}"? O item não será mais exibido aos usuários.`)) return;
    await fetch(`/api/admin/prompt-library/${item.id}`, { method: "DELETE" });
    await loadItems();
  }

  async function handleHardDelete(item: PromptLibraryItem) {
    if (!confirm(`Excluir permanentemente "${item.title}"? Esta ação não pode ser desfeita.`)) return;
    await fetch(`/api/admin/prompt-library/${item.id}?hard=true`, { method: "DELETE" });
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
      setForm((prev) => prev ? { ...prev, videoBlobUrl: data.videoBlobUrl } : prev);
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
      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", mb: 2 }}>
        Gerencie os exemplos de prompt exibidos na biblioteca. Apenas itens ativos
        são visíveis para os usuários.
      </Typography>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ color: "#fff" }}>
          Itens ({items.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={openCreate}
          sx={{ bgcolor: "primary.main", color: "#000", fontWeight: 700 }}
        >
          Novo item
        </Button>
      </Stack>

      <Stack spacing={1.5}>
        {items.length === 0 ? (
          <Card sx={cardStyle}>
            <CardContent>
              <Typography sx={{ color: "rgba(255,255,255,0.5)" }}>
                Nenhum item cadastrado.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          items.map((item) => (
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
                {/* Video preview icon */}
                <Tooltip title="Pré-visualizar vídeo">
                  <IconButton
                    size="small"
                    onClick={() => setPreviewOpen(item.videoBlobUrl)}
                    sx={{ color: "primary.main", flexShrink: 0 }}
                  >
                    <PlayCircleOutline />
                  </IconButton>
                </Tooltip>

                {/* Info */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
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
                        sx={{ bgcolor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", fontSize: 11 }}
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
                      item.isActive ? handleDeactivate(item) : handleHardDelete(item)
                    }
                    sx={{ color: "secondary.main" }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </CardContent>
            </Card>
          ))
        )}
      </Stack>

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
              onChange={(e) => form && setForm({ ...form, title: e.target.value })}
              required
              fullWidth
            />

            <TextField
              label="Categoria"
              value={form?.category ?? ""}
              onChange={(e) => form && setForm({ ...form, category: e.target.value })}
              helperText='Ex: "Beleza", "Moda", "Eletrônicos"'
              required
              fullWidth
            />

            <TextField
              label="Descrição (opcional)"
              value={form?.description ?? ""}
              onChange={(e) => form && setForm({ ...form, description: e.target.value })}
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
                  {uploading ? "Enviando..." : form?.videoBlobUrl ? "Trocar vídeo" : "Upload"}
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
              {form?.videoBlobUrl && !uploading && (
                <Box
                  component="video"
                  src={form.videoBlobUrl}
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
              )}
            </Box>

            <TextField
              label="Prompt"
              value={form?.promptText ?? ""}
              onChange={(e) => form && setForm({ ...form, promptText: e.target.value })}
              required
              fullWidth
              multiline
              minRows={4}
              inputProps={{ style: { fontFamily: "monospace", fontSize: 13 } }}
            />

            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                checked={form?.isActive ?? true}
                onChange={(e) => form && setForm({ ...form, isActive: e.target.checked })}
                size="small"
              />
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>
                {form?.isActive ? "Ativo (visível para usuários)" : "Inativo (oculto)"}
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
        <DialogTitle sx={{ color: "primary.main" }}>Pré-visualização</DialogTitle>
        <DialogContent sx={{ textAlign: "center", pb: 3 }}>
          {previewOpen && (
            <Box
              component="video"
              src={previewOpen}
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
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
