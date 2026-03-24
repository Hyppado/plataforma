"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  VideoLibrary,
  Inventory2,
  Person,
  TrendingUp,
  AdminPanelSettingsOutlined,
  Logout,
  BookmarkBorder,
  Whatshot,
  FiberNew,
  CardMembership,
  HelpOutline,
} from "@mui/icons-material";
import { BrandLogo } from "@/app/components/BrandLogo";
import { useQuotaUsage, formatQuotaDisplay } from "@/lib/admin/useQuotaUsage";
import { AppTopHeader } from "@/app/components/layout/AppTopHeader";

// Hyppado dark theme (navy #06080F + accent #2DD4FF)
const theme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#06080F",
      paper: "#0A0F18",
    },
    primary: {
      main: "#2DD4FF",
    },
    text: {
      primary: "#ffffff",
      secondary: "rgba(255,255,255,0.7)",
    },
  },
  typography: {
    fontFamily: "Inter, sans-serif",
    fontSize: 13,
    h1: {
      fontSize: "1.25rem",
      fontWeight: 700,
      lineHeight: 1.3,
    },
    h2: {
      fontSize: "1.1rem",
      fontWeight: 600,
      lineHeight: 1.3,
    },
    body1: {
      fontSize: "0.8125rem",
      lineHeight: 1.4,
    },
    body2: {
      fontSize: "0.75rem",
      lineHeight: 1.35,
    },
  },
  components: {
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontSize: "0.8125rem",
        },
        input: {
          padding: "6px 8px",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontSize: "0.8125rem",
        },
        sizeSmall: {
          padding: "4px 10px",
          fontSize: "0.75rem",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          padding: "6px",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: "0.6875rem",
          height: "22px",
        },
      },
    },
  },
});

// Sidebar navigation items organized in sections
const NAV_SECTIONS = [
  {
    label: "EXPLORAR",
    items: [
      { label: "Vídeos em Alta", icon: VideoLibrary, href: "/app/videos" },
      { label: "Produtos Hype", icon: Whatshot, href: "/app/products" },
      { label: "Novos Produtos", icon: FiberNew, href: "/app/trends" },
      { label: "Creators", icon: Person, href: "/app/creators" },
    ],
  },
  {
    label: "BIBLIOTECA",
    items: [
      {
        label: "Vídeos salvos",
        icon: BookmarkBorder,
        href: "/app/videos-salvos",
      },
      {
        label: "Produtos salvos",
        icon: Inventory2,
        href: "/app/produtos-salvos",
      },
    ],
  },
  {
    label: "CONTA",
    items: [
      { label: "Assinatura", icon: CardMembership, href: "/app/assinatura" },
      { label: "Suporte", icon: HelpOutline, href: "/app/suporte" },
    ],
  },
];

// Bottom nav section (Admin + Sair)
const isAdminMode = process.env.NEXT_PUBLIC_ADMIN_MODE === "true";

