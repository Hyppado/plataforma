/**
 * app/components/shopee/ShopeeCategoryDropdown.tsx
 *
 * Dropdown de categorias para o Ranking Shopee.
 *
 * Replica a exata estrutura de Categoria/Subcategoria da tela do TikTok
 * (app/components/filters/CategoryFilter.tsx):
 * - "Todas" no topo com checkmark quando selecionada
 * - Categorias Pai em Uppercase (headers/acordeão clicáveis com chevron)
 * - Subcategorias indentadas abaixo da categoria pai (itens reais clicáveis)
 */

"use client";

import { useState, useRef } from "react";
import {
  Box,
  Popover,
  ButtonBase,
  Typography,
  Divider,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import CheckIcon from "@mui/icons-material/Check";
import type { ShopeeCategoryNode } from "@/lib/shopee/shopee-categories";

interface ShopeeCategoryDropdownProps {
  value: string;
  onChange: (category: string) => void;
  categories: ShopeeCategoryNode[];
  disabled?: boolean;
  allLabel?: string;
}

/**
 * Retorna o label de exibição para uma seleção composta "parent::child".
 */
function getSelectedLabel(
  value: string,
  categories: ShopeeCategoryNode[],
): string | null {
  if (!value) return null;

  if (value.includes("::")) {
    const [parent, child] = value.split("::");
    return `${child} (${parent})`;
  }

  // Procurar nos parents
  const found = categories.find((c) => c.parent === value);
  if (found) return found.parent;

  return value;
}

export function ShopeeCategoryDropdown({
  value,
  onChange,
  categories,
  disabled = false,
  allLabel = "Todas",
}: ShopeeCategoryDropdownProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const selectedLabel = getSelectedLabel(value, categories);

  const toggleExpand = (parent: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(parent) ? next.delete(parent) : next.add(parent);
      return next;
    });
  };

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const isParentSelected = (parent: string) => value === parent;
  const hasSelectedChild = (parent: string) =>
    categories.some(
      (c) => c.parent === parent && c.children.includes(value.split("::")[1]),
    );

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
          minWidth: 180,
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
              minWidth: 240,
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
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#fff" }}>
            {allLabel}
          </Typography>
          {value === "" && <CheckIcon sx={{ fontSize: 14, color: "#2DD4FF" }} />}
        </ButtonBase>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.07)" }} />

        {categories.length === 0 && (
          <Box sx={{ px: 2, py: 2, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
              Nenhuma categoria disponível
            </Typography>
          </Box>
        )}

        {categories.map((node) => {
          const isExpanded = expanded.has(node.parent);
          const isSelectedL1 = isParentSelected(node.parent);
          const hasChildSelected = hasSelectedChild(node.parent);

          return (
            <Box key={node.parent}>
              {/* L1 row — categoria pai (acordeão) */}
              <ButtonBase
                onClick={() => select(node.parent)}
                sx={{
                  width: "100%",
                  px: 1.5,
                  py: 0.875,
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  backgroundColor: isSelectedL1
                    ? "rgba(45,212,255,0.10)"
                    : hasChildSelected
                      ? "rgba(45,212,255,0.04)"
                      : "transparent",
                  "&:hover": { backgroundColor: "rgba(45,212,255,0.08)" },
                }}
              >
                {/* Chevron toggles expand without selecting */}
                <Box
                  component="span"
                  onClick={(e) => toggleExpand(node.parent, e)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    color: "rgba(45,212,255,0.6)",
                    p: 0.25,
                    borderRadius: 0.5,
                    "&:hover": { color: "#2DD4FF" },
                  }}
                >
                  {node.children.length > 0 ? (
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
                      isSelectedL1 || hasChildSelected
                        ? "#2DD4FF"
                        : "rgba(255,255,255,0.75)",
                    flex: 1,
                    textAlign: "left",
                  }}
                >
                  {node.parent}
                </Typography>
                {isSelectedL1 && (
                  <CheckIcon sx={{ fontSize: 13, color: "#2DD4FF", flexShrink: 0 }} />
                )}
              </ButtonBase>

              {/* L2 children — subcategorias indentadas */}
              {isExpanded &&
                node.children.map((child) => {
                  const childKey = `${node.parent}::${child}`;
                  const isChildSelected = value === childKey;
                  return (
                    <ButtonBase
                      key={childKey}
                      onClick={() => select(childKey)}
                      sx={{
                        width: "100%",
                        pl: 4.5,
                        pr: 1.5,
                        py: 0.75,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: isChildSelected
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
                          color: isChildSelected
                            ? "#2DD4FF"
                            : "rgba(255,255,255,0.75)",
                        }}
                      >
                        {child}
                      </Typography>
                      {isChildSelected && (
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