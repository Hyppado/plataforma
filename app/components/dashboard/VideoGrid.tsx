"use client";

import { Box, Grid, Typography } from "@mui/material";
import { VideoCard } from "./VideoCard";
import type { VideoDTO } from "@/lib/types/dto";

const GRID_SIZE = 10;

interface VideoGridProps {
  videos: VideoDTO[];
  loading?: boolean;
  error?: string | null;
  onVideoClick?: (video: VideoDTO) => void;
  onVideoSave?: (video: VideoDTO) => void;
  onAddToCollection?: (video: VideoDTO) => void;
  savedVideoIds?: Set<string>;
}

/**
 * VideoGrid component that always renders exactly 10 card slots.
 *
 * States:
 * - loading: Shows 10 skeleton cards
 * - error: Shows error banner + 10 skeleton cards (maintains layout)
 * - empty: Shows "Sem dados" message + 10 skeleton cards (maintains layout)
 * - success: Shows actual video cards, fills remaining slots with skeletons if < 10
 */
export function VideoGrid({
  videos,
  loading = false,
  error = null,
  onVideoClick,
  onVideoSave,
  onAddToCollection,
  savedVideoIds = new Set(),
}: VideoGridProps) {
  const isEmpty = !loading && !error && videos.length === 0;
  const hasError = !!error;

  // Always render exactly GRID_SIZE slots
  const slots = Array.from({ length: GRID_SIZE }, (_, index) => {
    const video = videos[index];
    const shouldShowSkeleton = loading || hasError || isEmpty || !video;

    return {
      key: video?.id ?? `skeleton-${index}`,
      video: shouldShowSkeleton ? undefined : video,
      isLoading: shouldShowSkeleton,
      rank: index + 1,
    };
  });

  return (
    <Box>
      {/* Error banner */}
      {hasError && (
        <Box
          role="alert"
          aria-live="assertive"
          sx={{
            mb: 3,
            p: 2.5,
            borderRadius: 2,
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          <Typography sx={{ color: "#ef4444", fontSize: "0.875rem" }}>
            {error}
          </Typography>
        </Box>
      )}

      {/* Empty state message */}
      {isEmpty && (
        <Box
          role="status"
          aria-live="polite"
          sx={{
            mb: 3,
            p: 2.5,
            borderRadius: 2,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(45, 212, 255, 0.08)",
          }}
        >
          <Typography
            sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.875rem" }}
          >
            Sem dados para este período.
          </Typography>
        </Box>
      )}

      {/* Grid always renders 10 slots */}
      <Grid
        container
        spacing={{ xs: 1.5, md: 2 }}
        role="list"
        aria-label="Lista de v\u00eddeos"
      >
        {slots.map(({ key, video, isLoading, rank }) => (
          <Grid item xs={6} sm={6} md={4} lg={2.4} key={key} role="listitem">
            <VideoCard
              video={video}
              rank={video ? rank : undefined}
              isLoading={isLoading}
              onClick={onVideoClick}
              onSave={onVideoSave}
              onAddToCollection={onAddToCollection}
              isSaved={video ? savedVideoIds.has(video.id) : false}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default VideoGrid;