/** Sidebar Quota - Compact status block */
function SidebarQuota() {
  const quota = useQuotaUsage();
  const t = quota.transcripts;
  const s = quota.scripts;

  const pct = (used: number | null, max: number | null) =>
    max && used ? Math.min(1, Math.max(0, used / max)) : 0;

  return (
    <Box sx={{ mt: 2, px: 0.5 }}>
      <Box
        sx={{
          borderRadius: 2,
          border: "1px solid rgba(255,255,255,0.10)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          backdropFilter: "blur(10px)",
          px: 1.5,
          py: 1.25,
          transition: "transform 160ms ease, border-color 160ms ease",
          "&:hover": {
            borderColor: "rgba(255,255,255,0.16)",
            transform: "translateY(-1px)",
          },
        }}
      >
        <Typography
          sx={{
            fontSize: "0.7rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "rgba(255,255,255,0.62)",
            mb: 1,
          }}
        >
          Uso do mês
        </Typography>

        {/* Transcripts */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <Typography
            sx={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "rgba(255,255,255,0.78)",
            }}
          >
            Transcripts
          </Typography>
          <Typography
            sx={{
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "#2DD4FF",
              textShadow: "0 0 14px rgba(45,212,255,0.18)",
            }}
          >
            {formatQuotaDisplay(t.used, t.max)}
          </Typography>
        </Box>
        <Box sx={{ mt: 0.5, mb: 1 }}>
          <Box
            sx={{
              height: 6,
              borderRadius: 999,
              background: "rgba(45,212,255,0.14)",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                height: "100%",
                width: `${pct(t.used, t.max) * 100}%`,
                background:
                  "linear-gradient(90deg, rgba(45,212,255,0.95), rgba(45,212,255,0.55))",
                boxShadow: "0 0 18px rgba(45,212,255,0.18)",
                transition: "width 200ms ease",
              }}
            />
          </Box>
        </Box>

        {/* Scripts */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <Typography
            sx={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "rgba(255,255,255,0.78)",
            }}
          >
            Scripts
          </Typography>
          <Typography
            sx={{
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "#C7A3FF",
              textShadow: "0 0 14px rgba(199,163,255,0.16)",
            }}
          >
            {formatQuotaDisplay(s.used, s.max)}
          </Typography>
        </Box>
        <Box sx={{ mt: 0.5 }}>
          <Box
            sx={{
              height: 6,
              borderRadius: 999,
              background: "rgba(199,163,255,0.14)",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                height: "100%",
                width: `${pct(s.used, s.max) * 100}%`,
                background:
                  "linear-gradient(90deg, rgba(199,163,255,0.95), rgba(199,163,255,0.55))",
                boxShadow: "0 0 18px rgba(199,163,255,0.14)",
                transition: "width 200ms ease",
              }}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Check if current path matches nav item
  const isActive = (href: string) => {
    if (href === "/app/videos" && pathname === "/app") return true;
    return pathname === href || pathname?.startsWith(href + "/");
  };

  // Sidebar content
  const sidebarContent = (
    <Box
      className="app-sidebar"
      sx={{
        width: 260,
        height: { xs: "100dvh", md: "100dvh" },
        minHeight: { xs: "100dvh", md: "100dvh" },
        maxHeight: { xs: "100dvh", md: "100dvh" },
        background: "#0A0F18",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ==================== BRAND HEADER ==================== */}
      <Box
        sx={{
          position: "relative",
          minHeight: 100,
          flexShrink: 0,
          background: "rgba(255, 255, 255, 0.02)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
        }}
      >
        {/* Logo isolado - mesmo estilo da landing page */}
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: 20,
            transform: "translateY(-50%)",
            height: { xs: 48, sm: 56, md: 64 },
            display: "flex",
            alignItems: "center",
          }}
        >
          <BrandLogo
            href="/app/videos"
            mode="dark"
            variant="full"
            size="lg"
            priority
          />
        </Box>
      </Box>

      {/* Navigation - no scrollbar */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          px: 1.25,
          py: 1.5,
          minHeight: 0,
          "&::-webkit-scrollbar": { width: 0, height: 0 },
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <Box
            key={section.label}
            sx={{ mb: sectionIndex < NAV_SECTIONS.length - 1 ? 0.9 : 0 }}
          >
            {/* Section Label */}
            <Typography
              sx={{
                fontSize: "0.55rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.35)",
                px: 1,
                mb: 0.3,
              }}
            >
              {section.label}
            </Typography>

            {/* Section Items */}
            <List
              disablePadding
              sx={{ display: "flex", flexDirection: "column", gap: 0.15 }}
            >
              {section.items.map(({ label, icon: Icon, href }) => {
                const active = isActive(href);
                return (
                  <ListItem key={label} disablePadding>
                    <ListItemButton
                      component={Link}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      sx={{
                        borderRadius: 2,
                        minHeight: 32,
                        px: 1,
                        py: 0.35,
                        position: "relative",
                        background: active
                          ? "rgba(45, 212, 255, 0.08)"
                          : "transparent",
                        "&:hover": {
                          background: active
                            ? "rgba(45, 212, 255, 0.12)"
                            : "rgba(255,255,255,0.03)",
                        },
                        "&::before": active
                          ? {
                              content: '""',
                              position: "absolute",
                              left: 0,
                              top: "50%",
                              transform: "translateY(-50%)",
                              width: 3,
                              height: 14,
                              borderRadius: "0 4px 4px 0",
                              background: "#2DD4FF",
                            }
                          : {},
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        <Icon
                          sx={{
                            fontSize: 15,
                            color: active ? "#2DD4FF" : "rgba(255,255,255,0.5)",
                          }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={label}
                        primaryTypographyProps={{
                          fontSize: "0.75rem",
                          fontWeight: active ? 600 : 500,
                          color: active ? "#2DD4FF" : "rgba(255,255,255,0.75)",
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        ))}

        {/* Quota Status - in sidebar */}
        <SidebarQuota />
      </Box>

      {/* Bottom actions - fixed at bottom */}
      <Box sx={{ flexShrink: 0, px: 1.25, pb: 0.75, pt: 0.75 }}>
        {/* Admin section (if enabled) */}
        {isAdminMode && (
          <Box sx={{ mb: 0.6 }}>
            <Typography
              sx={{
                fontSize: "0.55rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.35)",
                px: 1,
                mb: 0.3,
              }}
            >
              ADMIN
            </Typography>
            <List disablePadding>
              <ListItem disablePadding>
                <ListItemButton
                  component={Link}
                  href="/app/admin"
                  onClick={() => setMobileOpen(false)}
                  sx={{
                    borderRadius: 2,
                    minHeight: 32,
                    px: 1,
                    py: 0.35,
                    position: "relative",
                    background: isActive("/app/admin")
                      ? "rgba(45, 212, 255, 0.08)"
                      : "transparent",
                    "&:hover": {
                      background: isActive("/app/admin")
                        ? "rgba(45, 212, 255, 0.12)"
                        : "rgba(255,255,255,0.03)",
                    },
                    "&::before": isActive("/app/admin")
                      ? {
                          content: '""',
                          position: "absolute",
                          left: 0,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: 3,
                          height: 14,
                          borderRadius: "0 4px 4px 0",
                          background: "#2DD4FF",
                        }
                      : {},
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 24 }}>
                    <AdminPanelSettingsOutlined
                      sx={{
                        fontSize: 15,
                        color: isActive("/app/admin")
                          ? "#2DD4FF"
                          : "rgba(255,255,255,0.5)",
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary="Admin"
                    primaryTypographyProps={{
                      fontSize: "0.75rem",
                      fontWeight: isActive("/app/admin") ? 600 : 500,
                      color: isActive("/app/admin")
                        ? "#2DD4FF"
                        : "rgba(255,255,255,0.75)",
                    }}
                  />
                </ListItemButton>
              </ListItem>
            </List>
          </Box>
        )}

        {/* Sair (Logout) */}
        <List disablePadding>
          <ListItem disablePadding>
            <ListItemButton
              component={Link}
              href="/login"
              sx={{
                borderRadius: 2,
                minHeight: 32,
                px: 1,
                py: 0.35,
                "&:hover": { background: "rgba(255,255,255,0.03)" },
              }}
            >
              <ListItemIcon sx={{ minWidth: 24 }}>
                <Logout sx={{ fontSize: 15, color: "rgba(255,255,255,0.5)" }} />
              </ListItemIcon>
              <ListItemText
                primary="Sair"
                primaryTypographyProps={{
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.75)",
                }}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      <Box
        className="app-shell"
        sx={{
          height: { xs: "100dvh", md: "100dvh" },
          minHeight: { xs: "100dvh", md: "100dvh" },
          maxHeight: { xs: "100dvh", md: "100dvh" },
          background: `
            radial-gradient(ellipse 800px 500px at 10% 10%, rgba(45, 212, 255, 0.04), transparent 50%),
            radial-gradient(ellipse 600px 400px at 90% 90%, rgba(45, 212, 255, 0.03), transparent 45%),
            #06080F
          `,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* Desktop Sidebar */}
        <Box
          component="nav"
          sx={{
            width: { md: 260 },
            flexShrink: 0,
            display: { xs: "none", md: "block" },
            height: "100%",
          }}
        >
          {sidebarContent}
        </Box>

        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              width: 260,
              height: "100dvh",
              maxHeight: "100dvh",
              overflow: "hidden",
            },
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "flex-end", p: 1 }}>
            <IconButton onClick={handleDrawerToggle} sx={{ color: "#fff" }}>
              <CloseIcon />
            </IconButton>
          </Box>
          {sidebarContent}
        </Drawer>

        {/* Main Content */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* Mobile Top Bar */}
          <AppBar
            position="static"
            elevation={0}
            sx={{
              display: { xs: "block", md: "none" },
              background: "rgba(10, 15, 24, 0.9)",
              backdropFilter: "blur(12px)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Toolbar sx={{ minHeight: 52, justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <IconButton
                  edge="start"
                  color="inherit"
                  aria-label="abrir menu"
                  onClick={handleDrawerToggle}
                >
                  <MenuIcon />
                </IconButton>
                <Box sx={{ ml: 2, display: "flex", alignItems: "center" }}>
                  <BrandLogo
                    href="/app/videos"
                    mode="dark"
                    variant="full"
                    size="sm"
                  />
                </Box>
              </Box>
            </Toolbar>
          </AppBar>

          {/* Header global com seletor de país */}
          <Suspense fallback={null}>
            <AppTopHeader />
          </Suspense>

          {/* Page Content - scrollable */}
          <Box
            sx={{
              flex: 1,
              py: { xs: 2, md: 2.5 },
              px: { xs: 2, md: 3 },
              overflowY: "auto",
              overflowX: "hidden",
              minHeight: 0,
            }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
