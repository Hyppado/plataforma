"use client";

/**
 * app/dashboard/influencer-ia/page.tsx
 *
 * Influencer IA — wizard for generating UGC-style influencer images.
 *
 * Sections:
 *   1. Escolha o Produto  — Produtos Hype (infinite scroll) or upload
 *   2. Escolha o Influencer — avatar gallery or photo upload
 *   3. Configure a Imagem — pose, environment, style, enhancements
 *   + Generate button + result
 *
 * Query params for deep-linking from ProductCard:
 *   ?productId=...        pre-selects product by ID
 *   ?productImageUrl=...  (URL-encoded) used when tab=upload
 *   ?productName=...      product name for upload tab
 *   ?productCategory=...  product category
 */

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Box,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Chip,
  Paper,
  Skeleton,
  Tabs,
  Tab,
  Tooltip,
  Alert,
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

const PAGE_SIZE = 24;

const POSES = [
  { id: "De Frente", label: "De Frente", Icon: Person },
  { id: "Selfie", label: "Selfie", Icon: Smartphone },
  { id: "POV", label: "POV", Icon: Visibility },
  { id: "Mirror Selfie", label: "Mirror Selfie", Icon: CameraAlt },
  { id: "Sentada", label: "Sentada", Icon: Chair },
  { id: "Só Produto", label: "Só Produto", Icon: ShoppingBag },
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
  "Pele Ultra Realista",
  "Iluminação Natural",
  "Realismo e Detalhamento",
  "Cores Vibrantes",
  "Profundidade de Campo",
  "Mãos Perfeitas",
] as const;

// ---------------------------------------------------------------------------
// Section label
// ---------------------------------------------------------------------------

function SectionLabel({ number, title }: { number: number; title: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2 }}>
      <Box
        sx={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          bgcolor: "primary.main",
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
            color: "primary.contrastText",
            lineHeight: 1,
          }}
        >
          {number}
        </Typography>
      </Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {title}
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
  selected,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Paper
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      elevation={0}
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
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: selected ? "rgba(45,212,255,0.08)" : "background.paper",
        transition: "border-color 0.15s, background-color 0.15s",
        "&:hover": { borderColor: "primary.main" },
      }}
    >
      <Icon
        sx={{
          fontSize: 20,
          color: selected ? "primary.main" : "text.secondary",
        }}
      />
      <Typography
        sx={{
          fontSize: "0.72rem",
          fontWeight: 500,
          color: selected ? "primary.main" : "text.secondary",
          textAlign: "center",
        }}
      >
        {label}
      </Typography>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Product mini-card
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
    <Paper
      component="button"
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      elevation={0}
      sx={{
        all: "unset",
        cursor: "pointer",
        position: "relative",
        borderRadius: 2,
        overflow: "hidden",
        border: "1.5px solid",
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: "background.paper",
        transition: "border-color 0.15s",
        "&:hover": { borderColor: selected ? "primary.main" : "primary.dark" },
        display: "block",
        width: "100%",
      }}
    >
      <Box
        sx={{
          width: "100%",
          aspectRatio: "1/1",
          overflow: "hidden",
          bgcolor: "action.hover",
        }}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ImageIcon sx={{ color: "text.disabled", fontSize: 24 }} />
          </Box>
        )}
      </Box>
      <Box sx={{ px: 0.75, py: 0.6 }}>
        <Typography
          sx={{
            fontSize: "0.6rem",
            color: selected ? "primary.main" : "text.secondary",
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
            bgcolor: "background.default",
            borderRadius: "50%",
          }}
        />
      )}
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Avatar card
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
          borderColor: selected ? "primary.main" : "divider",
          transition: "border-color 0.15s",
          "&:hover": { borderColor: "primary.main" },
        }}
      >
        <img
          src={avatar.thumbnailUrl ?? avatar.imageUrl}
          alt={avatar.name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </Box>
      <Typography
        sx={{
          fontSize: "0.62rem",
          color: selected ? "primary.main" : "text.secondary",
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
// Image upload box
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
        const json = (await res.json().catch(() => ({}))) as { error?: string };
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
              border: "1px solid",
              borderColor: "primary.dark",
              flexShrink: 0,
            }}
          >
            <img
              src={value}
              alt={label}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </Box>
          <Box sx={{ pt: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Imagem carregada
            </Typography>
            <Button size="small" variant="outlined" onClick={() => inputRef.current?.click()} sx={{ mr: 1 }}>
              Trocar
            </Button>
            <Button
              size="small"
              variant="text"
              color="inherit"
              onClick={() => onChange(null)}
              sx={{ color: "text.disabled" }}
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
            border: "1px dashed",
            borderColor: "divider",
            bgcolor: "action.hover",
            transition: "border-color 0.15s",
            "&:hover": { borderColor: "primary.main" },
            boxSizing: "border-box",
          }}
        >
          {uploading ? (
            <CircularProgress size={20} />
          ) : (
            <>
              <UploadFile sx={{ fontSize: 24, color: "text.disabled" }} />
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
            </>
          )}
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 1, py: 0.25, fontSize: "0.72rem" }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main wizard (reads search params — must be inside Suspense)
// ---------------------------------------------------------------------------

