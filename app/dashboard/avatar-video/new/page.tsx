"use client";

import { Box, Typography, Button } from "@mui/material";
import { Videocam, ArrowForward } from "@mui/icons-material";
import { useRouter } from "next/navigation";

export default function AvatarVideoNewPage() {
  const router = useRouter();

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 3,
      }}
    >
      <Box
        sx={{
          textAlign: "center",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2.5,
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(255,45,120,0.12)",
            border: "1px solid rgba(255,45,120,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Videocam sx={{ fontSize: 32, color: "secondary.main" }} />
        </Box>

        <Box>
          <Typography
            component="h1"
            sx={{
              fontSize: "1.35rem",
              fontWeight: 700,
              color: "rgba(255,255,255,0.92)",
              mb: 0.75,
            }}
          >
            Criar vídeo com avatar
          </Typography>
          <Typography
            sx={{
              fontSize: "0.875rem",
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.6,
            }}
          >
            Escolha um produto em alta para começar. A imagem do produto será
            usada como referência para a geração das imagens e do roteiro.
          </Typography>
        </Box>

        <Button
          variant="contained"
          size="large"
          endIcon={<ArrowForward />}
          onClick={() => router.push("/dashboard/trends")}
          sx={{
            background: "linear-gradient(135deg, #FF2D78 0%, #E0256A 100%)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.9375rem",
            borderRadius: 3,
            px: 3.5,
            py: 1.25,
            textTransform: "none",
            boxShadow: "0 4px 20px rgba(255,45,120,0.3)",
            "&:hover": {
              background: "linear-gradient(135deg, #FF5C9A 0%, #FF2D78 100%)",
              boxShadow: "0 4px 24px rgba(255,45,120,0.45)",
            },
          }}
        >
          Escolher produto
        </Button>
      </Box>
    </Box>
  );
}
