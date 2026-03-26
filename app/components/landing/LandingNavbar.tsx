"use client";

import { useState } from "react";
import {
  Box,
  Stack,
  AppBar,
  Toolbar,
  Link,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  HomeOutlined,
  AutoAwesomeOutlined,
  GroupOutlined,
  WorkspacePremiumOutlined,
  HelpOutlineOutlined,
  LoginOutlined,
} from "@mui/icons-material";
import { BrandLogo } from "@/app/components/BrandLogo";

const NAV_LINKS = [
  { label: "Início", href: "#inicio", icon: HomeOutlined },
  { label: "Como funciona", href: "#como-funciona", icon: AutoAwesomeOutlined },
  { label: "Para quem é", href: "#para-quem-e", icon: GroupOutlined },
  { label: "Planos", href: "#planos", icon: WorkspacePremiumOutlined },
  { label: "FAQ", href: "#faq", icon: HelpOutlineOutlined },
];

export function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <>
      {/* Floating logo */}
      <Box
        sx={{
          position: "fixed",
          top: { xs: 12, sm: 16, md: 20 },
          left: { xs: 16, sm: 24, md: 32 },
          zIndex: 1200,
          height: { xs: 48, sm: 60, md: 76 },
          minWidth: { xs: 130, sm: 160, md: 200 },
          display: "flex",
          alignItems: "center",
          pointerEvents: "auto",
        }}
      >
        <BrandLogo variant="full" size="lg" href="/" mode="dark" priority />
      </Box>

      {/* Capsule navbar */}
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          display: "flex",
          justifyContent: "center",
          pt: { xs: 1.5, md: 2 },
          px: { xs: 1.5, sm: 2, md: 3 },
          pointerEvents: "none",
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: "100%",
            maxWidth: { xs: "100%", sm: "calc(100% - 32px)", md: 1100 },
            pointerEvents: "auto",
          }}
        >
          <AppBar
            position="static"
            elevation={0}
            sx={{
              background: "rgba(7, 11, 18, 0.88)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: { xs: "16px", md: "24px" },
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
            }}
          >
            <Toolbar
              disableGutters
              sx={{
                minHeight: { xs: 52, md: 56 },
                px: { xs: 2, sm: 2.5, md: 3 },
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Desktop nav links */}
              <Stack
                component="nav"
                direction="row"
                spacing={0.5}
                sx={{
                  display: { xs: "none", md: "flex" },
                  justifyContent: "center",
                  flex: 1,
                }}
              >
                {NAV_LINKS.map(({ label, href, icon: Icon }) => (
                  <Link
                    key={label}
                    href={href}
                    underline="none"
                    onClick={(e) => {
                      if (href.startsWith("#")) {
                        e.preventDefault();
                        document.getElementById(href.slice(1))?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }
                    }}
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.6,
                      px: 1.5,
                      py: 0.6,
                      fontSize: "0.84rem",
                      fontWeight: 500,
                      color: "#9AA8B8",
                      whiteSpace: "nowrap",
                      borderRadius: "999px",
                      border: "1px solid transparent",
                      transition: "all 0.2s ease",
                      cursor: "pointer",
                      "&:hover": {
                        color: "#fff",
                        background: "rgba(255, 255, 255, 0.04)",
                        borderColor: "rgba(255, 255, 255, 0.08)",
                      },
                      "& .nav-icon": {
                        fontSize: 16,
                        opacity: 0.7,
                        transition: "opacity 0.2s ease",
                      },
                      "&:hover .nav-icon": {
                        opacity: 1,
                      },
                    }}
                  >
                    <Icon className="nav-icon" />
                    {label}
                  </Link>
                ))}
              </Stack>

              {/* Desktop login */}
              <Box
                sx={{
                  display: { xs: "none", md: "flex" },
                  position: "absolute",
                  right: { md: 20 },
                }}
              >
                <Link
                  href="/login"
                  underline="none"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.6,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#fff",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      color: "#39D5FF",
                    },
                    "& .login-icon": {
                      fontSize: 17,
                      transition: "color 0.2s ease",
                    },
                  }}
                >
                  <LoginOutlined className="login-icon" />
                  Entrar
                </Link>
              </Box>

              {/* Mobile menu icon */}
              <IconButton
                aria-label="abrir menu"
                onClick={handleDrawerToggle}
                sx={{
                  display: { xs: "flex", md: "none" },
                  color: "#fff",
                  ml: "auto",
                }}
              >
                <MenuIcon />
              </IconButton>
            </Toolbar>
          </AppBar>
        </Box>
      </Box>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        PaperProps={{
          sx: {
            width: 280,
            background: "#0D1520",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="flex-end">
            <IconButton onClick={handleDrawerToggle} sx={{ color: "#fff" }}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <List sx={{ mt: 2 }}>
            {NAV_LINKS.map(({ label, href, icon: Icon }) => (
              <ListItem key={label} disablePadding>
                <ListItemButton
                  component="a"
                  href={href}
                  onClick={(e: React.MouseEvent) => {
                    handleDrawerToggle();
                    if (href.startsWith("#")) {
                      e.preventDefault();
                      setTimeout(() => {
                        document.getElementById(href.slice(1))?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }, 300);
                    }
                  }}
                  sx={{
                    py: 1.5,
                    "&:hover": { background: "rgba(57,213,255,0.08)" },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Icon sx={{ fontSize: 20, color: "#9AA8B8" }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={label}
                    primaryTypographyProps={{
                      fontSize: "0.95rem",
                      fontWeight: 500,
                      color: "#C0D0E0",
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
            <ListItem disablePadding>
              <ListItemButton
                component="a"
                href="/login"
                onClick={handleDrawerToggle}
                sx={{
                  py: 1.5,
                  "&:hover": { background: "rgba(57,213,255,0.08)" },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <LoginOutlined sx={{ fontSize: 20, color: "#39D5FF" }} />
                </ListItemIcon>
                <ListItemText
                  primary="Entrar"
                  primaryTypographyProps={{
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: "#39D5FF",
                  }}
                />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>
    </>
  );
}
