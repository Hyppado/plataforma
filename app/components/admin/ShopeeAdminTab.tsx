/**
 * app/components/admin/ShopeeAdminTab.tsx
 *
 * Aba "Shopee" no painel Admin.
 * Permite que administradores visualizem e validem os produtos Achadinhos Shopee,
 * editando/sobrescrevendo o link de afiliado quando necessário.
 *
 * Funcionalidades:
 * - Lista completa de achadinhos com status, produto extraído e link
 * - Indicador visual se o link é original ou foi alterado
 * - Botão de ação para abrir o modal de edição do link
 * - Filtro por status (PENDING, PROCESSING, READY, FAILED)
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Chip,
  LinearProgress,
  TablePagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  Edit,
  CheckCircle,
  HourglassEmpty,
  Error as ErrorIcon,
  OpenInNew,
  Link as LinkIcon,
  Cancel,
} from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { EditAffiliateModal } from "@/app/components/shopee/EditAffiliateModal";
import type {
  ShopeeAchadinhoDTO,
  AchadinhoReviewAction,
  AchadinhoStatus,
} from "@/lib/swr/useShopee";

/**
 * Status revisáveis pelo admin. Deve espelhar REVIEWABLE_STATUSES em
 * app/api/shopee/achadinhos/[id]/route.ts — PROCESSING e FAILED pertencem ao
 * pipeline e o cron pode sobrescrevê-los a qualquer momento.
 */
const REVIEWABLE_STATUSES: AchadinhoStatus[] = ["PENDING", "READY", "REJECTED"];

