"use client";

import { Box, Typography, Button, Skeleton } from "@mui/material";
import {
  Inventory2,
  ArrowForward,
  SwapHoriz,
  Close,
} from "@mui/icons-material";
import type { CreationDTO } from "@/lib/avatar-video/types";
import { formatCurrency } from "@/lib/format";

interface StepProductConfirmProps {
  creation: CreationDTO;
  onContinue: () => void;
  onChangeProduct: () => void;
  onCancel: () => void;
}

export function StepProductConfirmSkeleton() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      <Skeleton
        variant="rectangular"
        sx={{
          width: 220,
          height: 220,
          borderRadius: 3,
          bgcolor: "rgba(255,255,255,0.06)",
        }}
      />
      <Box
        sx={{
          width: "100%",
          maxWidth: 400,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <Skeleton
          variant="text"
          sx={{ bgcolor: "rgba(255,255,255,0.06)", height: 32 }}
        />
        <Skeleton
          variant="text"
          width="60%"
          sx={{ bgcolor: "rgba(255,255,255,0.06)" }}
        />
      </Box>
    </Box>
  );
}

export function StepProductConfirm({
  creation,
  onContinue,
  onChangeProduct,
  onCancel,
}: StepProductConfirmProps) {
  const imageUrl = creation.productSelectedImageUrl ?? creation.productImageUrl;

  const priceDisplay =
    creation.productPriceCents != null && creation.productCurrency
      ? formatCurrency(
          creation.productPriceCents / 100,
          creation.productCurrency,
        )
      : null;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        width: "100%",
      }}
    >
      {/* Product image */}
      <Box
        sx={{
          position: "relative",
          width: 220,
          height: 220,
          borderRadius: 3,
          overflow: "hidden",
          border: "2px solid rgba(45,212,255,0.25)",
          background: "rgba(255,255,255,0.03)",
          flexShrink: 0,
        }}
      >
        {imageUrl ? (
          <Box
            component="img"
            src={imageUrl}
            alt={creation.productName ?? "Produto"}
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Inventory2 sx={{ fontSize: 56, color: "rgba(255,255,255,0.2)" }} />
          </Box>
        )}
      </Box>

      {/* Product info */}
      <Box sx={{ textAlign: "center", width: "100%", maxWidth: 400 }}>
        <Typography
          sx={{
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "rgba(255,255,255,0.92)",
            lineHeight: 1.4,
            mb: 0.75,
          }}
        >
          {creation.productName ?? "Produto sem nome"}
        </Typography>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1.5,
            flexWrap: "wrap",
          }}
        >
          {priceDisplay && (
            <Typography
              sx={{
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "primary.main",
              }}
            >
              {priceDisplay}
            </Typography>
          )}
          {creation.productCategory && (
            <Typography
              sx={{
                fontSize: "0.8rem",
                color: "rgba(255,255,255,0.45)",
                background: "rgba(255,255,255,0.06)",
                borderRadius: 99,
                px: 1.25,
                py: 0.25,
              }}
            >
              {creation.productCategory}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Actions */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          width: "100%",
          maxWidth: 360,
          mt: 1,
        }}
      >
        <Button
          variant="contained"
          size="large"
          endIcon={<ArrowForward />}
          onClick={onContinue}
          sx={{
            background: "linear-gradient(135deg, #2DD4FF 0%, #00B8E6 100%)",
            color: "#06080F",
            fontWeight: 700,
            fontSize: "0.9375rem",
            borderRadius: 3,
            py: 1.25,
            textTransform: "none",
            boxShadow: "0 4px 20px rgba(45,212,255,0.3)",
            "&:hover": {
              background: "linear-gradient(135deg, #6BE0FF 0%, #2DD4FF 100%)",
              boxShadow: "0 4px 24px rgba(45,212,255,0.45)",
            },
          }}
        >
          Continuar
        </Button>

        <Button
          variant="outlined"
          size="large"
          startIcon={<SwapHoriz />}
          onClick={onChangeProduct}
          sx={{
            borderColor: "rgba(255,255,255,0.2)",
            color: "rgba(255,255,255,0.7)",
            fontWeight: 600,
            fontSize: "0.875rem",
            borderRadius: 3,
            py: 1.25,
            textTransform: "none",
            "&:hover": {
              borderColor: "rgba(255,255,255,0.4)",
              color: "#fff",
              background: "rgba(255,255,255,0.04)",
            },
          }}
        >
          Trocar produto
        </Button>

        <Button
          variant="text"
          size="large"
          startIcon={<Close />}
          onClick={onCancel}
          sx={{
            color: "rgba(255,255,255,0.35)",
            fontWeight: 500,
            fontSize: "0.875rem",
            borderRadius: 3,
            py: 1,
            textTransform: "none",
            "&:hover": {
              color: "rgba(255,255,255,0.6)",
              background: "rgba(255,255,255,0.04)",
            },
          }}
        >
          Cancelar
        </Button>
      </Box>
    </Box>
  );
}
