"use client";

import { useState, useEffect } from "react";
import { Box, Tooltip } from "@mui/material";
import {
  KeyboardArrowDownRounded,
  KeyboardArrowUpRounded,
} from "@mui/icons-material";

const SECTION_IDS = ["inicio", "como-funciona", "para-quem-e", "planos", "faq"];
const HEADER_OFFSET = 88;

export function ScrollArrows() {
  const [mounted, setMounted] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    setMounted(true);
    setScrollY(window.scrollY);
  }, []);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const showUpArrow = scrollY > 300;

  const handleDownClick = () => {
    const currentY = window.scrollY;
    let targetEl: HTMLElement | null = null;

    for (let i = 0; i < SECTION_IDS.length; i++) {
      const el = document.getElementById(SECTION_IDS[i]);
      if (el && el.offsetTop > currentY + HEADER_OFFSET + 1) {
        targetEl = el;
        break;
      }
    }

    if (targetEl) {
      window.scrollTo({
        top: targetEl.offsetTop - HEADER_OFFSET,
        behavior: "smooth",
      });
    } else {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const handleUpClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!mounted) return null;

  const arrowButtonSx = {
    position: "fixed" as const,
    left: "50%",
    zIndex: 1400,
    width: 48,
    height: 48,
    minWidth: 44,
    minHeight: 44,
    borderRadius: "50%",
    border: "1px solid rgba(255, 255, 255, 0.10)",
    background: "rgba(13, 21, 32, 0.78)",
    backdropFilter: "blur(14px)",
    boxShadow: "0 8px 28px rgba(0, 0, 0, 0.38)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.22s ease",
    "&:hover": {
      borderColor: "rgba(57, 213, 255, 0.30)",
      boxShadow:
        "0 12px 32px rgba(0, 0, 0, 0.45), 0 0 20px rgba(57, 213, 255, 0.15)",
    },
  };

  return (
    <>
      {showUpArrow && (
        <Tooltip title="Voltar ao topo" placement="bottom" arrow>
          <Box
            component="button"
            onClick={handleUpClick}
            aria-label="Voltar ao topo"
            sx={{
              ...arrowButtonSx,
              top: { xs: 78, md: 86 },
              transform: "translateX(-50%)",
              "&:hover": {
                ...arrowButtonSx["&:hover"],
                transform: "translateX(-50%) translateY(2px)",
              },
              "&:active": {
                transform: "translateX(-50%) translateY(0)",
              },
            }}
          >
            <KeyboardArrowUpRounded sx={{ fontSize: 26, color: "#39D5FF" }} />
          </Box>
        </Tooltip>
      )}

      <Tooltip title="Próxima seção" placement="top" arrow>
        <Box
          component="button"
          onClick={handleDownClick}
          aria-label="Rolar para próxima seção"
          sx={{
            ...arrowButtonSx,
            bottom: { xs: 18, md: 24 },
            transform: "translateX(-50%)",
            "&:hover": {
              ...arrowButtonSx["&:hover"],
              transform: "translateX(-50%) translateY(-2px)",
            },
            "&:active": {
              transform: "translateX(-50%) translateY(0)",
            },
          }}
        >
          <KeyboardArrowDownRounded sx={{ fontSize: 26, color: "#39D5FF" }} />
        </Box>
      </Tooltip>
    </>
  );
}
