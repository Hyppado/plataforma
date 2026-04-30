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
import { Add, Edit, Delete, Star, StarBorder } from "@mui/icons-material";

export interface ScenarioRow {
  id: string;
  name: string;
  description: string | null;
  promptHint: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

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
        setError(
          (data as { error?: string }).error ?? "Erro ao salvar cenário",
        );
        return;
      }
      setForm(null);
      await onChanged();
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(row: ScenarioRow) {
    try {
      await fetch(`/api/admin/avatar-video/scenarios/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      await onChanged();
    } catch {
      // silent
    }
  }

  async function handleSetDefault(row: ScenarioRow) {
    if (row.isDefault) return;
    try {
      await fetch(`/api/admin/avatar-video/scenarios/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      await onChanged();
    } catch {
      // silent
    }
  }

  async function handleDelete(row: ScenarioRow) {
    if (
      !window.confirm(
        `Deletar cenário "${row.name}"? Criações associadas perderão a referência.`,
      )
    )
      return;
    try {
      await fetch(`/api/admin/avatar-video/scenarios/${row.id}`, {
        method: "DELETE",
      });
      await onChanged();
    } catch {
      // silent
    }
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
              <CardContent>
                <Stack
                  direction="row"
                  alignItems="flex-start"
                  justifyContent="space-between"
                  gap={1}
                >
                  <Stack spacing={0.5} flex={1} minWidth={0}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Typography
                        sx={{
                          color: "#fff",
                          fontWeight: 600,
                          fontSize: "0.95rem",
                        }}
                      >
                        {row.name}
                      </Typography>
                      {row.isDefault && (
                        <Chip
                          label="Padrão"
                          size="small"
                          sx={{
                            bgcolor: "rgba(45,212,255,0.12)",
                            color: "primary.main",
                            fontSize: "0.68rem",
                            height: 20,
                          }}
                        />
                      )}
                      {!row.isActive && (
                        <Chip
                          label="Inativo"
                          size="small"
                          sx={{
                            bgcolor: "rgba(255,255,255,0.06)",
                            color: "rgba(255,255,255,0.4)",
                            fontSize: "0.68rem",
                            height: 20,
                          }}
                        />
                      )}
                    </Stack>
                    {row.description && (
                      <Typography
                        sx={{
                          color: "rgba(255,255,255,0.5)",
                          fontSize: "0.82rem",
                        }}
                      >
                        {row.description}
                      </Typography>
                    )}
                    {row.promptHint && (
                      <Typography
                        sx={{
                          color: "rgba(45,212,255,0.6)",
                          fontSize: "0.75rem",
                          fontStyle: "italic",
                        }}
                      >
                        Hint: {row.promptHint}
                      </Typography>
                    )}
                  </Stack>

                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <IconButton
                      size="small"
                      title={
                        row.isDefault ? "Cenário padrão" : "Definir como padrão"
                      }
                      onClick={() => handleSetDefault(row)}
                      sx={{
                        color: row.isDefault
                          ? "primary.main"
                          : "rgba(255,255,255,0.3)",
                      }}
                    >
                      {row.isDefault ? (
                        <Star fontSize="small" />
                      ) : (
                        <StarBorder fontSize="small" />
                      )}
                    </IconButton>
                    <Switch
                      size="small"
                      checked={row.isActive}
                      onChange={() => handleToggleActive(row)}
                      sx={{
                        "& .MuiSwitch-thumb": { bgcolor: "primary.main" },
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => openEdit(row)}
                      sx={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(row)}
                      sx={{ color: "rgba(255,80,80,0.7)" }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))
        )}
      </Stack>

      {/* Create / Edit dialog */}
      <Dialog
        open={form !== null}
        onClose={() => setForm(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { bgcolor: "#0D1117", border: "1px solid rgba(255,255,255,0.1)" },
        }}
      >
        <DialogTitle sx={{ color: "#fff" }}>
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
              fullWidth
              required
            />
            <TextField
              label="Descrição (opcional)"
              value={form?.description ?? ""}
              onChange={(e) =>
                form && setForm({ ...form, description: e.target.value })
              }
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Prompt Hint (opcional)"
              helperText="Texto injetado no prompt VEO 3 para guiar a geração"
              value={form?.promptHint ?? ""}
              onChange={(e) =>
                form && setForm({ ...form, promptHint: e.target.value })
              }
              fullWidth
              multiline
              rows={3}
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
              <Typography sx={{ color: "#fff" }}>Ativo</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                checked={form?.isDefault ?? false}
                onChange={(e) =>
                  form && setForm({ ...form, isDefault: e.target.checked })
                }
              />
              <Typography sx={{ color: "#fff" }}>Cenário padrão</Typography>
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
