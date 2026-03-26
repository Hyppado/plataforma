import { Box } from "@mui/material";
import { Skeleton } from "@/app/components/ui/Skeleton";
import { UI } from "./videoCardConfig";

/** Loading skeleton for VideoCard */
export function VideoCardSkeleton() {
  return (
    <Box
      sx={{
        borderRadius: UI.card.radius,
        overflow: "hidden",
        background: UI.card.bg,
        border: `1px solid ${UI.card.border}`,
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: { xs: "4 / 5", sm: "4 / 5", md: "9 / 16" },
          background: "#0a0f18",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #0d1420 0%, #151c2a 100%)",
            "&::after": {
              content: '""',
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, transparent 0%, rgba(45,212,255,0.06) 50%, transparent 100%)",
              animation: "shimmer 2.5s infinite ease-in-out",
              transform: "translateX(-100%)",
            },
            "@keyframes shimmer": {
              "0%": { transform: "translateX(-100%)" },
              "100%": { transform: "translateX(100%)" },
            },
          }}
        />
      </Box>
      <Box sx={{ p: { xs: 1, md: 1.25 } }}>
        <Skeleton width="90%" height={13} sx={{ mb: 0.5 }} />
        <Skeleton width="55%" height={11} sx={{ mb: 0.75 }} />
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Skeleton width={50} height={11} />
          <Skeleton width={45} height={11} />
        </Box>
      </Box>
    </Box>
  );
}
