"use client";

import { Box, IconButton, Tooltip } from "@mui/material";
import { FilterList, Refresh } from "@mui/icons-material";
import { TimeRangeSelect } from "@/app/components/filters/TimeRangeSelect";
import { CategoryFilter } from "@/app/components/filters/CategoryFilter";
import type { TimeRange } from "@/lib/filters/timeRange";
import type { Category } from "@/lib/categories";
import type { ShopCategory } from "@/lib/types/echotik";

interface DashboardHeaderProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  onRefresh?: () => void;
  loading?: boolean;
  // Category filter (opcional)
  category?: string;
  onCategoryChange?: (category: string) => void;
  categories?: (ShopCategory | Category)[] | string[];
}

export function DashboardHeader({
  timeRange,
  onTimeRangeChange,
  onRefresh,
  loading = false,
  category,
  onCategoryChange,
  categories,
}: DashboardHeaderProps) {
  const hasCategoryFilter =
    categories && categories.length > 0 && onCategoryChange;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        gap: 1.5,
        alignItems: { xs: "stretch", md: "center" },
      }}
    >
      {/* Time Range + Category Selector */}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <TimeRangeSelect
          value={timeRange}
          onChange={onTimeRangeChange}
          disabled={loading}
        />
        {hasCategoryFilter && (
          <CategoryFilter
            value={category || ""}
            onChange={onCategoryChange}
            categories={categories}
            disabled={loading}
          />
        )}
      </Box>

      {/* Action Buttons */}
      <Box sx={{ display: "flex", gap: 0.75 }}>
        <Tooltip title="Em breve">
          <span>
            <IconButton
              aria-label="Filtros avançados (em breve)"
              disabled
              sx={{
                color: "rgba(255,255,255,0.3)",
                border: "1px solid rgba(45, 212, 255, 0.08)",
                borderRadius: 1.5,
                width: 36,
                height: 36,
                "&.Mui-disabled": {
                  color: "rgba(255,255,255,0.3)",
                },
              }}
            >
              <FilterList sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>

        {onRefresh && (
          <Tooltip title="Atualizar dados">
            <IconButton
              onClick={onRefresh}
              disabled={loading}
              aria-label="Atualizar dados"
              sx={{
                color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(45, 212, 255, 0.18)",
                borderRadius: 1.5,
                width: 36,
                height: 36,
                "&:hover": {
                  color: "#2DD4FF",
                  borderColor: "rgba(45, 212, 255, 0.35)",
                },
                "&.Mui-disabled": {
                  color: "rgba(255,255,255,0.2)",
                },
              }}
            >
              <Refresh
                className={loading ? "animate-spin" : ""}
                sx={{ fontSize: 18 }}
              />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}
