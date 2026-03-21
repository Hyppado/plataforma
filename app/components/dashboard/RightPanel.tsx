"use client";

import {
  Box,
  Typography,
  Skeleton,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Bookmark,
  FolderOpen,
  Notifications,
  Notes,
  ArrowForward,
  TrendingUp,
  TrendingDown,
} from "@mui/icons-material";
import type {
  SavedItemDTO,
  CollectionDTO,
  AlertDTO,
  NoteDTO,
} from "@/lib/types/dto";

interface RightPanelProps {
  savedItems: SavedItemDTO[];
  collections: CollectionDTO[];
  alerts: AlertDTO[];
  notes: NoteDTO[];
  loading?: boolean;
  onSavedClick?: (item: SavedItemDTO) => void;
  onCollectionClick?: (collection: CollectionDTO) => void;
  onAlertClick?: (alert: AlertDTO) => void;
  onNoteClick?: (note: NoteDTO) => void;
  onViewAllSaved?: () => void;
  onViewAllCollections?: () => void;
  onViewAllAlerts?: () => void;
  onViewAllNotes?: () => void;
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  onViewAll?: () => void;
  children: React.ReactNode;
}

function Section({ title, icon, count, onViewAll, children }: SectionProps) {
  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 3,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(45, 212, 255, 0.08)",
        mb: 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ color: "#2DD4FF", display: "flex" }}>{icon}</Box>
          <Typography
            sx={{
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            {title}
          </Typography>
          <Chip
            label={count}
            size="small"
            sx={{
              height: 20,
              fontSize: "0.7rem",
              fontWeight: 600,
              backgroundColor: "rgba(45, 212, 255, 0.12)",
              color: "#2DD4FF",
            }}
          />
        </Box>
        {onViewAll && (
          <Tooltip title="Ver todos">
            <IconButton
              onClick={onViewAll}
              size="small"
              aria-label={`Ver todos ${title}`}
              sx={{
                color: "rgba(255,255,255,0.4)",
                "&:hover": { color: "#2DD4FF" },
              }}
            >
              <ArrowForward fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {children}
    </Box>
  );
}

function ItemSkeleton() {
  return (
    <Box sx={{ display: "flex", gap: 1.5, py: 1 }}>
      <Skeleton
        variant="rounded"
        width={48}
        height={32}
        sx={{ bgcolor: "rgba(255,255,255,0.06)", borderRadius: 1 }}
      />
      <Box sx={{ flex: 1 }}>
        <Skeleton
          variant="text"
          width="80%"
          height={16}
          sx={{ bgcolor: "rgba(255,255,255,0.06)" }}
        />
        <Skeleton
          variant="text"
          width="50%"
          height={14}
          sx={{ bgcolor: "rgba(255,255,255,0.06)" }}
        />
      </Box>
    </Box>
  );
}

export function RightPanel({
  savedItems,
  collections,
  alerts,
  notes,
  loading = false,
  onSavedClick,
  onCollectionClick,
  onAlertClick,
  onNoteClick,
  onViewAllSaved,
  onViewAllCollections,
  onViewAllAlerts,
  onViewAllNotes,
}: RightPanelProps) {
  return (
    <Box component="aside" aria-label="Painel de recursos do usuário">
      {/* Salvos */}
      <Section
        title="Salvos"
        icon={<Bookmark fontSize="small" />}
        count={savedItems.length}
        onViewAll={onViewAllSaved}
      >
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <ItemSkeleton key={i} />)
        ) : savedItems.length === 0 ? (
          <Typography
            sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", py: 1 }}
          >
            Nenhum item salvo ainda.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            {savedItems.slice(0, 5).map((item) => (
              <Box
                key={item.id}
                onClick={() => onSavedClick?.(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onSavedClick?.(item)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  py: 1,
                  px: 1,
                  borderRadius: 1.5,
                  cursor: "pointer",
                  transition: "background 0.15s",
                  "&:hover": { background: "rgba(45, 212, 255, 0.06)" },
                  "&:focus-visible": {
                    outline: "2px solid #2DD4FF",
                    outlineOffset: 2,
                  },
                }}
              >
                {(item.meta as { thumbnail?: string })?.thumbnail && (
                  <Box
                    component="img"
                    src={(item.meta as { thumbnail?: string })?.thumbnail}
                    alt=""
                    sx={{
                      width: 48,
                      height: 32,
                      objectFit: "cover",
                      borderRadius: 1,
                    }}
                  />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      color: "#fff",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.title || `${item.type} salvo`}
                  </Typography>
                  <Typography
                    sx={{
                      color: "rgba(255,255,255,0.45)",
                      fontSize: "0.7rem",
                    }}
                  >
                    {item.type === "video"
                      ? "Vídeo"
                      : item.type === "product"
                        ? "Produto"
                        : "Criador"}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Section>

      {/* Coleções */}
      <Section
        title="Coleções"
        icon={<FolderOpen fontSize="small" />}
        count={collections.length}
        onViewAll={onViewAllCollections}
      >
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <ItemSkeleton key={i} />)
        ) : collections.length === 0 ? (
          <Typography
            sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", py: 1 }}
          >
            Nenhuma coleção criada.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            {collections.slice(0, 5).map((collection) => (
              <Box
                key={collection.id}
                onClick={() => onCollectionClick?.(collection)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" && onCollectionClick?.(collection)
                }
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  py: 1,
                  px: 1,
                  borderRadius: 1.5,
                  cursor: "pointer",
                  transition: "background 0.15s",
                  "&:hover": { background: "rgba(45, 212, 255, 0.06)" },
                  "&:focus-visible": {
                    outline: "2px solid #2DD4FF",
                    outlineOffset: 2,
                  },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <FolderOpen sx={{ color: "#2DD4FF", fontSize: 18 }} />
                  <Typography
                    sx={{ color: "#fff", fontSize: "0.8rem", fontWeight: 500 }}
                  >
                    {collection.name}
                  </Typography>
                </Box>
                <Chip
                  label={collection.itemCount}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: "0.65rem",
                    backgroundColor: "rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.6)",
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </Section>

      {/* Alertas */}
      <Section
        title="Alertas"
        icon={<Notifications fontSize="small" />}
        count={alerts.filter((a) => !a.read).length}
        onViewAll={onViewAllAlerts}
      >
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <ItemSkeleton key={i} />)
        ) : alerts.length === 0 ? (
          <Typography
            sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", py: 1 }}
          >
            Nenhum alerta no momento.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            {alerts.slice(0, 5).map((alert) => (
              <Box
                key={alert.id}
                onClick={() => onAlertClick?.(alert)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onAlertClick?.(alert)}
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1.5,
                  py: 1,
                  px: 1,
                  borderRadius: 1.5,
                  cursor: "pointer",
                  background: alert.read
                    ? "transparent"
                    : "rgba(45, 212, 255, 0.04)",
                  transition: "background 0.15s",
                  "&:hover": { background: "rgba(45, 212, 255, 0.08)" },
                  "&:focus-visible": {
                    outline: "2px solid #2DD4FF",
                    outlineOffset: 2,
                  },
                }}
              >
                <Box
                  sx={{
                    color:
                      alert.type === "price_drop" ||
                      alert.type === "trending_down"
                        ? "#ef4444"
                        : "#22c55e",
                    mt: 0.25,
                  }}
                >
                  {alert.type === "price_drop" ||
                  alert.type === "trending_down" ? (
                    <TrendingDown fontSize="small" />
                  ) : (
                    <TrendingUp fontSize="small" />
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    sx={{
                      color: "#fff",
                      fontSize: "0.8rem",
                      fontWeight: alert.read ? 400 : 600,
                    }}
                  >
                    {alert.title}
                  </Typography>
                  <Typography
                    sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem" }}
                  >
                    {new Date(alert.createdAt).toLocaleDateString("pt-BR")}
                  </Typography>
                </Box>
                {!alert.read && (
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: "#2DD4FF",
                      mt: 0.5,
                    }}
                  />
                )}
              </Box>
            ))}
          </Box>
        )}
      </Section>

      {/* Notas */}
      <Section
        title="Notas"
        icon={<Notes fontSize="small" />}
        count={notes.length}
        onViewAll={onViewAllNotes}
      >
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <ItemSkeleton key={i} />)
        ) : notes.length === 0 ? (
          <Typography
            sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", py: 1 }}
          >
            Nenhuma nota criada.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            {notes.slice(0, 5).map((note) => (
              <Box
                key={note.id}
                onClick={() => onNoteClick?.(note)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onNoteClick?.(note)}
                sx={{
                  py: 1,
                  px: 1,
                  borderRadius: 1.5,
                  cursor: "pointer",
                  transition: "background 0.15s",
                  "&:hover": { background: "rgba(45, 212, 255, 0.06)" },
                  "&:focus-visible": {
                    outline: "2px solid #2DD4FF",
                    outlineOffset: 2,
                  },
                }}
              >
                <Typography
                  sx={{
                    color: "#fff",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    mb: 0.25,
                  }}
                >
                  {note.content.slice(0, 50)}
                  {note.content.length > 50 ? "..." : ""}
                </Typography>
                <Typography
                  sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem" }}
                >
                  {note.type === "video"
                    ? "Vídeo"
                    : note.type === "product"
                      ? "Produto"
                      : "Criador"}{" "}
                  • {new Date(note.createdAt).toLocaleDateString("pt-BR")}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Section>
    </Box>
  );
}
