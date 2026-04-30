"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Box,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  VideoLibrary,
  Inventory2,
  Person,
  TrendingUp,
  AdminPanelSettingsOutlined,
  SettingsOutlined,
  Logout,
  BookmarkBorder,
  Whatshot,
  FiberNew,
  HelpOutline,
  AutoAwesome,
  FaceRetouchingNatural,
  MenuBook,
  SpaceDashboard,
  ChevronLeft,
  ChevronRight,
} from "@mui/icons-material";
import { BrandLogo } from "@/app/components/BrandLogo";
import type { SvgIconComponent } from "@mui/icons-material";

/* ============================================
   NAV SECTIONS CONFIG
============================================ */
const NAV_SECTIONS: Array<{
  label: string;
  items: Array<{
    label: string;
    icon: SvgIconComponent;
    href: string;
    badge?: string;
  }>;
}> = [
  {
    label: "",
    items: [
      { label: "Dashboard", icon: SpaceDashboard, href: "/dashboard/home" },
    ],
  },
  {
    label: "EXPLORAR",
    items: [
      {
        label: "Vídeos em Alta",
        icon: VideoLibrary,
        href: "/dashboard/videos",
      },
      { label: "Produtos Hype", icon: Whatshot, href: "/dashboard/trends" },
      { label: "Novos Produtos", icon: FiberNew, href: "/dashboard/products" },
      { label: "Creators", icon: Person, href: "/dashboard/creators" },
    ],
  },
  {
    label: "FERRAMENTAS",
    items: [
      {
        label: "Vídeo com Avatar",
        icon: FaceRetouchingNatural,
        href: "/dashboard/influencer-ia",
        badge: "novo",
      },
      {
        label: "Biblioteca de Prompts",
        icon: MenuBook,
        href: "/dashboard/prompt-library",
        badge: "novo",
      },
    ],
  },
  {
    label: "BIBLIOTECA",
    items: [
      {
        label: "Vídeos salvos",
        icon: BookmarkBorder,
        href: "/dashboard/videos-salvos",
      },
      {
        label: "Produtos salvos",
        icon: Inventory2,
        href: "/dashboard/produtos-salvos",
      },
    ],
  },
  {
    label: "",
    items: [
      { label: "Suporte", icon: HelpOutline, href: "/dashboard/suporte" },
    ],
  },
];

/* ============================================
   SIDEBAR
============================================ */

