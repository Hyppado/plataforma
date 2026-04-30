"use client";

import { useState } from "react";
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
} from "@mui/material";
import { Add, Edit, Delete, CloudUpload } from "@mui/icons-material";
import type { AvatarRow } from "./AvatarVideoTab";

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

interface FormState {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  thumbnailUrl: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyForm: FormState = {
  name: "",
  description: "",
  imageUrl: "",
  thumbnailUrl: "",
  isActive: true,
  sortOrder: 0,
};

export function AvatarsSection({
  avatars,
  onChanged,
}: {
  avatars: AvatarRow[];
  onChanged: () => Promise<void> | void;
}) {
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  function openCreate() {
    setError(null);
    setUploadedFileName(null);
    setForm({ ...emptyForm });
  }

  function openEdit(row: AvatarRow) {
    setError(null);
    setUploadedFileName(null);
    setForm({
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      imageUrl: row.imageUrl,
      thumbnailUrl: row.thumbnailUrl ?? "",
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    });
  }

  async function handleSave() {
    if (!form) return;
    if (!form.name.trim() || !form.imageUrl.trim()) {
      setError("Nome e URL da imagem são obrigatórios");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        imageUrl: form.imageUrl.trim(),
        thumbnailUrl: form.thumbnailUrl.trim() || null,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
      };
      const url = form.id
        ? `/api/admin/avatar-video/avatars/${form.id}`
        : "/api/admin/avatar-video/avatars";
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
      setForm(null);
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(row: AvatarRow) {
    await fetch(`/api/admin/avatar-video/avatars/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    await onChanged();
  }

  async function handleDelete(row: AvatarRow) {
    if (
      !confirm(
        `Tem certeza que deseja excluir o avatar "${row.name}"? Se ele já tiver sido usado, será apenas desativado.`,
      )
    )
      return;
    await fetch(`/api/admin/avatar-video/avatars/${row.id}`, {
      method: "DELETE",
    });
    await onChanged();
  }

  async function handleFileUpload(file: File) {
    if (!form) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/avatar-video/avatars/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Falha no upload");
        return;
      }
      const data = await res.json();
      setForm({ ...form, imageUrl: data.url });
      setUploadedFileName(file.name);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ color: "#fff" }}>
          Avatares ({avatars.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={openCreate}
          sx={{ bgcolor: "primary.main", color: "#000" }}
        >
          Novo avatar
        </Button>
      </Stack>

      <Stack spacing={1.5}>
        {avatars.length === 0 ? (
          <Card sx={cardStyle}>
            <CardContent>
              <Typography sx={{ color: "rgba(255,255,255,0.5)" }}>
                Nenhum avatar cadastrado.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          avatars.map((row) => (
            <Card key={row.id} sx={cardStyle}>
              <CardContent
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  py: 1.5,
                  "&:last-child": { pb: 1.5 },
                }}
              >
                <Box
                  component="img"
                  src={row.thumbnailUrl ?? row.imageUrl}
                  alt={row.name}
                  sx={{
                    width: 56,
                    height: 56,
                    objectFit: "cover",
                    borderRadius: 1.5,
                    bgcolor: "rgba(0,0,0,0.2)",
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ color: "#fff", fontWeight: 600 }}>
                    {row.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "rgba(255,255,255,0.5)" }}
                  >
                    Ordem: {row.sortOrder}
                    {row.description ? ` · ${row.description}` : ""}
                  </Typography>
                </Box>
                <Switch
                  checked={row.isActive}
                  onChange={() => handleToggleActive(row)}
                  size="small"
                />
                <IconButton size="small" onClick={() => openEdit(row)}>
                  <Edit fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleDelete(row)}
                  sx={{ color: "secondary.main" }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </CardContent>
            </Card>
          ))
        )}
      </Stack>

      <Dialog
        open={!!form}
        onClose={() => setForm(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ color: "secondary.main" }}>
          {form?.id ? "Editar avatar" : "Novo avatar"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Nome"
              value={form?.name ?? ""}
              onChange={(e) =>
                form && setForm({ ...form, name: e.target.value })
              }
              required
              fullWidth
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
            <Stack direction="row" spacing={1} alignItems="center">
              {uploading ? null : !form?.imageUrl ? (
                <TextField
                  label="URL da imagem"
                  value={form?.imageUrl ?? ""}
                  onChange={(e) =>
                    form && setForm({ ...form, imageUrl: e.target.value })
                  }
                  helperText="Cole uma URL pública ou use o botão Upload"
                  required
                  fullWidth
                />
              ) : uploadedFileName ? (
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
                  {uploadedFileName}
                </Typography>
              ) : null}
              <Button
                component="label"
                variant="outlined"
                startIcon={<CloudUpload />}
                disabled={uploading}
                sx={
                  uploading || (!form?.imageUrl && !uploadedFileName)
                    ? undefined
                    : { flexShrink: 0 }
                }
              >
                {uploading
                  ? "Enviando..."
                  : form?.imageUrl
                    ? "Trocar imagem"
                    : "Upload"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </Button>
            </Stack>
            {form?.imageUrl && (
              <Box
                component="img"
                src={form.imageUrl}
                alt="preview"
                sx={{
                  maxWidth: 200,
                  borderRadius: 2,
                  alignSelf: "center",
                }}
              />
            )}
            <TextField
              label="URL da thumbnail (opcional)"
              value={form?.thumbnailUrl ?? ""}
              onChange={(e) =>
                form && setForm({ ...form, thumbnailUrl: e.target.value })
              }
              fullWidth
            />
            <TextField
              label="Ordem"
              type="number"
              value={form?.sortOrder ?? 0}
              onChange={(e) =>
                form &&
                setForm({
                  ...form,
                  sortOrder: parseInt(e.target.value, 10) || 0,
                })
              }
              fullWidth
            />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                checked={form?.isActive ?? true}
                onChange={(e) =>
                  form && setForm({ ...form, isActive: e.target.checked })
                }
              />
              <Typography>Ativo</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setForm(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{ bgcolor: "primary.main", color: "#000" }}
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
