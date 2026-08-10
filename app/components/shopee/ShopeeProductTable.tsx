/**
 * app/components/shopee/ShopeeProductTable.tsx
 *
 * Modo lista do "Ranking Shopee" — equivalente da ProductTable do TikTok
 * (app/components/dashboard/DataTable.tsx), com as colunas que existem no
 * ranking da Shopee.
 *
 * POR QUE UM COMPONENTE SEPARADO
 * A ProductTable é do TikTok: recebe ProductDTO, converte USD→BRL com a
 * cotação do dia e tem coluna de link do TikTok. O produto da Shopee já vem
 * em BRL, não tem creators e tem loja e comissão no lugar. Adaptar a tabela
 * do TikTok exigiria tornar quase toda coluna condicional.
 *
 * As colunas espelham as ordenações da página (vendas, receita, comissão,
 * preço), para que ordenar por um chip mostre a coluna correspondente.
 */

"use client";

import { useRouter } from "next/navigation";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Skeleton,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  TrendingUp,
  OpenInNew,
  Inventory2,
  Videocam,
} from "@mui/icons-material";
import { formatNumber } from "@/lib/format";
import type { ShopeeProductTrendDTO } from "@/lib/swr/useShopee";

interface ShopeeProductTableProps {
  products: ShopeeProductTrendDTO[];
  loading?: boolean;
  title: string;
  onProductClick?: (product: ShopeeProductTrendDTO) => void;
}

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=200";

const tableCellSx = {
  color: "rgba(255,255,255,0.7)",
  fontSize: "0.75rem",
  borderColor: "rgba(255,255,255,0.06)",
  py: 0.75,
  px: 1.5,
};

const tableHeaderSx = {
  color: "rgba(255,255,255,0.5)",
  fontSize: "0.6875rem",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  borderColor: "rgba(255,255,255,0.08)",
  py: 1,
  px: 1.5,
};

