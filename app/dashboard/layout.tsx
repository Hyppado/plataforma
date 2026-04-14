"use client";

import { useState, Suspense } from "react";
import { Box, AppBar, Toolbar, IconButton, Drawer } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { Menu as MenuIcon, Close as CloseIcon } from "@mui/icons-material";
import { BrandLogo } from "@/app/components/BrandLogo";
import { AppTopHeader } from "@/app/components/layout/AppTopHeader";
import { DashboardSidebar } from "@/app/components/dashboard/DashboardSidebar";
import { PasswordChangeGuard } from "@/app/components/dashboard/PasswordChangeGuard";
import { appTheme } from "@/app/theme";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleDrawerToggle = () => setMobileOpen((o) => !o);
  const closeMobile = () => setMobileOpen(false);

  return (
    <ThemeProvider theme={appTheme}>
      <Box
        className="app-shell"
        sx={{
          height: "100dvh",
          minHeight: "100dvh",
          maxHeight: "100dvh",
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
          <DashboardSidebar />
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
          <DashboardSidebar onNavigate={closeMobile} />
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
                    href="/dashboard/videos"
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

        {/* Force password change modal for temp passwords */}
        <PasswordChangeGuard />
      </Box>
    </ThemeProvider>
  );
}
