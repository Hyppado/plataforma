"use client";

import { useState, useEffect } from "react";
import { Box, Typography, Button, Slide, Link } from "@mui/material";
import CookieIcon from "@mui/icons-material/Cookie";

const COOKIE_KEY = "hyppado_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(COOKIE_KEY, "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(COOKIE_KEY, "declined");
    setVisible(false);
  }

  return (
    <Slide direction="up" in={visible} mountOnEnter unmountOnExit>
      <Box
        role="dialog"
        aria-label="Aviso de cookies"
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background:
            "linear-gradient(135deg, rgba(10,15,24,0.98) 0%, rgba(6,8,15,0.98) 100%)",
          borderTop: "1px solid rgba(45,212,255,0.15)",
          backdropFilter: "blur(12px)",
          px: { xs: 2, sm: 4 },
          py: { xs: 2, sm: 2.5 },
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
          gap: { xs: 2, sm: 3 },
        }}
      >
        {/* Icon */}
        <Box
          sx={{
            flexShrink: 0,
            width: 40,
            height: 40,
            borderRadius: "10px",
            background: "rgba(45,212,255,0.1)",
            border: "1px solid rgba(45,212,255,0.2)",
            alignItems: "center",
            justifyContent: "center",
            display: { xs: "none", sm: "flex" },
          }}
        >
          <CookieIcon sx={{ color: "primary.main", fontSize: 20 }} />
        </Box>

        {/* Text */}
        <Box sx={{ flex: 1 }}>
          <Typography
            variant="body2"
            sx={{ color: "rgba(255,255,255,0.9)", fontWeight: 500, mb: 0.25 }}
          >
            Utilizamos cookies para melhorar sua experiência.
          </Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
            Cookies essenciais garantem o funcionamento da plataforma. Consulte
            nossa{" "}
            <Link
              href="/privacidade"
              underline="hover"
              sx={{ color: "primary.main" }}
            >
              Política de Privacidade
            </Link>
            .
          </Typography>
        </Box>

        {/* Actions */}
        <Box sx={{ display: "flex", gap: 1.5, flexShrink: 0 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={decline}
            sx={{
              borderColor: "rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.5)",
              "&:hover": {
                borderColor: "rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.04)",
              },
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Recusar
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={accept}
            sx={{
              background: "primary.main",
              bgcolor: "primary.main",
              color: "primary.contrastText",
              fontWeight: 600,
              textTransform: "none",
              "&:hover": { bgcolor: "primary.dark" },
            }}
          >
            Aceitar
          </Button>
        </Box>
      </Box>
    </Slide>
  );
}