/** Preço já vem em BRL da Shopee — não há conversão de câmbio aqui. */
function formatBRL(value: number | null | undefined): string {
  if (!value || value <= 0) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const COLS = 7;

function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: COLS }).map((_, j) => (
            <TableCell key={j} sx={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <Skeleton
                variant="text"
                height={20}
                sx={{ bgcolor: "rgba(255,255,255,0.06)" }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}

export function ShopeeProductTable({
  products,
  loading = false,
  title,
  onProductClick,
}: ShopeeProductTableProps) {
  const router = useRouter();

  const handleCreateAvatarVideo = (
    e: React.MouseEvent,
    product: ShopeeProductTrendDTO,
  ) => {
    e.stopPropagation();
    // Mesmos parâmetros que o ShopeeProductCard envia, para que a lista e o
    // card levem exatamente ao mesmo estado do Influencer IA.
    const params = new URLSearchParams();
    params.set("shopeeProductId", product.productExternalId);
    params.set("productName", product.productName);
    params.set("productImageUrl", product.coverUrl || FALLBACK_IMG);
    params.set("productPrice", String(product.price || 0));
    router.push(`/dashboard/influencer-ia?${params.toString()}`);
  };

  return (
    <Box
      sx={{
        borderRadius: 3,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(45, 212, 255, 0.08)",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1.5,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <TrendingUp sx={{ color: "#2DD4FF", fontSize: 18 }} />
        <Typography sx={{ color: "#fff", fontWeight: 600, fontSize: "0.875rem" }}>
          {title}
        </Typography>
      </Box>

      <TableContainer>
        <Table size="small" aria-label={title}>
          <TableHead>
            <TableRow>
              <TableCell sx={tableHeaderSx}>#</TableCell>
              <TableCell sx={tableHeaderSx}>Produto</TableCell>
              <TableCell sx={tableHeaderSx} align="right">
                Preço
              </TableCell>
              <TableCell sx={tableHeaderSx} align="right">
                Vendas
              </TableCell>
              <TableCell sx={tableHeaderSx} align="right">
                Receita
              </TableCell>
              <TableCell sx={tableHeaderSx} align="right">
                Comissão
              </TableCell>
              <TableCell sx={tableHeaderSx} align="center">
                Ações
              </TableCell>
            </TableRow>
          </TableHead>

          {loading ? (
            <TableSkeleton />
          ) : products.length === 0 ? (
            <TableBody>
              <TableRow>
                <TableCell
                  colSpan={COLS}
                  sx={{ ...tableCellSx, textAlign: "center", py: 4 }}
                >
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            <TableBody>
              {products.map((product) => (
                <TableRow
                  key={product.id}
                  onClick={() => onProductClick?.(product)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && onProductClick?.(product)}
                  sx={{
                    cursor: "pointer",
                    transition: "background 0.15s",
                    "&:hover": { background: "rgba(45, 212, 255, 0.04)" },
                    "&:focus-visible": {
                      background: "rgba(45, 212, 255, 0.08)",
                      outline: "none",
                    },
                  }}
                >
                  <TableCell
                    sx={{
                      ...tableCellSx,
                      color: "rgba(255,255,255,0.35)",
                      fontWeight: 700,
                    }}
                  >
                    {product.rankPosition}
                  </TableCell>

                  <TableCell sx={tableCellSx}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      {product.coverUrl ? (
                        <Box
                          component="img"
                          src={product.coverUrl}
                          alt=""
                          sx={{
                            width: 40,
                            height: 40,
                            objectFit: "cover",
                            borderRadius: 1,
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1,
                            background: "rgba(45, 212, 255, 0.08)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Inventory2
                            sx={{ fontSize: 18, color: "rgba(255,255,255,0.3)" }}
                          />
                        </Box>
                      )}
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          sx={{
                            color: "#fff",
                            fontSize: "0.85rem",
                            fontWeight: 500,
                            maxWidth: 260,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {product.productName}
                        </Typography>
                        <Typography
                          sx={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: "0.7rem",
                            maxWidth: 260,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {product.shopName || product.categoryName || "—"}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>

                  <TableCell sx={tableCellSx} align="right">
                    {formatBRL(product.price)}
                  </TableCell>

                  <TableCell sx={tableCellSx} align="right">
                    {product.saleCount > 0 ? formatNumber(product.saleCount) : "—"}
                  </TableCell>

                  <TableCell sx={tableCellSx} align="right">
                    <Typography
                      sx={{ color: "#22c55e", fontWeight: 600, fontSize: "0.85rem" }}
                    >
                      {formatBRL(product.gmv)}
                    </Typography>
                  </TableCell>

                  <TableCell sx={tableCellSx} align="right">
                    {product.commissionRate > 0
                      ? `${(product.commissionRate * 100).toFixed(1).replace(".", ",")}%`
                      : "—"}
                  </TableCell>

                  <TableCell sx={tableCellSx} align="center">
                    <Box
                      sx={{ display: "flex", justifyContent: "center", gap: 0.5 }}
                    >
                      {product.affiliateLink ? (
                        <Tooltip title="Ver na Shopee">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(
                                product.affiliateLink as string,
                                "_blank",
                                "noopener,noreferrer",
                              );
                            }}
                            sx={{
                              color: "rgba(255,255,255,0.5)",
                              "&:hover": { color: "#EE4D2D" },
                            }}
                          >
                            <OpenInNew sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography
                          sx={{ color: "rgba(255,255,255,0.2)", fontSize: "0.75rem" }}
                        >
                          —
                        </Typography>
                      )}

                      <Tooltip title="Criar vídeo com avatar">
                        <IconButton
                          size="small"
                          onClick={(e) => handleCreateAvatarVideo(e, product)}
                          sx={{
                            color: "rgba(255,255,255,0.5)",
                            "&:hover": { color: "secondary.main" },
                          }}
                        >
                          <Videocam sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>
      </TableContainer>
    </Box>
  );
}
