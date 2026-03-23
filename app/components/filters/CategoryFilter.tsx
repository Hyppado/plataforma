"use client";

import { useState, useRef, useMemo } from "react";
import { Box, Popover, ButtonBase, Typography, Divider } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import CheckIcon from "@mui/icons-material/Check";
import type { ShopCategory } from "@/lib/types/echotik";
import type { Category } from "@/lib/categories";

type CategoryItem = ShopCategory | Category;

interface CategoryFilterProps {
  value: string;
  onChange: (category: string) => void;
  categories: (ShopCategory | Category)[] | string[];
  size?: "small" | "medium";
  disabled?: boolean;
  allLabel?: string;
}

function getLabel(cat: CategoryItem): string {
  return (cat as Category).namePt || cat.name;
}

export function CategoryFilter({
  value,
  onChange,
  categories,
  disabled = false,
  allLabel = "Todas",
}: CategoryFilterProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const isCategoryObjects =
    categories.length > 0 && typeof categories[0] !== "string";

  // Build hierarchy once
  const { l1, l2ByParent, flatStrings } = useMemo(() => {
    if (!isCategoryObjects) {
      return {
        l1: [],
        l2ByParent: {} as Record<string, CategoryItem[]>,
        flatStrings: categories as string[],
      };
    }
    const cats = (categories as CategoryItem[]).filter((c) => c.id !== "all");
    const hasLevels = cats.some((c) => (c as Category).level != null);

    if (!hasLevels) {
      return {
        l1: cats,
        l2ByParent: {} as Record<string, CategoryItem[]>,
        flatStrings: [],
      };
    }

    const l1Items = cats.filter((c) => (c as Category).level === 1);
    const l2Items = cats.filter((c) => (c as Category).level === 2);
    const byParent: Record<string, CategoryItem[]> = {};
    for (const c of l2Items) {
      const pid = (c as Category).parentId ?? "";
      if (!byParent[pid]) byParent[pid] = [];
      byParent[pid].push(c);
    }
    return { l1: l1Items, l2ByParent: byParent, flatStrings: [] };
  }, [categories, isCategoryObjects]);

  // Find label for the currently selected value
  const selectedLabel = useMemo(() => {
    if (!value) return null;
    if (!isCategoryObjects) return value;
    const all = categories as CategoryItem[];
    const found = all.find((c) => c.id === value);
    return found ? getLabel(found) : value;
  }, [value, categories, isCategoryObjects]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      {/* Trigger button */}
      <ButtonBase
        ref={anchorRef}
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        sx={{
          height: 36,
          px: 1.5,
          minWidth: 160,
          borderRadius: 1.5,
          border: open
            ? "1px solid #2DD4FF"
            : "1px solid rgba(45,212,255,0.18)",
          backgroundColor: "rgba(255,255,255,0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 0.5,
          transition: "border-color 0.15s",
          "&:hover": { borderColor: "rgba(45,212,255,0.35)" },
        }}
      >
        <Typography
          sx={{
            fontSize: "0.75rem",
            color: selectedLabel ? "#fff" : "rgba(255,255,255,0.45)",
            lineHeight: 1,
            flex: 1,
            textAlign: "left",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selectedLabel ?? "Categoria"}
        </Typography>
        <KeyboardArrowDownIcon
          sx={{
            fontSize: 16,
            color: "rgba(255,255,255,0.5)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
            flexShrink: 0,
          }}
        />
      </ButtonBase>

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
              minWidth: 220,
              maxHeight: 420,
              overflowY: "auto",
              backgroundColor: "#0A0F18",
              border: "1px solid rgba(45,212,255,0.15)",
              borderRadius: 1.5,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            },
          },
        }}
      >
        {/* "Todas" option */}
        <ButtonBase
          onClick={() => select("")}
          sx={{
            width: "100%",
            px: 2,
            py: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor:
              value === "" ? "rgba(45,212,255,0.08)" : "transparent",
            "&:hover": { backgroundColor: "rgba(255,255,255,0.06)" },
          }}
        >
          <Typography
            sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#fff" }}
          >
            {allLabel}
          </Typography>
          {value === "" && (
            <CheckIcon sx={{ fontSize: 14, color: "#2DD4FF" }} />
          )}
        </ButtonBase>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.07)" }} />

        {/* Flat string fallback */}
        {flatStrings.length > 0 &&
          flatStrings.map((s) => (
            <ButtonBase
              key={s}
              onClick={() => select(s)}
              sx={{
                width: "100%",
                px: 2,
                py: 0.875,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor:
                  value === s ? "rgba(45,212,255,0.08)" : "transparent",
                "&:hover": { backgroundColor: "rgba(255,255,255,0.06)" },
              }}
            >
              <Typography
                sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.85)" }}
              >
                {s}
              </Typography>
              {value === s && (
                <CheckIcon sx={{ fontSize: 13, color: "#2DD4FF" }} />
              )}
            </ButtonBase>
          ))}

        {/* Flat no-level objects */}
        {l1.length > 0 &&
          Object.keys(l2ByParent).length === 0 &&
          l1.map((cat) => (
            <ButtonBase
              key={cat.id}
              onClick={() => select(cat.id)}
              sx={{
                width: "100%",
                px: 2,
                py: 0.875,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor:
                  value === cat.id ? "rgba(45,212,255,0.08)" : "transparent",
                "&:hover": { backgroundColor: "rgba(255,255,255,0.06)" },
              }}
            >
              <Typography
                sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.85)" }}
              >
                {getLabel(cat)}
              </Typography>
              {value === cat.id && (
                <CheckIcon sx={{ fontSize: 13, color: "#2DD4FF" }} />
              )}
            </ButtonBase>
          ))}

        {/* Hierarchical L1 → L2 */}
        {l1.map((parent) => {
          const children = l2ByParent[parent.id] ?? [];
          const isExpanded = expanded.has(parent.id);
          const isSelectedL1 = value === parent.id;
          // L1 is "active" if it or any of its children is selected
          const hasSelectedChild = children.some((c) => c.id === value);

          return (
            <Box key={parent.id}>
              {/* L1 row */}
              <ButtonBase
                onClick={() => select(parent.id)}
                sx={{
                  width: "100%",
                  px: 1.5,
                  py: 0.875,
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  backgroundColor: isSelectedL1
                    ? "rgba(45,212,255,0.10)"
                    : hasSelectedChild
                      ? "rgba(45,212,255,0.04)"
                      : "transparent",
                  "&:hover": { backgroundColor: "rgba(45,212,255,0.08)" },
                }}
              >
                {/* Chevron toggles expand without selecting */}
                <Box
                  component="span"
                  onClick={(e) => toggleExpand(parent.id, e)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    color: "rgba(45,212,255,0.6)",
                    p: 0.25,
                    borderRadius: 0.5,
                    "&:hover": { color: "#2DD4FF" },
                  }}
                >
                  {children.length > 0 ? (
                    isExpanded ? (
                      <KeyboardArrowDownIcon sx={{ fontSize: 15 }} />
                    ) : (
                      <KeyboardArrowRightIcon sx={{ fontSize: 15 }} />
                    )
                  ) : (
                    <Box sx={{ width: 15 }} />
                  )}
                </Box>
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color:
                      isSelectedL1 || hasSelectedChild
                        ? "#2DD4FF"
                        : "rgba(255,255,255,0.75)",
                    flex: 1,
                    textAlign: "left",
                  }}
                >
                  {getLabel(parent)}
                </Typography>
                {isSelectedL1 && (
                  <CheckIcon
                    sx={{ fontSize: 13, color: "#2DD4FF", flexShrink: 0 }}
                  />
                )}
              </ButtonBase>

              {/* L2 children — shown when expanded */}
              {isExpanded &&
                children.map((child) => {
                  const isSelected = value === child.id;
                  return (
                    <ButtonBase
                      key={child.id}
                      onClick={() => select(child.id)}
                      sx={{
                        width: "100%",
                        pl: 4.5,
                        pr: 1.5,
                        py: 0.75,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: isSelected
                          ? "rgba(45,212,255,0.10)"
                          : "transparent",
                        "&:hover": {
                          backgroundColor: "rgba(255,255,255,0.05)",
                        },
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: "0.75rem",
                          color: isSelected
                            ? "#2DD4FF"
                            : "rgba(255,255,255,0.75)",
                        }}
                      >
                        {getLabel(child)}
                      </Typography>
                      {isSelected && (
                        <CheckIcon
                          sx={{ fontSize: 13, color: "#2DD4FF", flexShrink: 0 }}
                        />
                      )}
                    </ButtonBase>
                  );
                })}
            </Box>
          );
        })}
      </Popover>
    </>
  );
}
