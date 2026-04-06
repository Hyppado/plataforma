"use client";

import { useRef, useState } from "react";
import {
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  Popover,
  Skeleton,
  Switch,
  Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { REGION_FLAGS } from "@/lib/region";

export interface RegionData {
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

interface RegionSectionProps {
  regions: RegionData[] | undefined;
  loading: boolean;
  onToggle: (code: string, isActive: boolean) => Promise<void>;
}

const MAX_INLINE_FLAGS = 5;

export function RegionSection({
  regions,
  loading,
  onToggle,
}: RegionSectionProps) {
  const [toggling, setToggling] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  if (loading || !regions) {
    return (
      <Box sx={{ mb: 2 }}>
        <Skeleton variant="rounded" height={36} width={200} />
      </Box>
    );
  }

  const activeRegions = regions.filter((r) => r.isActive);
  const activeCount = activeRegions.length;

  async function handleToggle(code: string, current: boolean) {
    setToggling(code);
    try {
      await onToggle(code, !current);
    } finally {
      setToggling(null);
    }
  }

  const inlineFlags = activeRegions.slice(0, MAX_INLINE_FLAGS);
  const extraCount = activeCount - MAX_INLINE_FLAGS;

  return (
    <Box sx={{ mb: 2 }}>
      {/* Compact trigger */}
      <Box
        ref={anchorRef}
        role="button"
        tabIndex={0}
        aria-label="Gerenciar regiões"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((prev) => !prev);
          }
        }}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          px: 1.25,
          py: 0.5,
          borderRadius: 2,
          cursor: "pointer",
          background: "rgba(45, 212, 255, 0.04)",
          border: "1px solid rgba(45, 212, 255, 0.12)",
          transition: "all 0.2s ease",
          "&:hover": {
            background: "rgba(45, 212, 255, 0.08)",
            borderColor: "rgba(45, 212, 255, 0.25)",
          },
        }}
      >
        <Typography sx={{ fontSize: "0.9rem", lineHeight: 1 }}>
          {inlineFlags.map((r) => REGION_FLAGS[r.code] ?? "🌐").join(" ")}
          {extraCount > 0 && ` +${extraCount}`}
        </Typography>

        <Chip
          label={`${activeCount} de ${regions.length}`}
          size="small"
          sx={{
            height: 20,
            fontSize: "0.7rem",
            fontWeight: 700,
            background: "rgba(45, 212, 255, 0.12)",
            color: "#2DD4FF",
          }}
        />

        <KeyboardArrowDownIcon
          sx={{
            fontSize: 18,
            color: "rgba(255,255,255,0.4)",
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </Box>

      {/* Dropdown popover */}
      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              background: "rgba(10, 15, 24, 0.95)",
              border: "1px solid rgba(45, 212, 255, 0.15)",
              borderRadius: 2,
              minWidth: 260,
              maxHeight: 360,
              overflow: "auto",
              backdropFilter: "blur(12px)",
            },
          },
        }}
      >
        <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
          <Typography
            variant="caption"
            sx={{
              color: "rgba(255,255,255,0.45)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Regiões — {activeCount} ativas de {regions.length}
          </Typography>
        </Box>

        <List dense disablePadding>
          {regions.map((region) => {
            const flag = REGION_FLAGS[region.code] ?? "🌐";
            const isToggling = toggling === region.code;

            return (
              <ListItem
                key={region.code}
                sx={{
                  px: 2,
                  py: 0.5,
                  opacity: isToggling ? 0.5 : 1,
                  transition: "opacity 0.2s",
                }}
                secondaryAction={
                  <Switch
                    size="small"
                    checked={region.isActive}
                    disabled={isToggling}
                    onChange={() => handleToggle(region.code, region.isActive)}
                    sx={{
                      width: 32,
                      height: 18,
                      p: 0,
                      "& .MuiSwitch-switchBase": { p: "2px" },
                      "& .MuiSwitch-thumb": { width: 14, height: 14 },
                      "& .MuiSwitch-switchBase.Mui-checked": {
                        color: "#2DD4FF",
                      },
                      "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                        {
                          backgroundColor: "#2DD4FF",
                        },
                    }}
                  />
                }
              >
                <ListItemText
                  primary={
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <Typography sx={{ fontSize: "1rem", lineHeight: 1 }}>
                        {flag}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: region.isActive
                            ? "#fff"
                            : "rgba(255,255,255,0.35)",
                        }}
                      >
                        {region.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "rgba(255,255,255,0.3)" }}
                      >
                        {region.code}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      </Popover>
    </Box>
  );
}