export function ShopeeAdminTab() {
  const [achadinhos, setAchadinhos] = useState<ShopeeAchadinhoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<ShopeeAchadinhoDTO | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const fetchAchadinhos = useCallback(async () => {
    setLoading(true);
    try {
      // status=all — o admin revisa a fila inteira (PENDING/REJECTED inclusive),
      // não apenas os publicados. pageSize alto: sem ele a API devolve 24 e a
      // paginação client-side abaixo só enxergaria a primeira página.
      const res = await fetch("/api/shopee/achadinhos?status=all&pageSize=1000");
      const data = await res.json();
      if (data.ok) {
        setAchadinhos(data.achadinhos);
      }
    } catch (err) {
      console.error("Erro ao carregar achadinhos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReview = useCallback(
    async (id: string, action: AchadinhoReviewAction) => {
      setReviewingId(id);
      try {
        const res = await fetch(`/api/shopee/achadinhos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          console.error("Erro ao revisar achadinho:", data.error);
          return;
        }
        // Atualiza só a linha afetada — evita recarregar a lista inteira
        setAchadinhos((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: data.achadinho.status } : a)),
        );
      } catch (err) {
        console.error("Erro ao revisar achadinho:", err);
      } finally {
        setReviewingId(null);
      }
    },
    [],
  );

  useEffect(() => {
    fetchAchadinhos();
  }, [fetchAchadinhos]);

  // Filtragem por status
  const filtered = statusFilter === "all"
    ? achadinhos
    : achadinhos.filter((a) => a.status === statusFilter);

  // Paginação
  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleOpenEdit = (achadinho: ShopeeAchadinhoDTO) => {
    setSelectedProduct(achadinho);
    setEditModalOpen(true);
  };

  const handleCloseEdit = () => {
    setEditModalOpen(false);
    setSelectedProduct(null);
  };

  const handleEditSuccess = () => {
    fetchAchadinhos();
  };

  const statusChip = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string }> = {
      READY: { label: "Publicado", color: "#22C55E", bg: "rgba(34, 197, 94, 0.1)" },
      PROCESSING: { label: "Processando", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.1)" },
      FAILED: { label: "Falha", color: "#EF4444", bg: "rgba(239, 68, 68, 0.1)" },
      REJECTED: { label: "Rejeitado", color: "#A855F7", bg: "rgba(168, 85, 247, 0.1)" },
      PENDING: { label: "Aguardando revisão", color: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.05)" },
    };
    const cfg = configs[status] || configs.PENDING;
    return (
      <Chip
        label={cfg.label}
        size="small"
        sx={{
          fontSize: "0.65rem",
          fontWeight: 600,
          background: cfg.bg,
          color: cfg.color,
          border: "none",
          height: 22,
        }}
      />
    );
  };

  return (
    <Box>
      {/* Header da aba */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}>
          {filtered.length} achadinhos encontrados
        </Typography>

        {/* Filtro por status */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel
            sx={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "0.75rem",
              "&.Mui-focused": { color: "#2DD4FF" },
            }}
          >
            Status
          </InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            sx={{
              color: "#fff",
              fontSize: "0.75rem",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(255,255,255,0.1)",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(45, 212, 255, 0.3)",
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: "#2DD4FF",
              },
              "& .MuiSvgIcon-root": { color: "rgba(255,255,255,0.5)" },
            }}
          >
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="PENDING">Aguardando revisão</MenuItem>
            <MenuItem value="READY">Publicado</MenuItem>
            <MenuItem value="REJECTED">Rejeitado</MenuItem>
            <MenuItem value="PROCESSING">Processando</MenuItem>
            <MenuItem value="FAILED">Falha</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Loading */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Tabela */}
      <TableContainer
        sx={{
          borderRadius: 2,
          border: "1px solid rgba(255,255,255,0.06)",
          background: "#0D121C",
          "&::-webkit-scrollbar": { width: 6, height: 6 },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            background: "rgba(255,255,255,0.1)",
            borderRadius: 3,
          },
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.65rem", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                STATUS
              </TableCell>
              <TableCell sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.65rem", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                PRODUTO
              </TableCell>
              <TableCell sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.65rem", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                LINK DE AFILIADO
              </TableCell>
              <TableCell sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.65rem", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                CRIADO EM
              </TableCell>
              <TableCell sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.65rem", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                AÇÕES
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginated.map((achadinho) => (
              <TableRow
                key={achadinho.id}
                sx={{
                  "&:hover": { background: "rgba(255,255,255,0.02)" },
                  "& td": { borderBottom: "1px solid rgba(255,255,255,0.04)" },
                }}
              >
                {/* Status */}
                <TableCell sx={{ color: "#fff", fontSize: "0.75rem" }}>
                  {statusChip(achadinho.status)}
                </TableCell>

                {/* Nome do produto */}
                <TableCell sx={{ color: "#fff", fontSize: "0.75rem", maxWidth: 250 }}>
                  <Typography
                    sx={{
                      fontSize: "0.75rem",
                      color: "#fff",
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 250,
                    }}
                  >
                    {achadinho.productName || achadinho.videoTitle || "—"}
                  </Typography>
                  {achadinho.errorMessage && achadinho.status === "FAILED" && (
                    <Tooltip title={achadinho.errorMessage} arrow>
                      <Typography sx={{ fontSize: "0.6rem", color: "#EF4444", mt: 0.25 }}>
                        {achadinho.errorMessage.slice(0, 60)}...
                      </Typography>
                    </Tooltip>
                  )}
                </TableCell>

                {/* Link de afiliado */}
                <TableCell sx={{ maxWidth: 250 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <LinkIcon sx={{ fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
                    <Typography
                      sx={{
                        fontSize: "0.65rem",
                        color: achadinho.affiliateLink ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 200,
                      }}
                    >
                      {achadinho.affiliateLink || "Sem link"}
                    </Typography>
                    {achadinho.affiliateLink && (
                      <Tooltip title="Abrir link" arrow>
                        <IconButton
                          component="a"
                          href={achadinho.affiliateLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="small"
                          sx={{ color: "rgba(255,255,255,0.3)", "&:hover": { color: "#2DD4FF" } }}
                        >
                          <OpenInNew sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                  {/* Indicador de link editado */}
                  {achadinho.originalAffLink && achadinho.originalAffLink !== achadinho.affiliateLink && (
                    <Tooltip title={`Link original: ${achadinho.originalAffLink}`} arrow>
                      <Chip
                        label="Editado"
                        size="small"
                        sx={{
                          mt: 0.25,
                          height: 16,
                          fontSize: "0.55rem",
                          fontWeight: 600,
                          background: alpha("#F59E0B", 0.1),
                          color: "#F59E0B",
                          border: "none",
                        }}
                      />
                    </Tooltip>
                  )}
                </TableCell>

                {/* Data de criação */}
                <TableCell sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", whiteSpace: "nowrap" }}>
                  {new Date(achadinho.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>

                {/* Ações */}
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {/* Gate de aprovação — PROCESSING/FAILED pertencem ao pipeline */}
                  {achadinho.status !== "READY" &&
                    REVIEWABLE_STATUSES.includes(achadinho.status) && (
                      <Tooltip title="Aprovar e publicar" arrow>
                        <span>
                          <IconButton
                            size="small"
                            disabled={reviewingId === achadinho.id}
                            onClick={() => handleReview(achadinho.id, "approve")}
                            sx={{
                              color: "#22C55E",
                              "&:hover": { background: alpha("#22C55E", 0.1) },
                            }}
                          >
                            <CheckCircle sx={{ fontSize: 16 }} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}

                  {achadinho.status !== "REJECTED" &&
                    REVIEWABLE_STATUSES.includes(achadinho.status) && (
                      <Tooltip
                        title={
                          achadinho.status === "READY"
                            ? "Despublicar e rejeitar"
                            : "Rejeitar"
                        }
                        arrow
                      >
                        <span>
                          <IconButton
                            size="small"
                            disabled={reviewingId === achadinho.id}
                            onClick={() => handleReview(achadinho.id, "reject")}
                            sx={{
                              color: "#A855F7",
                              "&:hover": { background: alpha("#A855F7", 0.1) },
                            }}
                          >
                            <Cancel sx={{ fontSize: 16 }} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}

                  <Tooltip title="Editar link de afiliado" arrow>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenEdit(achadinho)}
                      sx={{
                        color: "#F59E0B",
                        "&:hover": { background: alpha("#F59E0B", 0.1) },
                      }}
                    >
                      <Edit sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}

            {/* Estado vazio */}
            {!loading && paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} sx={{ textAlign: "center", py: 4 }}>
                  <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>
                    Nenhum achadinho encontrado.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Paginação */}
      <TablePagination
        component="div"
        count={filtered.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 25, 50]}
        sx={{
          color: "rgba(255,255,255,0.6)",
          fontSize: "0.75rem",
          "& .MuiTablePagination-toolbar": { minHeight: 48 },
          "& .MuiSvgIcon-root": { color: "rgba(255,255,255,0.5)" },
          "& .MuiTablePagination-select": { color: "#fff" },
        }}
        labelRowsPerPage="Linhas por página"
      />

      {/* Modal de edição de link */}
      {selectedProduct && (
        <EditAffiliateModal
          open={editModalOpen}
          onClose={handleCloseEdit}
          product={selectedProduct}
          onSuccess={handleEditSuccess}
        />
      )}
    </Box>
  );
}