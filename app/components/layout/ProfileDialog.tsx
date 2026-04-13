"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  TextField,
  Avatar,
  Alert,
  CircularProgress,
  Collapse,
} from "@mui/material";
import { Close } from "@mui/icons-material";

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
  userName: string | null | undefined;
  userEmail: string | null | undefined;
}

/** Extracts up to 2 initials from a name string. */
function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0]?.toUpperCase() ?? "?";
}

export function ProfileDialog({
  open,
  onClose,
  userName,
  userEmail,
}: ProfileDialogProps) {
  // Password change form
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
    setSaving(false);
  };

  const handleClose = () => {
    resetForm();
    setShowPasswordForm(false);
    onClose();
  };

  const handleTogglePassword = () => {
    if (showPasswordForm) {
      resetForm();
    }
    setShowPasswordForm((prev) => !prev);
  };

  const handleSavePassword = async () => {
    setError(null);
    setSuccess(false);

    if (!currentPassword) {
      setError("Digite a senha atual.");
      return;
    }
    if (newPassword.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Erro ao alterar senha.");
        return;
      }

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      // Auto-collapse after success
      setTimeout(() => {
        setShowPasswordForm(false);
        setSuccess(false);
      }, 2000);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const initials = getInitials(userName);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          background: "linear-gradient(165deg, #0D1422 0%, #0A0F18 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 3,
          backdropFilter: "blur(20px)",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 0.5,
        }}
      >
        <Typography
          sx={{
            fontSize: "1.125rem",
            fontWeight: 700,
            color: "secondary.main",
          }}
        >
          Editar Perfil
        </Typography>
        <IconButton
          onClick={handleClose}
          size="small"
          sx={{
            color: "rgba(255,255,255,0.5)",
            "&:hover": { color: "rgba(255,255,255,0.8)" },
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Profile header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar
              sx={{
                width: 48,
                height: 48,
                fontSize: "0.95rem",
                fontWeight: 700,
                bgcolor: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {initials}
            </Avatar>
            <Typography
              sx={{
                fontSize: "1rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.92)",
              }}
            >
              {userName ?? "Usuário"}
            </Typography>
          </Box>

          <Button
            variant="outlined"
            size="small"
            onClick={handleTogglePassword}
            sx={{
              borderColor: "secondary.main",
              color: "secondary.main",
              fontWeight: 600,
              fontSize: "0.75rem",
              textTransform: "none",
              borderRadius: 5,
              px: 2,
              "&:hover": {
                borderColor: "secondary.main",
                background: "rgba(255,45,120,0.08)",
              },
            }}
          >
            {showPasswordForm ? "Cancelar" : "Alterar Senha"}
          </Button>
        </Box>

        {/* Email (read-only) */}
        <Typography
          sx={{
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "rgba(255,255,255,0.6)",
            mb: 0.75,
          }}
        >
          Email
        </Typography>
        <Box
          sx={{
            px: 1.5,
            py: 1.25,
            borderRadius: 1.5,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            mb: 2,
          }}
        >
          <Typography
            sx={{
              fontSize: "0.875rem",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            {userEmail ?? "—"}
          </Typography>
        </Box>

        {/* Password change form */}
        <Collapse in={showPasswordForm}>
          <Box
            sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}
          >
            <TextField
              label="Senha atual"
              type="password"
              size="small"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              fullWidth
              disabled={saving}
              InputLabelProps={{
                sx: { color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" },
              }}
              InputProps={{
                sx: {
                  color: "rgba(255,255,255,0.9)",
                  fontSize: "0.875rem",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255,255,255,0.12)",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255,255,255,0.25)",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "secondary.main",
                  },
                },
              }}
            />
            <TextField
              label="Nova senha"
              type="password"
              size="small"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              disabled={saving}
              helperText="Mínimo de 8 caracteres"
              InputLabelProps={{
                sx: { color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" },
              }}
              InputProps={{
                sx: {
                  color: "rgba(255,255,255,0.9)",
                  fontSize: "0.875rem",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255,255,255,0.12)",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255,255,255,0.25)",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "secondary.main",
                  },
                },
              }}
              FormHelperTextProps={{
                sx: { color: "rgba(255,255,255,0.35)", fontSize: "0.7rem" },
              }}
            />
            <TextField
              label="Confirmar nova senha"
              type="password"
              size="small"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              fullWidth
              disabled={saving}
              InputLabelProps={{
                sx: { color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" },
              }}
              InputProps={{
                sx: {
                  color: "rgba(255,255,255,0.9)",
                  fontSize: "0.875rem",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255,255,255,0.12)",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255,255,255,0.25)",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "secondary.main",
                  },
                },
              }}
            />

            {error && (
              <Alert severity="error" sx={{ fontSize: "0.8rem" }}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" sx={{ fontSize: "0.8rem" }}>
                Senha alterada com sucesso!
              </Alert>
            )}
          </Box>
        </Collapse>
      </DialogContent>

      {showPasswordForm && !success && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            onClick={handleSavePassword}
            disabled={saving}
            sx={{
              bgcolor: "secondary.main",
              fontWeight: 600,
              fontSize: "0.8rem",
              textTransform: "none",
              borderRadius: 2,
              px: 3,
              "&:hover": { bgcolor: "secondary.dark" },
            }}
          >
            {saving ? (
              <CircularProgress size={18} sx={{ color: "#fff" }} />
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
