"use client";

import { Select, MenuItem, Box, Typography } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import type { TimeRange } from "@/lib/types/dto";

interface PeriodFilterProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
  size?: "sm" | "md";
  persistKey?: string;
  syncToSearchParams?: boolean;
}

const PERIOD_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "1d", label: "Últimos 1 dia" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
];

export function PeriodFilter({
  value,
  onChange,
  size = "md",
  persistKey,
  syncToSearchParams = true,
}: PeriodFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (newValue: TimeRange) => {
    onChange(newValue);

    // Persist to localStorage if key provided
    if (persistKey && typeof window !== "undefined") {
      try {
        localStorage.setItem(`hyppado:filter:${persistKey}`, newValue);
      } catch (error) {
        console.error("Error persisting filter:", error);
      }
    }

    // Update URL search params
    if (syncToSearchParams) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("range", newValue);
      params.delete("page"); // Reset pagination when filter changes
      router.push(`?${params.toString()}`, { scroll: false });
    }
  };

  const isSmall = size === "sm";

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography
        sx={{
          fontSize: isSmall ? "0.75rem" : "0.8125rem",
          fontWeight: 600,
          color: "rgba(255,255,255,0.7)",
          display: { xs: "none", sm: "block" },
        }}
      >
        Período:
      </Typography>
      <Select
        value={value}
        onChange={(e) => handleChange(e.target.value as TimeRange)}
        size="small"
        sx={{
          minWidth: isSmall ? 140 : 160,
          fontSize: isSmall ? "0.75rem" : "0.8125rem",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 2,
          color: "rgba(255,255,255,0.9)",
          "& .MuiOutlinedInput-notchedOutline": {
            border: "none",
          },
          "&:hover": {
            background: "rgba(255,255,255,0.05)",
            borderColor: "rgba(45,212,255,0.2)",
          },
          "&.Mui-focused": {
            background: "rgba(255,255,255,0.05)",
            borderColor: "rgba(45,212,255,0.35)",
          },
          "& .MuiSelect-select": {
            py: isSmall ? 0.75 : 1,
            px: 1.5,
          },
        }}
        MenuProps={{
          PaperProps: {
            sx: {
              background: "#0A0F18",
              border: "1px solid rgba(45,212,255,0.2)",
              borderRadius: 2,
              mt: 0.5,
              "& .MuiMenuItem-root": {
                fontSize: isSmall ? "0.75rem" : "0.8125rem",
                color: "rgba(255,255,255,0.8)",
                "&:hover": {
                  background: "rgba(45,212,255,0.08)",
                },
                "&.Mui-selected": {
                  background: "rgba(45,212,255,0.12)",
                  color: "#2DD4FF",
                  fontWeight: 600,
                  "&:hover": {
                    background: "rgba(45,212,255,0.16)",
                  },
                },
              },
            },
          },
        }}
      >
        {PERIOD_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}
