import { Box, Typography } from "@mui/material";
import { RANK_STYLES } from "./videoCardConfig";

interface RankBadgeProps {
  rank: number;
}

/**
 * RankBadge — large medal-style ranking badge.
 * Top 1/2/3: gold/silver/bronze premium
 * #4+: Hyppado cyan accent
 */
export function RankBadge({ rank }: RankBadgeProps) {
  const isTop3 = rank >= 1 && rank <= 3;
  const style = isTop3 ? RANK_STYLES[rank as 1 | 2 | 3] : RANK_STYLES.default;

  return (
    <Box
      sx={{
        position: "absolute",
        top: { xs: 10, md: 12 },
        left: { xs: 10, md: 12 },
        zIndex: 5,
        width: { xs: 52, sm: 58, md: 66 },
        height: { xs: 40, sm: 44, md: 50 },
        borderRadius: "14px",
        background: style.gradient,
        border: `1.5px solid ${style.border}`,
        boxShadow: style.glow,
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "transform 180ms ease, box-shadow 180ms ease",
        "@media (hover: hover)": {
          "&:hover": {
            transform: "scale(1.03)",
            boxShadow: isTop3
              ? `${style.glow}, 0 0 24px ${style.border}`
              : `${style.glow}, 0 0 16px rgba(45, 212, 255, 0.25)`,
          },
        },
      }}
    >
      <Typography
        sx={{
          fontWeight: 900,
          letterSpacing: "-0.02em",
          fontSize: { xs: "1.35rem", sm: "1.5rem", md: "1.7rem" },
          lineHeight: 1,
          color: style.textColor,
          textShadow: style.textShadow,
          userSelect: "none",
        }}
      >
        #{rank}
      </Typography>
    </Box>
  );
}