function InfluencerIAWizard() {
  const searchParams = useSearchParams();

  const initProductImageUrl = searchParams.get("productImageUrl");
  const initProductName = searchParams.get("productName");
  const initProductCategory = searchParams.get("productCategory");
  const initProductId = searchParams.get("productId");

  // ── Product state ──────────────────────────────────────────────
  const [productTab, setProductTab] = useState<number>(initProductImageUrl ? 1 : 0);
  const [selectedProduct, setSelectedProduct] = useState<ProductDTO | null>(null);
  const [uploadedProductUrl, setUploadedProductUrl] = useState<string | null>(initProductImageUrl);
  const [uploadedProductName, setUploadedProductName] = useState<string>(initProductName ?? "");

  // ── Avatar state ───────────────────────────────────────────────
  const [avatarTab, setAvatarTab] = useState<number>(0);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarProfileDTO | null>(null);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);

  // ── Config state ───────────────────────────────────────────────
  const [pose, setPose] = useState<string>("De Frente");
  const [customPose, setCustomPose] = useState("");
  const [environment, setEnvironment] = useState<string | null>(null);
  const [customEnvironment, setCustomEnvironment] = useState("");
  const [style, setStyle] = useState<string | null>(null);
  const [enhancements, setEnhancements] = useState<string[]>([]);

  // ── Generation state ───────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // ── Products: load 100, display with IntersectionObserver scroll
  const region = getStoredRegion().toUpperCase();
  const { items: allProducts, isLoading: loadingProducts } = useTrendingProducts({
    range: "7d",
    region,
    sort: "sales",
    pageSize: 100,
  });

  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [allProducts.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, allProducts.length));
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [allProducts.length]);

  const displayedProducts = allProducts.slice(0, displayCount);
  const hasMore = displayCount < allProducts.length;

  // Auto-select product from deep-link query param
  const hasAutoSelected = useRef(false);
  useEffect(() => {
    if (initProductId && !hasAutoSelected.current && allProducts.length > 0) {
      const match = allProducts.find((p) => p.id === initProductId);
      if (match) {
        hasAutoSelected.current = true;
        setSelectedProduct(match);
      }
    }
  }, [initProductId, allProducts]);

  // ── Avatars ────────────────────────────────────────────────────
  const { avatars, isLoading: loadingAvatars } = useAvatarProfiles();

  // ── Derived values ─────────────────────────────────────────────
  const effectiveProductImageUrl =
    productTab === 1 ? uploadedProductUrl : selectedProduct?.imageUrl ?? null;
  const effectiveProductName =
    productTab === 1 ? uploadedProductName || null : selectedProduct?.name ?? null;
  const effectiveProductCategory =
    productTab === 1
      ? initProductCategory ?? null
      : (selectedProduct as ProductDTO & { category?: string })?.category ?? null;
  const effectiveAvatarId = avatarTab === 0 ? (selectedAvatar?.id ?? null) : null;
  const effectiveAvatarImageUrl = avatarTab === 1 ? uploadedAvatarUrl : null;

  const canGenerate =
    !!(effectiveProductImageUrl || effectiveProductName) &&
    !!(effectiveAvatarId || effectiveAvatarImageUrl || avatarTab === 0);

  const handleGenerate = useCallback(async () => {
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
      if (!res.ok || !json.imageUrl) throw new Error(json.error ?? "Erro ao gerar imagem");
      setGeneratedImageUrl(json.imageUrl);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Erro ao gerar imagem");
    } finally {
      setGenerating(false);
    }
  }, [
    canGenerate,
    effectiveProductImageUrl,
    effectiveProductName,
    effectiveProductCategory,
    effectiveAvatarId,
    effectiveAvatarImageUrl,
    pose,
    customPose,
    environment,
    customEnvironment,
    style,
    enhancements,
  ]);

  const toggleEnhancement = (id: string) =>
    setEnhancements((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Box sx={{ maxWidth: 720, mx: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
      {/* ── Section 1: Product ──────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3 }}>
        <SectionLabel number={1} title="Escolha o Produto" />

        <Tabs
          value={productTab}
          onChange={(_, v: number) => setProductTab(v)}
          sx={{ mb: 2, minHeight: 36 }}
          TabIndicatorProps={{ sx: { height: 2 } }}
        >
          <Tab label="Produtos Hype" sx={{ minHeight: 36, py: 0.5, fontSize: "0.8rem" }} />
          <Tab label="Upload" sx={{ minHeight: 36, py: 0.5, fontSize: "0.8rem" }} />
        </Tabs>

        {productTab === 0 ? (
          <Box
            sx={{
              height: 400,
              overflowY: "auto",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              p: 1,
            }}
          >
            {loadingProducts && allProducts.length === 0 ? (
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <Box key={i}>
                    <Skeleton variant="rectangular" sx={{ borderRadius: 2, aspectRatio: "1/1" }} />
                    <Skeleton variant="text" sx={{ mt: 0.5, fontSize: "0.6rem" }} />
                  </Box>
                ))}
              </Box>
            ) : (
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
                {displayedProducts.map((p) => (
                  <ProductMiniCard
                    key={p.id}
                    product={p}
                    selected={selectedProduct?.id === p.id}
                    onSelect={() => setSelectedProduct((prev) => (prev?.id === p.id ? null : p))}
                  />
                ))}
                {hasMore && (
                  <Box
                    ref={sentinelRef}
                    sx={{
                      gridColumn: "1 / -1",
                      py: 1.5,
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <CircularProgress size={20} color="primary" />
                  </Box>
                )}
              </Box>
            )}
          </Box>
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
            />
          </Box>
        )}
      </Paper>

      {/* ── Section 2: Avatar ──────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3 }}>
        <SectionLabel number={2} title="Escolha o Influencer" />

        <Tabs
          value={avatarTab}
          onChange={(_, v: number) => setAvatarTab(v)}
          sx={{ mb: 2, minHeight: 36 }}
          TabIndicatorProps={{ sx: { height: 2 } }}
        >
          <Tab label="Avatares Prontos" sx={{ minHeight: 36, py: 0.5, fontSize: "0.8rem" }} />
          <Tab label="Upload" sx={{ minHeight: 36, py: 0.5, fontSize: "0.8rem" }} />
        </Tabs>

        {avatarTab === 0 ? (
          loadingAvatars ? (
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 2 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Box key={i} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75 }}>
                  <Skeleton variant="circular" width={64} height={64} />
                  <Skeleton variant="text" width={48} sx={{ fontSize: "0.62rem" }} />
                </Box>
              ))}
            </Box>
          ) : avatars.length === 0 ? (
            <Typography variant="body2" color="text.disabled" sx={{ textAlign: "center", py: 3 }}>
              Nenhum avatar disponível ainda
            </Typography>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 2 }}>
              {avatars.map((avatar) => (
                <AvatarCard
                  key={avatar.id}
                  avatar={avatar}
                  selected={selectedAvatar?.id === avatar.id}
                  onSelect={() => setSelectedAvatar((prev) => (prev?.id === avatar.id ? null : avatar))}
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
      </Paper>

      {/* ── Section 3: Configure ───────────────────────────── */}
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3 }}>
        <SectionLabel number={3} title="Configure a Imagem" />

        {/* Pose */}
        <Typography variant="overline" color="text.disabled" sx={{ display: "block", mb: 1 }}>
          Pose
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, mb: 2 }}>
          {POSES.map((p) => (
            <TileButton
              key={p.id}
              icon={p.Icon}
              label={p.label}
              selected={pose === p.id}
              onClick={() => setPose((prev) => (prev === p.id ? "" : p.id))}
            />
          ))}
        </Box>

        <TextField
          label="Pose personalizada (opcional)"
          value={customPose}
          onChange={(e) => setCustomPose(e.target.value)}
          multiline
          minRows={2}
          fullWidth
          size="small"
          placeholder="Ex: Segurando o produto próximo ao rosto com expressão de surpresa"
          sx={{ mb: 2.5 }}
        />

        {/* Environment */}
        <Typography variant="overline" color="text.disabled" sx={{ display: "block", mb: 1 }}>
          Ambiente
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, mb: 2 }}>
          {ENVIRONMENTS.map((env) => (
            <TileButton
              key={env.id}
              icon={env.Icon}
              label={env.label}
              selected={environment === env.id}
              onClick={() => setEnvironment((prev) => (prev === env.id ? null : env.id))}
            />
          ))}
        </Box>

        <TextField
          label="Cenário personalizado (opcional)"
          value={customEnvironment}
          onChange={(e) => setCustomEnvironment(e.target.value)}
          multiline
          minRows={2}
          fullWidth
          size="small"
          placeholder="Ex: Quarto minimalista com cama branca e luz natural entrando pela janela"
          sx={{ mb: 2.5 }}
        />

        {/* Style */}
        <Typography variant="overline" color="text.disabled" sx={{ display: "block", mb: 1 }}>
          Estilo do Influencer
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2.5 }}>
          {STYLES.map((s) => (
            <Chip
              key={s}
              label={s}
              size="small"
              onClick={() => setStyle((prev) => (prev === s ? null : s))}
              variant={style === s ? "filled" : "outlined"}
              color={style === s ? "primary" : "default"}
              sx={{
                cursor: "pointer",
                fontWeight: style === s ? 700 : 400,
                color: style === s ? "primary.contrastText" : "text.secondary",
              }}
            />
          ))}
        </Box>

        {/* Enhancements */}
        <Typography variant="overline" color="text.disabled" sx={{ display: "block", mb: 1 }}>
          Melhorias na imagem
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {ENHANCEMENTS.map((e) => (
            <Chip
              key={e}
              label={e}
              size="small"
              onClick={() => toggleEnhancement(e)}
              variant={enhancements.includes(e) ? "filled" : "outlined"}
              color={enhancements.includes(e) ? "primary" : "default"}
              sx={{
                cursor: "pointer",
                fontWeight: enhancements.includes(e) ? 700 : 400,
                color: enhancements.includes(e) ? "primary.contrastText" : "text.secondary",
              }}
            />
          ))}
        </Box>
      </Paper>

      {/* ── Generate ───────────────────────────────────────── */}
      <Button
        variant="contained"
        size="large"
        fullWidth
        disabled={!canGenerate || generating}
        onClick={() => void handleGenerate()}
        startIcon={
          generating ? <CircularProgress size={18} color="inherit" /> : <AutoFixHigh />
        }
        sx={{ py: 1.5, fontSize: "0.95rem", fontWeight: 700, borderRadius: 2 }}
      >
        {generating ? "Gerando imagem…" : "Gerar Imagem"}
      </Button>

      {!canGenerate && !generating && (
        <Typography variant="caption" color="text.disabled" sx={{ textAlign: "center", mt: -1 }}>
          Escolha um produto e um influencer para gerar a imagem
        </Typography>
      )}

      {generationError && <Alert severity="error">{generationError}</Alert>}

      {/* ── Result ─────────────────────────────────────────── */}
      {generatedImageUrl && (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CheckCircle sx={{ fontSize: 18, color: "success.main" }} />
              <Typography variant="subtitle2">Imagem Gerada!</Typography>
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
                  color="inherit"
                  sx={{ color: "text.secondary" }}
                >
                  Regenerar
                </Button>
              </Tooltip>
            </Box>
          </Box>

          <Box
            sx={{
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              maxWidth: 400,
              mx: "auto",
            }}
          >
            <img src={generatedImageUrl} alt="Imagem gerada" style={{ width: "100%", display: "block" }} />
          </Box>

          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: "block", textAlign: "center", mt: 1.5 }}
          >
            Baixe sua imagem antes de sair da página
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Page wrapper
// ---------------------------------------------------------------------------

export default function InfluencerIAPage() {
  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Box sx={{ flexShrink: 0, mb: 1.5 }}>
        <Typography
          component="h1"
          sx={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", mb: 0.25, lineHeight: 1.3 }}
        >
          Influencer IA
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.3 }}>
          Crie imagens UGC ultra-realistas com seu produto
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <Suspense fallback={null}>
          <InfluencerIAWizard />
        </Suspense>
      </Box>
    </Box>
  );
}
