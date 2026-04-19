import {
  Box,
  Container,
  Grid,
  Stack,
  Typography,
  Link,
  Divider,
} from "@mui/material";
import { BrandLogo } from "@/app/components/BrandLogo";

export function LandingFooter() {
  return (
    <Box
      component="footer"
      sx={{
        mt: "auto",
        pt: { xs: 6, md: 8 },
        pb: { xs: 4, md: 5 },
        background:
          "linear-gradient(180deg, rgba(7, 11, 18, 0) 0%, rgba(13, 21, 32, 0.5) 100%)",
        borderTop: "1px solid rgba(255, 255, 255, 0.05)",
      }}
    >
      <Container maxWidth="lg">
        {/* 3 Columns */}
        <Grid
          container
          spacing={{ xs: 4, md: 6 }}
          sx={{ mb: { xs: 4, md: 6 } }}
        >
          {/* Brand */}
          <Grid item xs={12} md={5}>
            <Box sx={{ mb: 2.5 }}>
              <BrandLogo size="sm" href="/" />
            </Box>
            <Typography
              sx={{
                fontSize: "0.875rem",
                color: "#8595A5",
                lineHeight: 1.7,
                maxWidth: 360,
              }}
            >
              A Hyppado ajuda criadores e afiliados a escolher produtos e
              entender criativos com mais clareza, usando transcrição e
              sugestões de prompt para modelagem.
            </Typography>
          </Grid>

          {/* Quick Access */}
          <Grid item xs={6} md={3}>
            <Typography
              sx={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#fff",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                mb: 2.5,
              }}
            >
              Acesso Rápido
            </Typography>
            <Stack spacing={1.5}>
              {[
                { label: "Início", href: "#inicio" },
                { label: "Como funciona", href: "#como-funciona" },
                { label: "Para quem é", href: "#para-quem-e" },
                { label: "Planos", href: "#planos" },
                { label: "FAQ", href: "#faq" },
                { label: "Suporte", href: "/suporte" },
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  underline="none"
                  onClick={(e) => {
                    if (link.href.startsWith("#")) {
                      e.preventDefault();
                      const id = link.href.slice(1);
                      document.getElementById(id)?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }
                  }}
                  sx={{
                    fontSize: "0.875rem",
                    color: "#9AA8B8",
                    transition: "color 0.2s ease",
                    "&:hover": {
                      color: "#39D5FF",
                    },
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </Stack>
          </Grid>

          {/* Legal */}
          <Grid item xs={6} md={4}>
            <Typography
              sx={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#fff",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                mb: 2.5,
              }}
            >
              Legal
            </Typography>
            <Stack spacing={1.5}>
              <Link
                href="/termos"
                underline="none"
                sx={{
                  fontSize: "0.875rem",
                  color: "#9AA8B8",
                  transition: "color 0.2s ease",
                  "&:hover": {
                    color: "#39D5FF",
                  },
                }}
              >
                Termos de Uso
              </Link>
              <Link
                href="/privacidade"
                underline="none"
                sx={{
                  fontSize: "0.875rem",
                  color: "#9AA8B8",
                  transition: "color 0.2s ease",
                  "&:hover": {
                    color: "#39D5FF",
                  },
                }}
              >
                Política de Privacidade
              </Link>
            </Stack>
          </Grid>
        </Grid>

        <Divider
          sx={{
            borderColor: "rgba(255, 255, 255, 0.06)",
            mb: { xs: 3, md: 4 },
          }}
        />

        {/* Bottom */}
        <Typography
          sx={{
            fontSize: "0.8rem",
            color: "#6A7A8A",
            textAlign: { xs: "center", sm: "left" },
          }}
        >
          © Hyppado 2026. Todos os direitos reservados.
        </Typography>
      </Container>
    </Box>
  );
}
