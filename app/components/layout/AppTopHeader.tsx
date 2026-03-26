"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Typography,
  Popover,
  ButtonBase,
  Chip,
  Stack,
  Divider,
} from "@mui/material";
import { KeyboardArrowDown } from "@mui/icons-material";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { REGION_FLAGS, getStoredRegion, setStoredRegion } from "@/lib/region";
import { HeaderQuota } from "./HeaderQuota";

/**
 * AppTopHeader — header global das páginas /dashboard/*
 *
 * Mostra o seletor de país no canto direito.
 * A região selecionada é persistida em localStorage (padrão: BR).
 * Ao mudar, atualiza a URL atual mantendo todos os outros parâmetros.
 */
export function AppTopHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Inicia com getStoredRegion() para não piscar "BR" se URL já tem outro valor
  const [currentRegion, setCurrentRegion] = useState<string>(() =>
    getStoredRegion(),
  );

  // Lista de regiões disponíveis — carregada do banco via API
  const [regions, setRegions] = useState<string[]>([getStoredRegion()]);
  useEffect(() => {
    fetch("/api/regions")
      .then((r) => r.json())
      .then((data: { regions: string[] }) => {
        if (data.regions?.length) setRegions(data.regions);
      })
      .catch(() => {}); // silencia erros — fallback para a região atual
  }, []);

  // Sincroniza com URL quando ela muda (ex.: navegação direta com ?region=US)
  useEffect(() => {
    const urlRegion = searchParams.get("region")?.toUpperCase();
    if (urlRegion && urlRegion !== currentRegion) {
      setCurrentRegion(urlRegion);
    }
  }, [searchParams, currentRegion]);

  // Popover
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (region: string) => {
      setOpen(false);
      setCurrentRegion(region);
      setStoredRegion(region);

      // Atualiza URL da página atual mantendo outros params
      const params = new URLSearchParams(searchParams.toString());
      params.set("region", region);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const flag = REGION_FLAGS[currentRegion] ?? "🌎";

  return (
    <Box
      component="header"
      sx={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        flexShrink: 0,
        height: { xs: 44, md: 48 },
        minHeight: { xs: 44, md: 48 },
        px: { xs: 2, md: 2.5 },
        background: "rgba(6, 8, 15, 0.75)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Left side — push items to the right */}
      <Box sx={{ flex: 1 }} />

      {/* Quota usage */}
      <Box sx={{ display: { xs: "none", sm: "block" }, mr: 1.5 }}>
        <HeaderQuota />
      </Box>

      {/* Country Selector */}
      <ButtonBase
        ref={anchorRef}
        onClick={() => setOpen(true)}
        aria-label="Selecionar país"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          px: 1.1,
          py: 0.45,
          height: 32,
          borderRadius: 1.5,
          background: "rgba(10, 15, 24, 0.65)",
          backdropFilter: "blur(8px)",
          border: open
            ? "1px solid rgba(45, 212, 255, 0.4)"
            : "1px solid rgba(45, 212, 255, 0.15)",
          boxShadow: "0 0 8px rgba(45, 212, 255, 0.08)",
          transition: "border-color 150ms ease",
          cursor: "pointer",
          "&:hover": {
            borderColor: "rgba(45, 212, 255, 0.35)",
          },
        }}
      >
        <Typography component="span" sx={{ fontSize: "0.9rem", lineHeight: 1 }}>
          {flag}
        </Typography>
        <Typography
          sx={{
            fontSize: "0.7rem",
            fontWeight: 700,
            color: "rgba(255,255,255,0.85)",
            letterSpacing: "0.03em",
          }}
        >
          {currentRegion}
        </Typography>
        <KeyboardArrowDown
          sx={{
            fontSize: 14,
            color: "rgba(255,255,255,0.45)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
      </ButtonBase>

      {/* Popover com os países disponíveis */}
      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              p: 1.5,
              background: "#0d1422",
              border: "1px solid rgba(45,212,255,0.15)",
              borderRadius: 2,
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              minWidth: 200,
            },
          },
        }}
      >
        <Typography
          sx={{
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.4)",
            mb: 1,
          }}
        >
          Selecionar país
        </Typography>
        <Divider sx={{ borderColor: "rgba(255,255,255,0.07)", mb: 1 }} />
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {regions.map((r) => {
            const isActive = r === currentRegion;
            return (
              <Chip
                key={r}
                label={`${REGION_FLAGS[r] ?? "🌎"} ${r}`}
                size="small"
                onClick={() => handleSelect(r)}
                variant={isActive ? "filled" : "outlined"}
                sx={{
                  fontWeight: 600,
                  fontSize: "0.72rem",
                  cursor: "pointer",
                  mb: 0.75,
                  borderColor: isActive ? "#2DD4FF" : "rgba(255,255,255,0.18)",
                  color: isActive ? "#0a0a0f" : "rgba(255,255,255,0.7)",
                  background: isActive ? "#2DD4FF" : "transparent",
                  "&:hover": {
                    borderColor: "#2DD4FF",
                    background: isActive ? "#5BE0FF" : "rgba(45,212,255,0.1)",
                    color: isActive ? "#0a0a0f" : "#fff",
                  },
                }}
              />
            );
          })}
        </Stack>
      </Popover>
    </Box>
  );
}
