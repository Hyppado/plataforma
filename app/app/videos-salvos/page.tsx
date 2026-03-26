"use client";

import { Box, Container, Typography, Grid, Button } from "@mui/material";
import { BookmarkBorder, VideoLibrary } from "@mui/icons-material";
import Link from "next/link";
import { VideoCard } from "@/app/components/cards/VideoCard";
import { useSavedVideos } from "@/lib/storage/saved";

export default function VideosSalvosPage() {
  const savedVideos = useSavedVideos();
  const videos = savedVideos.videos.map((item) => item.video);
  const isEmpty = videos.length === 0;

  return (
    <Container maxWidth="xl" disableGutters>
      {/* Header */}
      <Box
        sx={{
          mb: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: "1.5rem", md: "1.75rem" },
              fontWeight: 700,
              color: "#fff",
              mb: 0.5,
            }}
          >
            Vídeos salvos
          </Typography>
          <Typography
            sx={{
              fontSize: "0.875rem",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            {!isEmpty
              ? `${videos.length} ${videos.length === 1 ? "vídeo salvo" : "vídeos salvos"}`
              : "Itens que você marcou para revisar depois."}
          </Typography>
        </Box>

        {!isEmpty && (
          <Button
            size="small"
            onClick={() => {
              if (confirm("Remover todos os vídeos salvos?")) {
                savedVideos.clear();
              }
            }}
            sx={{
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.5)",
              textTransform: "none",
              "&:hover": {
                color: "rgba(255,255,255,0.8)",
                background: "rgba(255,255,255,0.05)",
              },
            }}
          >
            Limpar salvos
          </Button>
        )}
      </Box>

      {/* Empty State */}
      {isEmpty && (
        <Box
          sx={{
            borderRadius: 3,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(45, 212, 255, 0.08)",
            p: 6,
            textAlign: "center",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <BookmarkBorder
              sx={{
                fontSize: 64,
                color: "rgba(255,255,255,0.15)",
              }}
            />
            <Box>
              <Typography
                sx={{
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.9)",
                  mb: 1,
                }}
              >
                Você ainda não salvou nenhum vídeo.
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.875rem",
                  color: "rgba(255,255,255,0.5)",
                  mb: 3,
                }}
              >
                Quando você salvar, eles aparecerão aqui.
              </Typography>
              <Button
                component={Link}
                href="/app/videos"
                variant="outlined"
                startIcon={<VideoLibrary />}
                sx={{
                  borderRadius: 3,
                  textTransform: "none",
                  fontSize: "0.875rem",
                  borderColor: "rgba(45, 212, 255, 0.3)",
                  color: "#2DD4FF",
                  "&:hover": {
                    borderColor: "#2DD4FF",
                    background: "rgba(45, 212, 255, 0.08)",
                  },
                }}
              >
                Ver Vídeos em Alta
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* Videos Grid */}
      {!isEmpty && (
        <Grid container spacing={{ xs: 2, md: 2.5 }}>
          {videos.map((video) => (
            <Grid item xs={6} sm={6} md={6} lg={3} key={video.id}>
              <VideoCard video={video} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