interface DashboardSidebarProps {
  onNavigate?: () => void;
  inDrawer?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function DashboardSidebar({
  onNavigate,
  inDrawer,
  collapsed = false,
  onToggleCollapse,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const isActive = (href: string) => {
    if (href === "/dashboard/videos" && pathname === "/dashboard") return true;
    return pathname === href || pathname?.startsWith(href + "/");
  };

  return (
    <Box
      className="app-sidebar"
      sx={{
        width: collapsed ? 60 : 260,
        transition: "width 200ms ease",
        height: inDrawer ? "100%" : { xs: "100dvh", md: "100dvh" },
        minHeight: inDrawer ? 0 : { xs: "100dvh", md: "100dvh" },
        maxHeight: inDrawer ? "100%" : { xs: "100dvh", md: "100dvh" },
        background: "#0A0F18",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Brand Header */}
      <Box
        sx={{
          position: "relative",
          minHeight: collapsed ? 64 : 100,
          flexShrink: 0,
          background: "rgba(255, 255, 255, 0.02)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          transition: "min-height 200ms ease",
          "&::after": {
            content: '""',
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(45,212,255,0.25), rgba(255,45,120,0.15), transparent)",
          },
        }}
      >
        {!collapsed ? (
          <>
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
                href="/dashboard/videos"
                mode="dark"
                variant="full"
                size="lg"
                priority
              />
            </Box>
            {!inDrawer && onToggleCollapse && (
              <IconButton
                onClick={onToggleCollapse}
                size="small"
                sx={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "rgba(255,255,255,0.35)",
                  "&:hover": {
                    color: "#fff",
                    bgcolor: "rgba(255,255,255,0.06)",
                  },
                }}
              >
                <ChevronLeft sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </>
        ) : (
          <Tooltip title="Expandir menu" placement="right" arrow>
            <IconButton
              onClick={onToggleCollapse}
              size="small"
              sx={{
                color: "rgba(255,255,255,0.35)",
                "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.06)" },
              }}
            >
              <ChevronRight sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Navigation */}
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
            key={section.label || `section-${sectionIndex}`}
            sx={{ mb: sectionIndex < NAV_SECTIONS.length - 1 ? 0.9 : 0 }}
          >
            {section.label && !collapsed && (
              <SectionLabel text={section.label} />
            )}
            <List
              disablePadding
              sx={{ display: "flex", flexDirection: "column", gap: 0.15 }}
            >
              {section.items.map(({ label, icon, href, badge }) => (
                <NavItem
                  key={label}
                  label={label}
                  icon={icon}
                  href={href}
                  active={isActive(href)}
                  onClick={onNavigate}
                  badge={badge}
                  collapsed={collapsed}
                />
              ))}
            </List>
          </Box>
        ))}
      </Box>

      {/* Bottom actions */}
      <Box
        sx={{
          flexShrink: 0,
          px: collapsed ? 0.5 : 1.25,
          pb: { xs: 4, md: 2 },
          pt: 0.75,
        }}
      >
        {isAdmin && (
          <Box sx={{ mb: 0.6 }}>
            {!collapsed && <SectionLabel text="ADMIN" />}
            <List disablePadding>
              <NavItem
                label="Admin"
                icon={AdminPanelSettingsOutlined}
                href="/dashboard/admin"
                active={isActive("/dashboard/admin")}
                onClick={onNavigate}
                collapsed={collapsed}
              />
              <NavItem
                label="Configuração"
                icon={SettingsOutlined}
                href="/dashboard/config"
                active={isActive("/dashboard/config")}
                onClick={onNavigate}
                collapsed={collapsed}
              />
            </List>
          </Box>
        )}

        <List disablePadding>
          {collapsed ? (
            <Tooltip title="Sair" placement="right" arrow>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  sx={{
                    borderRadius: 2,
                    minHeight: 32,
                    px: 0,
                    py: 0.35,
                    justifyContent: "center",
                    "&:hover": { background: "rgba(255,255,255,0.03)" },
                  }}
                >
                  <Logout
                    sx={{ fontSize: 15, color: "rgba(255,255,255,0.5)" }}
                  />
                </ListItemButton>
              </ListItem>
            </Tooltip>
          ) : (
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => signOut({ callbackUrl: "/login" })}
                sx={{
                  borderRadius: 2,
                  minHeight: 32,
                  px: 1,
                  py: 0.35,
                  "&:hover": { background: "rgba(255,255,255,0.03)" },
                }}
              >
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <Logout
                    sx={{ fontSize: 15, color: "rgba(255,255,255,0.5)" }}
                  />
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
          )}
        </List>
      </Box>
    </Box>
  );
}

/* ============================================
   INTERNAL COMPONENTS
============================================ */

function SectionLabel({ text }: { text: string }) {
  return (
    <Typography
      sx={{
        fontSize: "0.55rem",
        fontWeight: 700,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: "rgba(45,212,255,0.45)",
        px: 1,
        mb: 0.3,
      }}
    >
      {text}
    </Typography>
  );
}

function NavItem({
  label,
  icon: Icon,
  href,
  active,
  onClick,
  badge,
  collapsed,
}: {
  label: string;
  icon: SvgIconComponent;
  href: string;
  active: boolean;
  onClick?: () => void;
  badge?: string;
  collapsed?: boolean;
}) {
  const item = (
    <ListItem disablePadding>
      <ListItemButton
        component={Link}
        href={href}
        onClick={onClick}
        sx={{
          borderRadius: 2,
          minHeight: 32,
          px: collapsed ? 0 : 1,
          py: 0.35,
          justifyContent: collapsed ? "center" : undefined,
          position: "relative",
          background: active ? "rgba(45, 212, 255, 0.08)" : "transparent",
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
        <ListItemIcon sx={{ minWidth: collapsed ? "auto" : 24 }}>
          <Icon
            sx={{
              fontSize: 15,
              color: active ? "#2DD4FF" : "rgba(255,255,255,0.5)",
            }}
          />
        </ListItemIcon>
        {!collapsed && (
          <ListItemText
            primary={label}
            primaryTypographyProps={{
              fontSize: "0.75rem",
              fontWeight: active ? 600 : 500,
              color: active ? "#2DD4FF" : "rgba(255,255,255,0.75)",
            }}
          />
        )}
        {!collapsed && badge && (
          <Box
            component="span"
            sx={{
              ml: 0.75,
              px: 0.6,
              py: 0.1,
              fontSize: "0.55rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#fff",
              background: "#E0256A",
              borderRadius: "4px",
              lineHeight: 1.6,
              flexShrink: 0,
              animation: "hyppe-badge-pulse 2s ease-in-out infinite",
              "@keyframes hyppe-badge-pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.55 },
              },
            }}
          >
            {badge}
          </Box>
        )}
      </ListItemButton>
    </ListItem>
  );

  if (collapsed) {
    return (
      <Tooltip title={label} placement="right" arrow>
        {item}
      </Tooltip>
    );
  }
  return item;
}
