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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from "@mui/material";
import { Add, Edit, Delete } from "@mui/icons-material";
import type { ScenarioRow } from "./AvatarVideoTab";

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

interface FormState {
  id?: string;
  name: string;
  description: string;
  promptHint: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

const emptyForm: FormState = {
  name: "",
  description: "",
  promptHint: "",
  isDefault: false,
  isActive: true,
  sortOrder: 0,
};

export function ScenariosSection({
  scenarios,
  onChanged,
}: {
  scenarios: ScenarioRow[];
  onChanged: () => Promise<void> | void;
}) {
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setError(null);
    setForm({ ...emptyForm });
  }

  function openEdit(row: ScenarioRow) {
    setError(null);
    setForm({
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      promptHint: row.promptHint ?? "",
      isDefault: row.isDefault,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    });
  }

  async function handleSave() {
    if (!form) return;
    if (!form.name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        promptHint: form.promptHint.trim() || null,
        isDefault: form.isDefault,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
      };
      const url = form.id
        ? `/api/admin/avatar-video/scenarios/${form.id}`
        : "/api/admin/avatar-video/scenarios";
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

  async function handleToggleActive(row: ScenarioRow) {
    await fetch(`/api/admin/avatar-video/scenarios/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    await onChanged();
  }

  async function handleSetDefault(row: ScenarioRow) {
    await fetch(`/api/admin/avatar-video/scenarios/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    await onChanged();
  }

  async function handleDelete(row: ScenarioRow) {
    if (
      !confirm(
        `Tem certeza que deseja excluir o cenário "${row.name}"? Se ele já tiver sido usado, será apenas desativado.`,
      )
    )
      return;
    await fetch(`/api/admin/avatar-video/scenarios/${row.id}`, {
      method: "DELETE",
    });
    await onChanged();
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ color: "#fff" }}>
          Cenários ({scenarios.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={openCreate}
          sx={{ bgcolor: "primary.main", color: "#000" }}
        >
          Novo cenário
        </Button>
      </Stack>

      <Stack spacing={1.5}>
        {scenarios.length === 0 ? (
          <Card sx={cardStyle}>
            <CardContent>
              <Typography sx={{ color: "rgba(255,255,255,0.5)" }}>
                Nenhum cenário cadastrado.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          scenarios.map((row) => (
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
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography sx={{ color: "#fff", fontWeight: 600 }}>
                      {row.name}
                    </Typography>
                    {row.isDefault && (
                      <Chip
                        label="Padrão"
                        size="small"
                        sx={{
                          bgcolor: "primary.main",
                          color: "#000",
                          height: 20,
                          fontSize: 11,
                        }}
                      />
                    )}
                  </Stack>
                  <Typography
                    variant="caption"
                    sx={{ color: "rgba(255,255,255,0.5)" }}
                  >
                    Ordem: {row.sortOrder}
                    {row.description ? ` · ${row.description}` : ""}
                  </Typography>
                </Box>
                {!row.isDefault && (
                  <Button
                    size="small"
                    onClick={() => handleSetDefault(row)}
                    sx={{ color: "primary.main" }}
                  >
                    Tornar padrão
                  </Button>
                )}
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
          {form?.id ? "Editar cenário" : "Novo cenário"}
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
              label="Descrição"
              helperText="Texto humano que descreve o cenário."
              value={form?.description ?? ""}
              onChange={(e) =>
                form && setForm({ ...form, description: e.target.value })
              }
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Prompt hint"
              helperText="Orientação injetada na geração de imagem/prompt VEO."
              value={form?.promptHint ?? ""}
              onChange={(e) =>
                form && setForm({ ...form, promptHint: e.target.value })
              }
              fullWidth
              multiline
              minRows={3}
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
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                checked={form?.isDefault ?? false}
                onChange={(e) =>
                  form && setForm({ ...form, isDefault: e.target.checked })
                }
              />
              <Typography>Cenário padrão</Typography>
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
