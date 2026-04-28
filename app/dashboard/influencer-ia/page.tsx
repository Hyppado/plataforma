"use client";

/**
 * app/dashboard/influencer-ia/page.tsx
 *
 * Influencer IA — wizard page for generating UGC-style influencer images.
 *
 * Sections:
 *   1. Escolha o Produto  — pick from Produtos Hype list or upload an image
 *   2. Escolha o Influencer — pick a pre-built avatar or upload a photo
 *   3. Configure a Imagem — pose, environment, style, enhancements
 *   + Generate button + result display
 *
 * Query params for deep-linking from product tables:
 *   ?productId=...          (informational, product is identified by URL)
 *   ?productImageUrl=...    (image URL, URL-encoded)
 *   ?productName=...        (product name)
 *   ?productCategory=...    (product category)
 */

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Box,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import {
  AutoFixHigh,
  Download,
  Refresh,
  Home,
  CameraAlt,
  WbSunny,
  FitnessCenter,
  Kitchen,
  MoreHoriz,
  Person,
  Smartphone,
  Visibility,
  Chair,
  ShoppingBag,
  CheckCircle,
  ErrorOutline,
  UploadFile,
  Image as ImageIcon,
} from "@mui/icons-material";
import { useAvatarProfiles } from "@/lib/swr/useAvatarProfiles";
import { useTrendingProducts } from "@/lib/swr/useTrending";
import { getStoredRegion } from "@/lib/region";
import type { ProductDTO } from "@/lib/types/dto";
import type { AvatarProfileDTO } from "@/lib/avatar-video/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POSES = [
  {
    id: "De Frente",
    label: "De Frente",
    description: "Mostrando o produto de frente para a câmera",
    Icon: Person,
  },
  {
    id: "Selfie",
    label: "Selfie",
    description: "Estilo selfie segurando o produto",
    Icon: Smartphone,
  },
  {
    id: "POV",
    label: "POV",
    description: "Visão em 1ª pessoa com braços estendidos",
    Icon: Visibility,
  },
  {
    id: "Mirror Selfie",
    label: "Mirror Selfie",
    description: "Selfie no espelho mostrando look completo",
    Icon: CameraAlt,
  },
  {
    id: "Sentada",
    label: "Sentada",
    description: "Pessoa sentada casualmente com o produto",
    Icon: Chair,
  },
  {
    id: "Só Produto",
    label: "Só Produto",
    description: "Apenas o produto em cenário estilizado",
    Icon: ShoppingBag,
  },
] as const;

const ENVIRONMENTS = [
  { id: "Casa", label: "Casa", Icon: Home },
  { id: "Estúdio", label: "Estúdio", Icon: CameraAlt },
  { id: "Ao ar livre", label: "Ao ar livre", Icon: WbSunny },
  { id: "Academia", label: "Academia", Icon: FitnessCenter },
  { id: "Cozinha", label: "Cozinha", Icon: Kitchen },
  { id: "Outros", label: "Outros", Icon: MoreHoriz },
] as const;

const STYLES = [
  "Casual",
  "Profissional",
  "Esportivo",
  "Elegante",
  "Minimalista",
  "Streetwear",
  "Boho",
  "Suave",
  "Colorido",
  "Verão",
  "Trendy",
  "Básico",
] as const;

const ENHANCEMENTS = [
  { id: "Pele Ultra Realista", emoji: "🎨" },
  { id: "Iluminação Natural", emoji: "☀️" },
  { id: "Realismo e Detalhamento", emoji: "🔍" },
  { id: "Cores Vibrantes", emoji: "🎨" },
  { id: "Profundidade de Campo", emoji: "📷" },
  { id: "Mãos Perfeitas", emoji: "👋" },
] as const;

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const SECTION_SX = {
  borderRadius: 3,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.025)",
  p: { xs: 2, sm: 2.5 },
};

