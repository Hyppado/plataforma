"use client";

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
  Chip,
  Avatar,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  TrendingUp,
  NewReleases,
  OpenInNew,
  Inventory2,
} from "@mui/icons-material";
import type { ProductDTO, CreatorDTO } from "@/lib/types/dto";
import { formatCurrency, formatNumber } from "@/lib/format";

interface ProductTableProps {
  products: ProductDTO[];
  loading?: boolean;
  title: string;
  showNewBadge?: boolean;
  onProductClick?: (product: ProductDTO) => void;
}

interface CreatorTableProps {
  creators: CreatorDTO[];
  loading?: boolean;
  title: string;
  onCreatorClick?: (creator: CreatorDTO) => void;
}

function TableSkeleton({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j} sx={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <Skeleton
                variant="text"
                width={j === 0 ? "80%" : "60%"}
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

export function ProductTable({
  products,
  loading = false,
  title,
  showNewBadge = false,
  onProductClick,
}: ProductTableProps) {
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
        {showNewBadge ? (
          <NewReleases sx={{ color: "#2DD4FF", fontSize: 18 }} />
        ) : (
          <TrendingUp sx={{ color: "#2DD4FF", fontSize: 18 }} />
        )}
        <Typography
          sx={{ color: "#fff", fontWeight: 600, fontSize: "0.875rem" }}
        >
          {title}
        </Typography>
      </Box>

      <TableContainer>
        <Table size="small" aria-label={title}>
          <TableHead>
            <TableRow>
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
                Creators
              </TableCell>
              <TableCell sx={tableHeaderSx} align="center">
                Links
              </TableCell>
            </TableRow>
          </TableHead>
          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : products.length === 0 ? (
            <TableBody>
              <TableRow>
                <TableCell
                  colSpan={6}
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
                  onKeyDown={(e) =>
                    e.key === "Enter" && onProductClick?.(product)
                  }
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
                  <TableCell sx={tableCellSx}>
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                      {product.imageUrl ? (
                        <Box
                          component="img"
                          src={product.imageUrl}
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
                            sx={{
                              fontSize: 18,
                              color: "rgba(255,255,255,0.3)",
                            }}
                          />
                        </Box>
                      )}
                      <Box>
                        <Typography
                          sx={{
                            color: "#fff",
                            fontSize: "0.85rem",
                            fontWeight: 500,
                            maxWidth: 200,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {product.name}
                        </Typography>
                        <Typography
                          sx={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: "0.7rem",
                          }}
                        >
                          {product.category}
                        </Typography>
                      </Box>
                      {showNewBadge && product.isNew && (
                        <Chip
                          label="NOVO"
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: "0.6rem",
                            fontWeight: 700,
                            backgroundColor: "rgba(45, 212, 255, 0.15)",
                            color: "#2DD4FF",
                          }}
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={tableCellSx} align="right">
                    {formatCurrency(product.priceBRL)}
                  </TableCell>
                  <TableCell sx={tableCellSx} align="right">
                    {formatNumber(product.sales)}
                  </TableCell>
                  <TableCell sx={tableCellSx} align="right">
                    <Typography
                      sx={{
                        color: "#22c55e",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                      }}
                    >
                      {formatCurrency(product.revenueBRL)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={tableCellSx} align="right">
                    {formatNumber(product.creatorCount)}
                  </TableCell>
                  <TableCell sx={tableCellSx} align="center">
                    <Box
                      sx={{
                        display: "flex",
                        gap: 0.5,
                        justifyContent: "center",
                      }}
                    >
                      {product.tiktokUrl && product.tiktokUrl !== "—" && (
                        <Tooltip title="Abrir no TikTok">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(
                                product.tiktokUrl,
                                "_blank",
                                "noopener,noreferrer",
                              );
                            }}
                            sx={{
                              color: "rgba(255,255,255,0.5)",
                              "&:hover": { color: "#2DD4FF" },
                            }}
                          >
                            <OpenInNew sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {product.sourceUrl && product.sourceUrl !== "—" && (
                        <Tooltip title="Ver detalhes">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(
                                product.sourceUrl,
                                "_blank",
                                "noopener,noreferrer",
                              );
                            }}
                            sx={{
                              color: "rgba(255,255,255,0.5)",
                              "&:hover": { color: "#2DD4FF" },
                            }}
                          >
                            <TrendingUp sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
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

export function CreatorTable({
  creators,
  loading = false,
  title,
  onCreatorClick,
}: CreatorTableProps) {
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
          px: 2.5,
          py: 2,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <TrendingUp sx={{ color: "#2DD4FF", fontSize: 20 }} />
        <Typography
          sx={{ color: "#fff", fontWeight: 600, fontSize: "0.95rem" }}
        >
          {title}
        </Typography>
      </Box>

      <TableContainer>
        <Table size="small" aria-label={title}>
          <TableHead>
            <TableRow>
              <TableCell sx={tableHeaderSx}>Criador</TableCell>
              <TableCell sx={tableHeaderSx} align="right">
                Seguidores
              </TableCell>
              <TableCell sx={tableHeaderSx} align="right">
                Curtidas
              </TableCell>
              <TableCell sx={tableHeaderSx} align="right">
                Vídeos
              </TableCell>
              <TableCell sx={tableHeaderSx} align="right">
                Receita
              </TableCell>
              <TableCell sx={tableHeaderSx} align="center">
                Links
              </TableCell>
            </TableRow>
          </TableHead>
          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : creators.length === 0 ? (
            <TableBody>
              <TableRow>
                <TableCell
                  colSpan={6}
                  sx={{ ...tableCellSx, textAlign: "center", py: 4 }}
                >
                  Nenhum criador encontrado.
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            <TableBody>
              {creators.map((creator) => (
                <TableRow
                  key={creator.id}
                  onClick={() => onCreatorClick?.(creator)}
                  tabIndex={0}
                  onKeyDown={(e) =>
                    e.key === "Enter" && onCreatorClick?.(creator)
                  }
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
                  <TableCell sx={tableCellSx}>
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                      <Avatar
                        src={undefined}
                        alt={creator.name}
                        sx={{ width: 36, height: 36 }}
                      >
                        {creator.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography
                          sx={{
                            color: "#fff",
                            fontSize: "0.85rem",
                            fontWeight: 500,
                          }}
                        >
                          {creator.name}
                        </Typography>
                        <Typography
                          sx={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: "0.7rem",
                          }}
                        >
                          {creator.handle}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={tableCellSx} align="right">
                    {formatNumber(creator.followers)}
                  </TableCell>
                  <TableCell sx={tableCellSx} align="right">
                    {formatNumber(creator.likes)}
                  </TableCell>
                  <TableCell sx={tableCellSx} align="right">
                    {formatNumber(creator.videoCount)}
                  </TableCell>
                  <TableCell sx={tableCellSx} align="right">
                    <Typography
                      sx={{
                        color: "#22c55e",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                      }}
                    >
                      {formatCurrency(creator.revenueBRL)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={tableCellSx} align="center">
                    <Box
                      sx={{
                        display: "flex",
                        gap: 0.5,
                        justifyContent: "center",
                      }}
                    >
                      {creator.tiktokUrl && creator.tiktokUrl !== "—" && (
                        <Tooltip title="Abrir no TikTok">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(
                                creator.tiktokUrl,
                                "_blank",
                                "noopener,noreferrer",
                              );
                            }}
                            sx={{
                              color: "rgba(255,255,255,0.5)",
                              "&:hover": { color: "#2DD4FF" },
                            }}
                          >
                            <OpenInNew sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {creator.sourceUrl && creator.sourceUrl !== "—" && (
                        <Tooltip title="Ver detalhes">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(
                                creator.sourceUrl,
                                "_blank",
                                "noopener,noreferrer",
                              );
                            }}
                            sx={{
                              color: "rgba(255,255,255,0.5)",
                              "&:hover": { color: "#2DD4FF" },
                            }}
                          >
                            <TrendingUp sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
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
