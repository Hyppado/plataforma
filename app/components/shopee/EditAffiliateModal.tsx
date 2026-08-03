/**
 * app/components/shopee/EditAffiliateModal.tsx
 *
 * Modal para administradores editarem/sobrescreverem o link de afiliado
 * de um produto "Achadinho Shopee".
 *
 * Regras:
 * - Apenas usuários com role ADMIN podem ver e usar este modal.
 * - Preserva o link original em originalAffLink para referência.
 * - Mostra uma prévia do link original antes da edição.
 */

"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogContent,
  TextField,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import { Close, Link as LinkIcon, Restore } from "@mui/icons-material";
import { useUpdateAffiliateLink } from "@/lib/swr/useShopee";
import type { ShopeeAchadinhoDTO } from "@/lib/swr/useShopee";

interface EditAffiliateModalProps {
  open: boolean;
  onClose: () => void;
  product: ShopeeAchadinhoDTO;
  onSuccess?: () => void;
}

export function EditAffiliateModal({
  open,
  onClose,
  product,
  onSuccess,
}: EditAffiliateModalProps) {
  const [affiliateLink, setAffiliateLink] = useState(product.affiliateLink || "");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { updateLink, isUpdating, error } = useUpdateAffiliateLink();

  const handleSave = async () => {
    if (!affiliateLink.trim()) return;

    setSuccessMessage(null);
    try {
      await updateLink({ id: product.id, affiliateLink: affiliateLink.trim() });
      setSuccessMessage("Link de afiliado atualizado com sucesso!");
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 1500);
    } catch {
      // Erro é capturado pelo hook
    }
  };

  const handleRestoreOriginal = () => {
    if (product.originalAffLink) {
      setAffiliateLink(product.originalAffLink);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: "#0D121C",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 3,
          overflow: "hidden",
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 2.5,
          py: 1.5,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <LinkIcon sx={{ fontSize: 18, color: "#2DD4FF" }} />
          <Typography sx={{ fontWeight: 600, color: "#fff", fontSize: "0.9rem" }}>
            Editar Link de Afiliado
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: "rgba(255,255,255,0.5)" }}>
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 2.5 }}>
        {/* Informação do produto */}
        <Box
          sx={{
            p: 1.5,
            mb: 2,
            borderRadius: 2,
            background: "rgba(45, 212, 255, 0.05)",
            border: "1px solid rgba(45, 212, 255, 0.1)",
          }}
        >
          <Typography sx={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", mb: 0.3 }}>
            PRODUTO
          </Typography>
          <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff" }}>
            {product.productName || product.videoTitle || "Produto sem nome"}
          </Typography>
        </Box>

        {/* Link original (se foi alterado antes) */}
        {product.originalAffLink && product.originalAffLink !== product.affiliateLink && (
          <Box
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: 2,
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            <Typography sx={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", mb: 0.3 }}>
              LINK ORIGINAL
            </Typography>
            <Typography
              sx={{
                fontSize: "0.7rem",
                color: "rgba(255,255,255,0.5)",
                wordBreak: "break-all",
              }}
            >
              {product.originalAffLink}
            </Typography>
            <Button
              size="small"
              startIcon={<Restore sx={{ fontSize: 14 }} />}
              onClick={handleRestoreOriginal}
              sx={{
                mt: 0.5,
                fontSize: "0.65rem",
                color: "#F59E0B",
                textTransform: "none",
                "&:hover": { background: "rgba(245, 158, 11, 0.1)" },
              }}
            >
              Restaurar link original
            </Button>
          </Box>
        )}

        {/* Campo de edição */}
        <Typography sx={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", mb: 0.5 }}>
          NOVO LINK DE AFILIADO
        </Typography>
        <TextField
          fullWidth
          value={affiliateLink}
          onChange={(e) => setAffiliateLink(e.target.value)}
          placeholder="https://shopee.com.br/product/..."
          variant="outlined"
          size="small"
          sx={{
            mb: 2,
            "& .MuiOutlinedInput-root": {
              background: "rgba(255,255,255,0.03)",
              color: "#fff",
              fontSize: "0.8rem",
              "& fieldset": {
                borderColor: "rgba(255,255,255,0.1)",
              },
              "&:hover fieldset": {
                borderColor: "rgba(45, 212, 255, 0.3)",
              },
              "&.Mui-focused fieldset": {
                borderColor: "#2DD4FF",
              },
            },
          }}
        />

        {/* Mensagens de feedback */}
        {error && (
          <Alert severity="error" sx={{ mb: 2, fontSize: "0.75rem" }}>
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" sx={{ mb: 2, fontSize: "0.75rem" }}>
            {successMessage}
          </Alert>
        )}

        {/* Botões */}
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button
            onClick={onClose}
            sx={{
              color: "rgba(255,255,255,0.6)",
              textTransform: "none",
              fontSize: "0.8rem",
              "&:hover": { background: "rgba(255,255,255,0.05)" },
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={isUpdating || !affiliateLink.trim()}
            sx={{
              textTransform: "none",
              fontSize: "0.8rem",
              fontWeight: 600,
              background: "linear-gradient(135deg, #2DD4FF 0%, #2563EB 100%)",
              "&:hover": {
                background: "linear-gradient(135deg, #3BDFFF 0%, #3B82F6 100%)",
              },
            }}
          >
            {isUpdating ? (
              <CircularProgress size={16} sx={{ color: "#fff" }} />
            ) : (
              "Salvar"
            )}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}