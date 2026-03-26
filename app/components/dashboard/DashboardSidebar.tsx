"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
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
} from "@mui/icons-material";
import { BrandLogo } from "@/app/components/BrandLogo";
import { SidebarQuota } from "./SidebarQuota";
import type { SvgIconComponent } from "@mui/icons-material";

/* ============================================
   NAV SECTIONS CONFIG
============================================ */
const NAV_SECTIONS = [
  {
    label: "EXPLORAR",
    items: [
      {
        label: "Vídeos em Alta",
        icon: VideoLibrary,
        href: "/dashboard/videos",
      },
      { label: "Produtos Hype", icon: Whatshot, href: "/dashboard/products" },
      { label: "Novos Produtos", icon: FiberNew, href: "/dashboard/trends" },
      { label: "Creators", icon: Person, href: "/dashboard/creators" },
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
}

export function DashboardSidebar({ onNavigate }: DashboardSidebarProps) {
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
      {/* Brand Header */}
      <Box
        sx={{
          position: "relative",
          minHeight: 100,
          flexShrink: 0,
          background: "rgba(255, 255, 255, 0.02)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
        }}
      >
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
            {section.label && <SectionLabel text={section.label} />}
            <List
              disablePadding
              sx={{ display: "flex", flexDirection: "column", gap: 0.15 }}
            >
              {section.items.map(({ label, icon, href }) => (
                <NavItem
                  key={label}
                  label={label}
                  icon={icon}
                  href={href}
                  active={isActive(href)}
                  onClick={onNavigate}
                />
              ))}
            </List>
          </Box>
        ))}

        <SidebarQuota />
      </Box>

      {/* Bottom actions */}
      <Box sx={{ flexShrink: 0, px: 1.25, pb: 0.75, pt: 0.75 }}>
        {isAdmin && (
          <Box sx={{ mb: 0.6 }}>
            <SectionLabel text="ADMIN" />
            <List disablePadding>
              <NavItem
                label="Admin"
                icon={AdminPanelSettingsOutlined}
                href="/dashboard/admin"
                active={isActive("/dashboard/admin")}
                onClick={onNavigate}
              />
              <NavItem
                label="Configuração"
                icon={SettingsOutlined}
                href="/dashboard/config"
                active={isActive("/dashboard/config")}
                onClick={onNavigate}
              />
            </List>
          </Box>
        )}

        <List disablePadding>
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
}

/* ============================================
   INTERNAL COMPONENTS
============================================ */

function SectionLabel({ text }: { text: string }) {
  return (
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
}: {
  label: string;
  icon: SvgIconComponent;
  href: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <ListItem disablePadding>
      <ListItemButton
        component={Link}
        href={href}
        onClick={onClick}
        sx={{
          borderRadius: 2,
          minHeight: 32,
          px: 1,
          py: 0.35,
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
}
