"use client";

import { useEffect } from "react";
import { Box, Button, Typography } from "@mui/material";
import { ErrorOutline } from "@mui/icons-material";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error boundary caught:", error);
  }, [error]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(165deg, #0D1422 0%, #0A0F18 100%)",
        p: 3,
      }}
    >
      <Box
        sx={{
          maxWidth: 500,
          textAlign: "center",
          p: 4,
          borderRadius: 3,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <ErrorOutline
          sx={{
            fontSize: 64,
            color: "#ff4757",
            mb: 2,
          }}
        />
        <Typography
          variant="h5"
          sx={{
            color: "white",
            fontWeight: 600,
            mb: 1,
          }}
        >
          Algo deu errado
        </Typography>
        <Typography
          sx={{
            color: "rgba(255,255,255,0.6)",
            mb: 3,
          }}
        >
          Ocorreu um erro inesperado. Tente novamente ou entre em contato com o
          suporte.
          {error.digest && (
            <Typography
              component="span"
              sx={{ display: "block", mt: 1, fontSize: 12, opacity: 0.5 }}
            >
              Ref: {error.digest}
            </Typography>
          )}
        </Typography>
        <Button
          variant="contained"
          onClick={reset}
          sx={{
            background: "linear-gradient(135deg, #2DD4FF 0%, #1E90FF 100%)",
            color: "white",
            fontWeight: 600,
            textTransform: "none",
            px: 3,
            "&:hover": {
              background: "linear-gradient(135deg, #1E90FF 0%, #2DD4FF 100%)",
            },
          }}
        >
          Tentar novamente
        </Button>
      </Box>
    </Box>
  );
}
