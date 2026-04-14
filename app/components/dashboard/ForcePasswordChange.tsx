"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Typography,
  Stack,
} from "@mui/material";
import { LockReset as LockResetIcon } from "@mui/icons-material";
import { signOut } from "next-auth/react";

/**
 * Full-screen modal that forces the user to change their temporary password.
 * Cannot be dismissed — must change password or sign out.
 */
export function ForcePasswordChange() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(async () => {
    setError(null);

    if (newPassword.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao alterar senha");
        return;
      }
      setSuccess(true);
      // Reload the page to update the session (JWT will no longer have mustChangePassword)
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch {
      setError("Erro de conexão");
    } finally {
      setSubmitting(false);
    }
  }, [newPassword, confirmPassword]);

  const handleSignOut = useCallback(() => {
    signOut({ callbackUrl: "/login" });
  }, []);

  return (
    <Dialog
      open
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          background: "#0d1422",
          border: "1px solid rgba(255,255,255,0.08)",
        },
      }}
    >
      <DialogTitle sx={{ color: "common.white", fontWeight: 700 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <LockResetIcon sx={{ color: "secondary.main" }} />
          <span>Altere sua senha</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography
          sx={{
            color: "rgba(255,255,255,0.7)",
            fontSize: "0.9rem",
            mb: 2.5,
            lineHeight: 1.6,
          }}
        >
          Você está usando uma senha temporária. Para sua segurança, crie uma
          nova senha antes de continuar.
        </Typography>

        {success ? (
          <Alert severity="success">
            Senha alterada com sucesso! Redirecionando...
          </Alert>
        ) : (
          <Stack spacing={2}>
            <TextField
              label="Nova senha"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              autoFocus
              helperText="Mínimo 8 caracteres"
              sx={inputSx}
            />
            <TextField
              label="Confirmar nova senha"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              fullWidth
              sx={inputSx}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      {!success && (
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
          <Button
            onClick={handleSignOut}
            sx={{ color: "rgba(255,255,255,0.5)" }}
          >
            Sair
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !newPassword || !confirmPassword}
            variant="contained"
            sx={{
              bgcolor: "secondary.main",
              color: "common.white",
              fontWeight: 700,
              "&:hover": { bgcolor: "secondary.dark" },
            }}
          >
            {submitting ? "Salvando..." : "Alterar senha"}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

const inputSx = {
  "& .MuiOutlinedInput-root": {
    color: "common.white",
    "& fieldset": { borderColor: "rgba(255,255,255,0.15)" },
  },
  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.5)" },
  "& .MuiFormHelperText-root": { color: "rgba(255,255,255,0.4)" },
};