const LABEL_SX = {
  fontSize: "0.62rem",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.09em",
  color: "rgba(255,255,255,0.28)",
  mb: 1,
};

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function SectionHeader({
  number,
  title,
}: {
  number: number;
  title: string;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2 }}>
      <Box
        sx={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "rgba(45,212,255,0.12)",
          border: "1px solid rgba(45,212,255,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{
            fontSize: "0.65rem",
            fontWeight: 700,
            color: "primary.main",
            lineHeight: 1,
          }}
        >
          {number}
        </Typography>
      </Box>
      <Typography sx={{ fontWeight: 600, fontSize: "0.95rem" }}>
        {title}
      </Typography>
    </Box>
  );
}

function TabPair({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string; icon?: React.ReactNode }>;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        mb: 2,
      }}
    >
      {options.map((opt) => (
        <Box
          key={opt.value}
          component="button"
          type="button"
          onClick={() => onChange(opt.value)}
          sx={{
            all: "unset",
            flex: 1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.75,
            py: 1,
            fontSize: "0.8rem",
            fontWeight: 500,
            transition: "background 0.15s, color 0.15s",
            background:
              value === opt.value
                ? "rgba(45,212,255,0.12)"
                : "transparent",
            color:
              value === opt.value
                ? "primary.main"
                : "rgba(255,255,255,0.55)",
            borderRight:
              opt.value !== options[options.length - 1].value
                ? "1px solid rgba(255,255,255,0.08)"
                : "none",
          }}
        >
          {opt.icon}
          {opt.label}
        </Box>
      ))}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Product mini-card for the grid
// ---------------------------------------------------------------------------

