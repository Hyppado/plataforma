import { Box, Typography, IconButton, Tooltip, ButtonBase } from "@mui/material";
import { Bookmark, BookmarkBorder } from "@mui/icons-material";
import type { ProductDTO } from "@/lib/types/dto";
import { formatCurrency } from "@/lib/format";
import { UI } from "./videoCardConfig";

interface VideoCardProductProps {
  product: ProductDTO;
  thumbnailFallback?: string | null;
  isSaved: boolean;
  onSave: (e: React.MouseEvent) => void;
  hasRealProduct: boolean;
  onProductClick?: () => void;
}

/** Product section inside VideoCard */
export function VideoCardProduct({
  product,
  thumbnailFallback,
  isSaved,
  onSave,
  hasRealProduct,
  onProductClick,
}: VideoCardProductProps) {
  return (
    <ButtonBase
      onClick={onProductClick}
      disabled={!onProductClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        mb: { xs: 1, md: 1.2 },
        p: { xs: 0.8, md: 1 },
        borderRadius: 3,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        width: "100%",
        textAlign: "left",
        cursor: onProductClick ? "pointer" : "default",
        transition: "background 150ms ease, border-color 150ms ease",
        "&:hover": onProductClick ? {
          background: "rgba(255,255,255,0.06)",
          borderColor: "rgba(45,212,255,0.2)",
        } : {},
      }}
    >
      {/* Product thumbnail */}
      <Box
        component="img"
        src={product.imageUrl || thumbnailFallback || ""}
        alt={product.name}
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.opacity = "0.3";
        }}
        sx={{
          width: { xs: 44, md: 48 },
          height: { xs: 44, md: 48 },
          borderRadius: 2.5,
          objectFit: "cover",
          flexShrink: 0,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      />

      {/* Product info */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: { xs: "0.78rem", md: "0.82rem" },
            fontWeight: 600,
            color: UI.text.primary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            mb: 0.2,
          }}
        >
          {product.name}
        </Typography>
        <Typography
          sx={{
            fontSize: { xs: "0.72rem", md: "0.76rem" },
            color: UI.accent,
            fontWeight: 600,
          }}
        >
          {formatCurrency(product.priceBRL, product.currency)}
        </Typography>
      </Box>

      {/* Save product button */}
      {hasRealProduct && (
        <Tooltip title={isSaved ? "Remover dos salvos" : "Salvar produto"}>
          <IconButton
            size="small"
            onClick={onSave}
            sx={{
              width: { xs: 28, md: 30 },
              height: { xs: 28, md: 30 },
              color: isSaved ? UI.accent : "rgba(255,255,255,0.5)",
              border: `1px solid ${isSaved ? UI.accent : "rgba(255,255,255,0.1)"}`,
              transition: "all 160ms ease",
              "&:hover": {
                background: "rgba(255,255,255,0.05)",
                color: UI.accent,
                borderColor: UI.accent,
              },
            }}
          >
            {isSaved ? (
              <Bookmark sx={{ fontSize: { xs: 14, md: 16 } }} />
            ) : (
              <BookmarkBorder sx={{ fontSize: { xs: 14, md: 16 } }} />
            )}
          </IconButton>
        </Tooltip>
      )}
    </ButtonBase>
  );
}
