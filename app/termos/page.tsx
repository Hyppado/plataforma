import { Box, Container, Typography } from "@mui/material";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Termos de Uso — Hyppado",
  description: "Termos de uso da plataforma Hyppado.",
};

export default async function TermosPage() {
  let text = "";
  try {
    text = (await getSetting("terms_of_use")) ?? "";
  } catch {
    // fallback to empty
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "#090e1a",
        color: "rgba(255,255,255,0.87)",
        py: { xs: 6, md: 10 },
      }}
    >
      <Container maxWidth="md">
        <Typography variant="h4" sx={{ fontWeight: 700, color: "#fff", mb: 1 }}>
          Termos de Uso
        </Typography>
        <Box
          sx={{
            mt: 4,
            color: "rgba(255,255,255,0.75)",
            fontSize: 15,
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {text || (
            <Typography
              sx={{ color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}
            >
              Termos de uso não configurados.
            </Typography>
          )}
        </Box>
      </Container>
    </Box>
  );
}