function ProductMiniCard({
  product,
  selected,
  onSelect,
}: {
  product: ProductDTO;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        all: "unset",
        cursor: "pointer",
        position: "relative",
        borderRadius: 2,
        overflow: "hidden",
        border: "2px solid",
        borderColor: selected ? "primary.main" : "rgba(255,255,255,0.08)",
        transition: "border-color 0.15s",
        background: "rgba(0,0,0,0.2)",
        "&:hover": {
          borderColor: selected ? "primary.main" : "rgba(45,212,255,0.3)",
        },
      }}
    >
      {/* Thumbnail */}
      <Box sx={{ width: "100%", aspectRatio: "1/1", overflow: "hidden" }}>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              background: "rgba(255,255,255,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ImageIcon sx={{ color: "rgba(255,255,255,0.2)", fontSize: 24 }} />
          </Box>
        )}
      </Box>
      {/* Name overlay */}
      <Box
        sx={{
          px: 0.75,
          py: 0.6,
          background: "rgba(0,0,0,0.6)",
        }}
      >
        <Typography
          sx={{
            fontSize: "0.6rem",
            color: selected ? "primary.main" : "rgba(255,255,255,0.75)",
            fontWeight: selected ? 600 : 400,
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {product.name}
        </Typography>
      </Box>
      {selected && (
        <CheckCircle
          sx={{
            position: "absolute",
            top: 4,
            right: 4,
            fontSize: 16,
            color: "primary.main",
            background: "rgba(0,0,0,0.6)",
            borderRadius: "50%",
          }}
        />
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Avatar circular card
// ---------------------------------------------------------------------------

function AvatarCard({
  avatar,
  selected,
  onSelect,
}: {
  avatar: AvatarProfileDTO;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.75,
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid",
          borderColor: selected ? "primary.main" : "rgba(255,255,255,0.12)",
          transition: "border-color 0.15s",
          "&:hover": {
            borderColor: selected ? "primary.main" : "rgba(45,212,255,0.4)",
          },
        }}
      >
        <img
          src={avatar.thumbnailUrl ?? avatar.imageUrl}
          alt={avatar.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </Box>
      <Typography
        sx={{
          fontSize: "0.62rem",
          color: selected ? "primary.main" : "rgba(255,255,255,0.65)",
          fontWeight: selected ? 600 : 400,
          textAlign: "center",
          maxWidth: 72,
          lineHeight: 1.2,
        }}
      >
        {avatar.name}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Tile button (pose / environment)
// ---------------------------------------------------------------------------

function TileButton({
  icon: Icon,
  label,
  description,
  selected,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.75,
        p: 1.5,
        borderRadius: 2,
        border: "1px solid",
        borderColor: selected ? "primary.main" : "rgba(255,255,255,0.08)",
        background: selected ? "rgba(45,212,255,0.08)" : "rgba(0,0,0,0.15)",
        transition: "border-color 0.15s, background 0.15s",
        "&:hover": {
          borderColor: selected ? "primary.main" : "rgba(45,212,255,0.3)",
        },
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: selected
            ? "rgba(45,212,255,0.15)"
            : "rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon
          sx={{
            fontSize: 18,
            color: selected ? "primary.main" : "rgba(255,255,255,0.55)",
          }}
        />
      </Box>
      <Typography
        sx={{
          fontSize: "0.72rem",
          fontWeight: 600,
          color: selected ? "primary.main" : "rgba(255,255,255,0.8)",
          textAlign: "center",
        }}
      >
        {label}
      </Typography>
      {description && (
        <Typography
          sx={{
            fontSize: "0.58rem",
            color: "rgba(255,255,255,0.35)",
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          {description}
        </Typography>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Enhancement chip
// ---------------------------------------------------------------------------

function EnhancementChip({
  emoji,
  label,
  selected,
  onClick,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        px: 1.5,
        py: 0.9,
        borderRadius: 2,
        border: "1px solid",
        borderColor: selected ? "primary.main" : "rgba(255,255,255,0.08)",
        background: selected ? "rgba(45,212,255,0.08)" : "rgba(0,0,0,0.15)",
        transition: "border-color 0.15s, background 0.15s",
        "&:hover": {
          borderColor: selected ? "primary.main" : "rgba(45,212,255,0.3)",
        },
      }}
    >
      <Typography sx={{ fontSize: "0.75rem" }}>{emoji}</Typography>
      <Typography
        sx={{
          fontSize: "0.72rem",
          fontWeight: 500,
          color: selected ? "primary.main" : "rgba(255,255,255,0.7)",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Image upload helper component
// ---------------------------------------------------------------------------

function ImageUploadBox({
  value,
  onChange,
  label,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Apenas imagens são aceitas.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/avatar-video/upload-reference", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(json.error ?? "Falha no upload");
      }
      const json = (await res.json()) as { url?: string };
      if (!json.url) throw new Error("URL não retornada");
      onChange(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      {value ? (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid rgba(45,212,255,0.3)",
              flexShrink: 0,
            }}
          >
            <img
              src={value}
              alt={label}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Box>
          <Box>
            <Typography
              sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.6)", mb: 1 }}
            >
              Imagem carregada
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => inputRef.current?.click()}
              sx={{
                fontSize: "0.7rem",
                borderColor: "rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.6)",
                mr: 1,
              }}
            >
              Trocar
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={() => onChange(null)}
              sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)" }}
            >
              Remover
            </Button>
          </Box>
        </Box>
      ) : (
        <Box
          component="button"
          type="button"
          onClick={() => inputRef.current?.click()}
          sx={{
            all: "unset",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            width: "100%",
            py: 3,
            borderRadius: 2,
            border: "1px dashed rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.15)",
            transition: "border-color 0.15s",
            "&:hover": { borderColor: "rgba(45,212,255,0.3)" },
          }}
        >
          {uploading ? (
            <CircularProgress size={20} />
          ) : (
            <>
              <UploadFile sx={{ fontSize: 24, color: "rgba(255,255,255,0.3)" }} />
              <Typography
                sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)" }}
              >
                {label}
              </Typography>
            </>
          )}
        </Box>
      )}
      {error && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.75 }}>
          <ErrorOutline sx={{ fontSize: 12, color: "#ef4444" }} />
          <Typography sx={{ fontSize: "0.65rem", color: "#ef4444" }}>
            {error}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main wizard (inner — reads search params)
// ---------------------------------------------------------------------------

function InfluencerIAWizard() {
  const searchParams = useSearchParams();

  // Deep-link pre-selection from product tables
  const initProductImageUrl = searchParams.get("productImageUrl");
  const initProductName = searchParams.get("productName");
  const initProductCategory = searchParams.get("productCategory");
  const initProductId = searchParams.get("productId");

  // ── Product state ─────────────────────────────────────────────
  const [productTab, setProductTab] = useState<"hype" | "upload">(
    initProductImageUrl ? "upload" : "hype",
  );
  const [selectedProduct, setSelectedProduct] = useState<ProductDTO | null>(null);
  const [uploadedProductUrl, setUploadedProductUrl] = useState<string | null>(
    initProductImageUrl,
  );
  const [uploadedProductName, setUploadedProductName] = useState<string>(
    initProductName ?? "",
  );

  // ── Avatar state ──────────────────────────────────────────────
  const [avatarTab, setAvatarTab] = useState<"gallery" | "upload">("gallery");
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarProfileDTO | null>(null);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);

  // ── Config state ──────────────────────────────────────────────
  const [pose, setPose] = useState<string | null>("De Frente");
  const [customPose, setCustomPose] = useState("");
  const [environment, setEnvironment] = useState<string | null>(null);
  const [customEnvironment, setCustomEnvironment] = useState("");
  const [style, setStyle] = useState<string | null>(null);
  const [enhancements, setEnhancements] = useState<string[]>([]);

  // ── Generation state ──────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // ── Data hooks ────────────────────────────────────────────────
  const region = getStoredRegion().toUpperCase();
  const { items: products, isLoading: loadingProducts } = useTrendingProducts({
    range: "7d",
    region,
    sort: "sales",
    pageSize: 24,
  });

  const { avatars, isLoading: loadingAvatars } = useAvatarProfiles();

  // Auto-select product from deep-link query param
  const hasAutoSelected = useRef(false);
  useEffect(() => {
    if (initProductId && !hasAutoSelected.current && products.length > 0) {
      const match = products.find((p) => p.id === initProductId);
      if (match) {
        hasAutoSelected.current = true;
        setSelectedProduct(match);
      }
    }
  }, [initProductId, products]);

  // Resolve effective product image/name
  const effectiveProductImageUrl =
    productTab === "upload"
      ? uploadedProductUrl
      : selectedProduct?.imageUrl ?? null;
  const effectiveProductName =
    productTab === "upload"
      ? uploadedProductName || null
      : selectedProduct?.name ?? null;
  const effectiveProductCategory =
    productTab === "upload"
      ? null
      : (selectedProduct as ProductDTO & { category?: string })?.category ?? null;

  // Resolve effective avatar
  const effectiveAvatarId =
    avatarTab === "gallery" ? (selectedAvatar?.id ?? null) : null;
  const effectiveAvatarImageUrl =
    avatarTab === "upload" ? uploadedAvatarUrl : null;

  const canGenerate =
    (effectiveProductImageUrl || effectiveProductName) &&
    (effectiveAvatarId || effectiveAvatarImageUrl || avatarTab === "gallery");

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setGenerationError(null);
    setGeneratedImageUrl(null);

    try {
      const res = await fetch("/api/influencer-ia/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productImageUrl: effectiveProductImageUrl,
          productName: effectiveProductName,
          productCategory: effectiveProductCategory,
          avatarId: effectiveAvatarId,
          avatarImageUrl: effectiveAvatarImageUrl,
          pose,
          customPose: customPose.trim() || undefined,
          environment,
          customEnvironment: customEnvironment.trim() || undefined,
          style,
          enhancements,
        }),
      });
      const json = (await res.json()) as { imageUrl?: string; error?: string };
      if (!res.ok || !json.imageUrl) {
        throw new Error(json.error ?? "Erro ao gerar imagem");
      }
      setGeneratedImageUrl(json.imageUrl);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Erro ao gerar imagem");
    } finally {
      setGenerating(false);
    }
  };

  const toggleEnhancement = (id: string) => {
    setEnhancements((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id],
    );
  };

  return (
    <Box
      sx={{
        maxWidth: 720,
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        px: { xs: 0, sm: 0 },
      }}
    >
      {/* ── Section 1: Product ─────────────────────────────────── */}
      <Box sx={SECTION_SX}>
        <SectionHeader number={1} title="Escolha o Produto" />

        <TabPair
          value={productTab}
          onChange={(v) => setProductTab(v as "hype" | "upload")}
          options={[
            {
              value: "hype",
              label: "Produtos Hype",
              icon: <span style={{ fontSize: 14 }}>📈</span>,
            },
            {
              value: "upload",
              label: "Upload",
              icon: <UploadFile sx={{ fontSize: 16 }} />,
            },
          ]}
        />

        {productTab === "hype" ? (
          loadingProducts ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 1,
              }}
            >
              {Array.from({ length: 9 }).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    borderRadius: 2,
                    aspectRatio: "1/1.2",
                    background: "rgba(255,255,255,0.04)",
                  }}
                />
              ))}
            </Box>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 1,
              }}
            >
              {products.slice(0, 12).map((p) => (
                <ProductMiniCard
                  key={p.id}
                  product={p}
                  selected={selectedProduct?.id === p.id}
                  onSelect={() =>
                    setSelectedProduct((prev) =>
                      prev?.id === p.id ? null : p,
                    )
                  }
                />
              ))}
            </Box>
          )
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <ImageUploadBox
              value={uploadedProductUrl}
              onChange={setUploadedProductUrl}
              label="Clique para enviar a imagem do produto"
            />
            <TextField
              label="Nome do produto (opcional)"
              value={uploadedProductName}
              onChange={(e) => setUploadedProductName(e.target.value)}
              size="small"
              fullWidth
              placeholder="Ex: Perfume Attractione Men"
              sx={{
                "& .MuiOutlinedInput-root": {
                  fontSize: "0.82rem",
                  "& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
                  "&:hover fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                  "&.Mui-focused fieldset": { borderColor: "primary.main" },
                },
              }}
            />
          </Box>
        )}
      </Box>

      {/* ── Section 2: Influencer / Avatar ────────────────────── */}
      <Box sx={SECTION_SX}>
        <SectionHeader number={2} title="Escolha o Influencer" />

        <TabPair
          value={avatarTab}
          onChange={(v) => setAvatarTab(v as "gallery" | "upload")}
          options={[
            {
              value: "gallery",
              label: "Avatares Prontos",
              icon: <span style={{ fontSize: 14 }}>👤</span>,
            },
            {
              value: "upload",
              label: "Upload",
              icon: <CameraAlt sx={{ fontSize: 16 }} />,
            },
          ]}
        />

        {avatarTab === "gallery" ? (
          loadingAvatars ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                gap: 2,
              }}
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 0.75,
                  }}
                >
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.05)",
                    }}
                  />
                  <Box
                    sx={{
                      width: 48,
                      height: 10,
                      borderRadius: 1,
                      background: "rgba(255,255,255,0.05)",
                    }}
                  />
                </Box>
              ))}
            </Box>
          ) : avatars.length === 0 ? (
            <Typography
              sx={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.35)", textAlign: "center", py: 3 }}
            >
              Nenhum avatar disponível ainda
            </Typography>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
                gap: 2,
              }}
            >
              {avatars.map((avatar) => (
                <AvatarCard
                  key={avatar.id}
                  avatar={avatar}
                  selected={selectedAvatar?.id === avatar.id}
                  onSelect={() =>
                    setSelectedAvatar((prev) =>
                      prev?.id === avatar.id ? null : avatar,
                    )
                  }
                />
              ))}
            </Box>
          )
        ) : (
          <ImageUploadBox
            value={uploadedAvatarUrl}
            onChange={setUploadedAvatarUrl}
            label="Clique para enviar a foto do influencer"
          />
        )}
      </Box>

      {/* ── Section 3: Configure ──────────────────────────────── */}
      <Box sx={SECTION_SX}>
        <SectionHeader number={3} title="Configure a Imagem" />

        {/* Pose */}
        <Typography sx={LABEL_SX}>Pose</Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 1,
            mb: 1.5,
          }}
        >
          {POSES.map((p) => (
            <TileButton
              key={p.id}
              icon={p.Icon}
              label={p.label}
              description={p.description}
              selected={pose === p.id}
              onClick={() => setPose((prev) => (prev === p.id ? null : p.id))}
            />
          ))}
        </Box>

        {/* Custom pose */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            mb: 0.5,
          }}
        >
          <span style={{ fontSize: 12 }}>🔗</span>
          <Typography
            sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)" }}
          >
            Descrever pose personalizada (opcional)
          </Typography>
        </Box>
        <TextField
          value={customPose}
          onChange={(e) => setCustomPose(e.target.value)}
          multiline
          minRows={2}
          fullWidth
          placeholder="Ex: Segurando o produto próximo ao rosto com expressão de surpresa • Abraçando o produto contra o peito..."
          sx={{
            mb: 2.5,
            "& .MuiOutlinedInput-root": {
              fontSize: "0.78rem",
              "& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
              "&:hover fieldset": { borderColor: "rgba(255,255,255,0.2)" },
              "&.Mui-focused fieldset": { borderColor: "primary.main" },
            },
          }}
        />

        {/* Environment */}
        <Typography sx={LABEL_SX}>Ambiente</Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 1,
            mb: 1.5,
          }}
        >
          {ENVIRONMENTS.map((env) => (
            <TileButton
              key={env.id}
              icon={env.Icon}
              label={env.label}
              selected={environment === env.id}
              onClick={() =>
                setEnvironment((prev) => (prev === env.id ? null : env.id))
              }
            />
          ))}
        </Box>

        {/* Custom environment */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            mb: 0.5,
          }}
        >
          <span style={{ fontSize: 12 }}>🔗</span>
          <Typography
            sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)" }}
          >
            Descrever cenário personalizado (opcional)
          </Typography>
        </Box>
        <TextField
          value={customEnvironment}
          onChange={(e) => setCustomEnvironment(e.target.value)}
          multiline
          minRows={2}
          fullWidth
          placeholder="Ex: Quarto minimalista com cama branca e luz natural entrando pela janela • Banheiro moderno com espelho grande..."
          sx={{
            mb: 2.5,
            "& .MuiOutlinedInput-root": {
              fontSize: "0.78rem",
              "& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
              "&:hover fieldset": { borderColor: "rgba(255,255,255,0.2)" },
              "&.Mui-focused fieldset": { borderColor: "primary.main" },
            },
          }}
        />

        {/* Style */}
        <Typography sx={LABEL_SX}>Estilo do Influencer</Typography>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0.75,
            mb: 2.5,
          }}
        >
          {STYLES.map((s) => (
            <Box
              key={s}
              component="button"
              type="button"
              onClick={() => setStyle((prev) => (prev === s ? null : s))}
              aria-pressed={style === s}
              sx={{
                all: "unset",
                cursor: "pointer",
                px: 1.5,
                py: 0.6,
                borderRadius: 2,
                border: "1px solid",
                borderColor: style === s ? "primary.main" : "rgba(255,255,255,0.1)",
                background:
                  style === s ? "rgba(45,212,255,0.08)" : "transparent",
                fontSize: "0.72rem",
                color:
                  style === s ? "primary.main" : "rgba(255,255,255,0.6)",
                transition: "border-color 0.15s, background 0.15s, color 0.15s",
                "&:hover": {
                  borderColor:
                    style === s ? "primary.main" : "rgba(45,212,255,0.3)",
                },
              }}
            >
              {s}
            </Box>
          ))}
        </Box>

        {/* Enhancements */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            mb: 1,
          }}
        >
          <AutoFixHigh sx={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }} />
          <Typography
            sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.55)", fontWeight: 500 }}
          >
            Melhorias na imagem{" "}
            <span style={{ color: "rgba(255,255,255,0.28)", fontWeight: 400 }}>
              (opcional)
            </span>
          </Typography>
        </Box>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 0.75,
            mb: 0.5,
          }}
        >
          {ENHANCEMENTS.map((e) => (
            <EnhancementChip
              key={e.id}
              emoji={e.emoji}
              label={e.id}
              selected={enhancements.includes(e.id)}
              onClick={() => toggleEnhancement(e.id)}
            />
          ))}
        </Box>
        <Typography
          sx={{
            fontSize: "0.6rem",
            color: "rgba(255,255,255,0.22)",
            mt: 0.5,
          }}
        >
          💡 Selecione os boosts para imagens mais assertivas e realistas
        </Typography>
      </Box>

      {/* ── Generate button ───────────────────────────────────── */}
      <Button
        variant="contained"
        size="large"
        fullWidth
        disabled={!canGenerate || generating}
        onClick={() => void handleGenerate()}
        startIcon={
          generating ? <CircularProgress size={18} color="inherit" /> : <AutoFixHigh />
        }
        sx={{
          py: 1.6,
          fontSize: "0.95rem",
          fontWeight: 700,
          borderRadius: 2.5,
          background: canGenerate
            ? "linear-gradient(135deg, #2DD4FF 0%, #00B8E6 100%)"
            : undefined,
          color: canGenerate ? "#000" : undefined,
          "&:disabled": { opacity: 0.45 },
        }}
      >
        {generating ? "Gerando imagem…" : "Gerar Imagem"}
      </Button>

      {!canGenerate && !generating && (
        <Typography
          sx={{
            textAlign: "center",
            fontSize: "0.72rem",
            color: "rgba(255,255,255,0.3)",
            mt: -1,
          }}
        >
          Escolha um produto e um influencer para gerar a imagem
        </Typography>
      )}

      {/* ── Error ─────────────────────────────────────────────── */}
      {generationError && (
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1,
            p: 1.5,
            borderRadius: 2,
            border: "1px solid rgba(239,68,68,0.25)",
            background: "rgba(239,68,68,0.06)",
          }}
        >
          <ErrorOutline sx={{ fontSize: 16, color: "#ef4444", mt: 0.1 }} />
          <Typography sx={{ fontSize: "0.78rem", color: "#ef4444" }}>
            {generationError}
          </Typography>
        </Box>
      )}

      {/* ── Result ────────────────────────────────────────────── */}
      {generatedImageUrl && (
        <Box sx={SECTION_SX}>
          {/* Header */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CheckCircle sx={{ fontSize: 18, color: "#22c55e" }} />
              <Typography sx={{ fontWeight: 600, fontSize: "0.9rem" }}>
                Imagem Gerada!
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Tooltip title="Baixar imagem">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Download />}
                  component="a"
                  href={generatedImageUrl}
                  download="influencer-ia.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    fontSize: "0.72rem",
                    borderColor: "rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  Baixar
                </Button>
              </Tooltip>
              <Tooltip title="Gerar novamente">
                <Button
                  variant="text"
                  size="small"
                  startIcon={<Refresh />}
                  onClick={() => void handleGenerate()}
                  disabled={generating}
                  sx={{
                    fontSize: "0.72rem",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  Regenerar
                </Button>
              </Tooltip>
            </Box>
          </Box>

          {/* Image */}
          <Box
            sx={{
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.06)",
              maxWidth: 400,
              mx: "auto",
            }}
          >
            <img
              src={generatedImageUrl}
              alt="Imagem gerada"
              style={{ width: "100%", display: "block" }}
            />
          </Box>

          <Typography
            sx={{
              fontSize: "0.65rem",
              color: "rgba(255,255,255,0.22)",
              textAlign: "center",
              mt: 1.5,
            }}
          >
            Baixe sua imagem antes de sair da página
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Page wrapper
// ---------------------------------------------------------------------------

export default function InfluencerIAPage() {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        background: "#070B14",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Page header */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          pt: 3,
          pb: 1,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            background: "rgba(45,212,255,0.1)",
            border: "1px solid rgba(45,212,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <AutoFixHigh sx={{ fontSize: 22, color: "primary.main" }} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: "1.25rem" }}>
            Influencer IA
          </Typography>
          <Typography
            sx={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}
          >
            Crie imagens UGC ultra-realistas com seu produto
          </Typography>
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", px: { xs: 2, sm: 3 }, py: 3 }}>
        <Suspense fallback={null}>
          <InfluencerIAWizard />
        </Suspense>
      </Box>
    </Box>
  );
}
