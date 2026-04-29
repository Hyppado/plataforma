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
 *   ?productId=...  pre-selects product in the Produtos Hype tab (tab 0);
 *                   if not found in trending top-100, fetches by ID as fallback.
 */

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
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
  IconButton,
  Collapse,
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
  Bolt,
  ViewModule,
  Slideshow,
  Unarchive,
  Star,
  MenuBook,
  RecordVoiceOver,
  AccessTime,
  ContentCopy,
  OpenInNew,
  Videocam,
  AutoAwesome,
  ExpandMore,
  ExpandLess,
} from "@mui/icons-material";
import type { VeoPart } from "@/lib/influencer-ia/veo-prompt";
import { useAvatarProfiles } from "@/lib/swr/useAvatarProfiles";
import { useTrendingProducts } from "@/lib/swr/useTrending";
import { useExchangeRate } from "@/lib/swr/useExchangeRate";
import { getStoredRegion } from "@/lib/region";
import { formatCurrency } from "@/lib/format";
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
// VEO 3.1 constants
// ---------------------------------------------------------------------------

const VEO_DURATIONS = [
  {
    id: "short" as const,
    label: "Curto",
    subtitle: "2 cenas de 8s",
    Icon: Bolt,
    recommended: true,
  },
  {
    id: "medium" as const,
    label: "Médio",
    subtitle: "4 cenas de 8s",
    Icon: ViewModule,
    recommended: false,
  },
  {
    id: "full" as const,
    label: "Completo",
    subtitle: "8 cenas de 8s",
    Icon: Slideshow,
    recommended: false,
  },
];

const VEO_STYLES = [
  {
    id: "ugc" as const,
    label: "UGC",
    description: "Conteúdo autêntico estilo criador",
    Icon: Smartphone,
  },
  {
    id: "unboxing" as const,
    label: "Unboxing",
    description: "Abrindo e mostrando o produto",
    Icon: Unarchive,
  },
  {
    id: "review" as const,
    label: "Review",
    description: "Avaliação detalhada do produto",
    Icon: Star,
  },
  {
    id: "tutorial" as const,
    label: "Tutorial",
    description: "Como usar o produto",
    Icon: MenuBook,
  },
  {
    id: "testemunho" as const,
    label: "Testemunho",
    description: "Depoimento pessoal sincero",
    Icon: RecordVoiceOver,
  },
];

const VEO_PART_COUNTS = { short: 2, medium: 4, full: 8 } as const;

// ---------------------------------------------------------------------------
// Section label
// ---------------------------------------------------------------------------

function SectionHeader({
  number,
  title,
  open,
  onToggle,
  summary,
}: {
  number: number;
  title: string;
  open: boolean;
  onToggle: () => void;
  summary?: string;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onToggle}
      sx={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        width: "100%",
        py: 0,
        mb: open ? 2 : 0,
      }}
    >
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
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, lineHeight: 1.2 }}
        >
          {title}
        </Typography>
        {!open && summary && (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: "block", mt: 0.15, lineHeight: 1.2 }}
          >
            {summary}
          </Typography>
        )}
      </Box>
      {open ? (
        <ExpandLess
          sx={{ fontSize: 18, color: "text.disabled", flexShrink: 0 }}
        />
      ) : (
        <ExpandMore
          sx={{ fontSize: 18, color: "text.disabled", flexShrink: 0 }}
        />
      )}
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
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
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
      <Box sx={{ px: 0.75, py: 0.5 }}>
        <Typography
          sx={{
            fontSize: "0.68rem",
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
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
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
      const res = await fetch("/api/influencer-ia/upload-reference", {
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
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </Box>
          <Box sx={{ pt: 0.5 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 1 }}
            >
              Imagem carregada
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => inputRef.current?.click()}
              sx={{ mr: 1 }}
            >
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
// Session persistence
// ---------------------------------------------------------------------------

const SESSION_KEY = "influencer-ia-session";

type SessionSnapshot = {
  v: 1;
  productTab: number;
  selectedProduct: ProductDTO | null;
  uploadedProductUrl: string | null;
  uploadedProductName: string;
  selectedVariationUrl: string | null;
  selectedVariationRawUrl: string | null;
  avatarTab: number;
  selectedAvatar: AvatarProfileDTO | null;
  uploadedAvatarUrl: string | null;
  pose: string;
  customPose: string;
  environment: string | null;
  customEnvironment: string;
  style: string | null;
  enhancements: string[];
  generatedImageUrl: string | null;
  veoDuration: "short" | "medium" | "full";
  veoStyle: "ugc" | "unboxing" | "review" | "tutorial" | "testemunho";
  veoParts: VeoPart[];
};

function readSession(): SessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionSnapshot;
    if (parsed?.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Minimal shape returned by GET /api/trending/products/[id] — used only
// when the deep-linked product is not present in the trending top-100 list.
interface FallbackProductDetail {
  id: string;
  name: string;
  images: string[];
  avgPrice: number;
  currency: string;
  commissionRate: number;
  rating: number;
  category: string | null;
  salesTotal: number;
  creatorCount: number;
  sourceUrl: string;
  tiktokUrl: string;
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

  // ── Section collapse state ─────────────────────────────────────
  const [sec1Open, setSec1Open] = useState(true);
  const [sec2Open, setSec2Open] = useState(true);
  const [sec3Open, setSec3Open] = useState(false);

  // ── Product state ──────────────────────────────────────────────
  const [productTab, setProductTab] = useState<number>(
    initProductImageUrl ? 1 : 0,
  );
  const [selectedProduct, setSelectedProduct] = useState<ProductDTO | null>(
    null,
  );
  const [uploadedProductUrl, setUploadedProductUrl] = useState<string | null>(
    initProductImageUrl,
  );
  const [uploadedProductName, setUploadedProductName] = useState<string>(
    initProductName ?? "",
  );

  // ── Variation state (SKU image picker) ────────────────────────
  // selectedVariationUrl  = display (proxied) URL shown in the UI
  // selectedVariationRawUrl = absolute URL passed server-side to generate API
  const [selectedVariationUrl, setSelectedVariationUrl] = useState<
    string | null
  >(null);
  const [selectedVariationRawUrl, setSelectedVariationRawUrl] = useState<
    string | null
  >(null);

  // Fetch variation images when a product is selected
  const { data: variationData } = useSWR<{
    images: string[];
    rawImages: string[];
  }>(
    selectedProduct?.id
      ? `/api/influencer-ia/product-images?productId=${selectedProduct.id}`
      : null,
    (url: string) =>
      fetch(url).then(
        (r) => r.json() as Promise<{ images: string[]; rawImages: string[] }>,
      ),
    { revalidateOnFocus: false },
  );
  const variationImages = variationData?.images ?? [];
  const rawVariationImages = variationData?.rawImages ?? [];

  // Reset variation when product changes (skip on initial mount so session is preserved)
  const isFirstProductRender = useRef(true);
  useEffect(() => {
    if (isFirstProductRender.current) {
      isFirstProductRender.current = false;
      return;
    }
    setSelectedVariationUrl(null);
    setSelectedVariationRawUrl(null);
  }, [selectedProduct?.id]);

  // ── Avatar state ───────────────────────────────────────────────
  const [avatarTab, setAvatarTab] = useState<number>(0);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarProfileDTO | null>(
    null,
  );
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(
    null,
  );

  // ── Config state ───────────────────────────────────────────────
  const [pose, setPose] = useState<string>("De Frente");
  const [customPose, setCustomPose] = useState("");
  const [environment, setEnvironment] = useState<string | null>(null);
  const [customEnvironment, setCustomEnvironment] = useState("");
  const [style, setStyle] = useState<string | null>(null);
  const [enhancements, setEnhancements] = useState<string[]>([]);

  // ── Exchange rate for BRL price display ────────────────────────
  const usdToBrl = useExchangeRate();

  // ── Generation state ───────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null,
  );
  const [generationError, setGenerationError] = useState<string | null>(null);

  // ── VEO 3.1 prompt state ───────────────────────────────────────
  const [veoDuration, setVeoDuration] = useState<"short" | "medium" | "full">(
    "short",
  );
  const [veoStyle, setVeoStyle] = useState<
    "ugc" | "unboxing" | "review" | "tutorial" | "testemunho"
  >("ugc");
  const [veoGenerating, setVeoGenerating] = useState(false);
  const [veoError, setVeoError] = useState<string | null>(null);
  const [veoParts, setVeoParts] = useState<VeoPart[]>([]);
  const [veoManualMode, setVeoManualMode] = useState(false);
  const [veoManualText, setVeoManualText] = useState("");
  const [veoCopiedIndex, setVeoCopiedIndex] = useState<number | null>(null);
  const [veoCopiedAll, setVeoCopiedAll] = useState(false);

  // Ref for auto-scroll to VEO prompts output
  const veoOutputRef = useRef<HTMLDivElement>(null);

  // Restore session on mount (client-side only to avoid hydration mismatch)
  const hasRestoredSession = useRef(false);
  useEffect(() => {
    if (hasRestoredSession.current) return;
    hasRestoredSession.current = true;

    const session = readSession();
    if (!session) return;

    // Only restore if no query params are present (query params take priority)
    if (!initProductImageUrl && !initProductId) {
      if (session.productTab !== undefined) setProductTab(session.productTab);
      if (session.selectedProduct) setSelectedProduct(session.selectedProduct);
      if (session.uploadedProductUrl)
        setUploadedProductUrl(session.uploadedProductUrl);
      if (session.uploadedProductName)
        setUploadedProductName(session.uploadedProductName);
      if (session.selectedVariationUrl)
        setSelectedVariationUrl(session.selectedVariationUrl);
      if (session.selectedVariationRawUrl)
        setSelectedVariationRawUrl(session.selectedVariationRawUrl);
    }

    if (session.avatarTab !== undefined) setAvatarTab(session.avatarTab);
    if (session.selectedAvatar) setSelectedAvatar(session.selectedAvatar);
    if (session.uploadedAvatarUrl)
      setUploadedAvatarUrl(session.uploadedAvatarUrl);
    if (session.pose) setPose(session.pose);
    if (session.customPose) setCustomPose(session.customPose);
    if (session.environment) setEnvironment(session.environment);
    if (session.customEnvironment)
      setCustomEnvironment(session.customEnvironment);
    if (session.style) setStyle(session.style);
    if (session.enhancements) setEnhancements(session.enhancements);
    if (session.generatedImageUrl)
      setGeneratedImageUrl(session.generatedImageUrl);
    if (session.veoDuration) setVeoDuration(session.veoDuration);
    if (session.veoStyle) setVeoStyle(session.veoStyle);
    if (session.veoParts) setVeoParts(session.veoParts);
  }, [initProductImageUrl, initProductId, initProductName]);

  // Auto-scroll to VEO prompts when generation completes
  useEffect(() => {
    if (veoParts.length > 0 && veoOutputRef.current) {
      veoOutputRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [veoParts.length]);

  // Persist full session to sessionStorage whenever relevant state changes
  useEffect(() => {
    const snap: SessionSnapshot = {
      v: 1,
      productTab,
      selectedProduct,
      uploadedProductUrl,
      uploadedProductName,
      selectedVariationUrl,
      selectedVariationRawUrl,
      avatarTab,
      selectedAvatar,
      uploadedAvatarUrl,
      pose,
      customPose,
      environment,
      customEnvironment,
      style,
      enhancements,
      generatedImageUrl,
      veoDuration,
      veoStyle,
      veoParts,
    };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(snap));
    } catch {
      // storage unavailable or quota exceeded
    }
  }, [
    productTab,
    selectedProduct,
    uploadedProductUrl,
    uploadedProductName,
    selectedVariationUrl,
    selectedVariationRawUrl,
    avatarTab,
    selectedAvatar,
    uploadedAvatarUrl,
    pose,
    customPose,
    environment,
    customEnvironment,
    style,
    enhancements,
    generatedImageUrl,
    veoDuration,
    veoStyle,
    veoParts,
  ]);

  // ── Products: load 100, display with IntersectionObserver scroll
  const region = getStoredRegion().toUpperCase();
  const { items: allProducts, isLoading: loadingProducts } =
    useTrendingProducts({
      range: "7d",
      region,
      sort: "sales",
      pageSize: 100,
    });

  const [productPage, setProductPage] = useState(0);

  // Reset to first page when product list changes
  useEffect(() => {
    setProductPage(0);
  }, [allProducts.length]);

  const totalPages = Math.max(1, Math.ceil(allProducts.length / PAGE_SIZE));
  const displayedProducts = allProducts.slice(
    productPage * PAGE_SIZE,
    (productPage + 1) * PAGE_SIZE,
  );

  // Auto-select product from deep-link query param
  const hasAutoSelected = useRef(false);
  useEffect(() => {
    if (!initProductId || hasAutoSelected.current || loadingProducts) return;

    const match = allProducts.find((p) => p.id === initProductId);
    if (match) {
      hasAutoSelected.current = true;
      setSelectedProduct(match);
      return;
    }

    // Product not in trending top-100 — fetch by ID as fallback
    hasAutoSelected.current = true;
    fetch(`/api/trending/products/${encodeURIComponent(initProductId)}`)
      .then((r) => (r.ok ? (r.json() as Promise<FallbackProductDetail>) : null))
      .then((detail) => {
        if (!detail) return;
        setSelectedProduct({
          id: detail.id,
          name: detail.name,
          imageUrl: detail.images[0] ?? "",
          category: detail.category ?? "",
          priceBRL: detail.avgPrice,
          launchDate: "",
          rating: detail.rating,
          sales: detail.salesTotal,
          avgPriceBRL: detail.avgPrice,
          commissionRate: detail.commissionRate,
          revenueBRL: 0,
          liveRevenueBRL: 0,
          videoRevenueBRL: 0,
          mallRevenueBRL: 0,
          currency: detail.currency,
          creatorCount: detail.creatorCount,
          creatorConversionRate: 0,
          sourceUrl: detail.sourceUrl,
          tiktokUrl: detail.tiktokUrl,
          dateRange: "",
        });
      })
      .catch(() => {});
  }, [initProductId, allProducts, loadingProducts]);

  // ── Avatars ────────────────────────────────────────────────────
  const { avatars, isLoading: loadingAvatars } = useAvatarProfiles();

  // ── Derived values ─────────────────────────────────────────────
  // Raw/absolute URL — passed to the generate API so the server can fetch it
  const effectiveProductRawImageUrl =
    productTab === 1
      ? uploadedProductUrl
      : (selectedVariationRawUrl ?? selectedProduct?.imageUrl ?? null);
  const effectiveProductName =
    productTab === 1
      ? uploadedProductName || null
      : (selectedProduct?.name ?? null);
  const effectiveProductCategory =
    productTab === 1
      ? (initProductCategory ?? null)
      : ((selectedProduct as ProductDTO & { category?: string })?.category ??
        null);
  const effectiveAvatarId =
    avatarTab === 0 ? (selectedAvatar?.id ?? null) : null;
  const effectiveAvatarImageUrl = avatarTab === 1 ? uploadedAvatarUrl : null;

  const canGenerate =
    !!(effectiveProductRawImageUrl || effectiveProductName) &&
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
          productImageUrl: effectiveProductRawImageUrl,
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
      if (!res.ok || !json.imageUrl)
        throw new Error(json.error ?? "Erro ao gerar imagem");
      setGeneratedImageUrl(json.imageUrl);
    } catch (err) {
      setGenerationError(
        err instanceof Error ? err.message : "Erro ao gerar imagem",
      );
    } finally {
      setGenerating(false);
    }
  }, [
    canGenerate,
    effectiveProductRawImageUrl,
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
    setEnhancements((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id],
    );

  const handleGenerateVeo = useCallback(async () => {
    const name = effectiveProductName;
    if (!name) return;
    setVeoGenerating(true);
    setVeoError(null);
    setVeoParts([]);
    try {
      const res = await fetch("/api/influencer-ia/generate-veo-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: name,
          productCategory: effectiveProductCategory,
          style: veoStyle,
          duration: veoDuration,
        }),
      });
      const json = (await res.json()) as {
        parts?: VeoPart[];
        error?: string;
      };
      if (!res.ok || !json.parts)
        throw new Error(json.error ?? "Erro ao gerar prompts");
      setVeoParts(json.parts);
      setVeoManualMode(false);
    } catch (err) {
      setVeoError(
        err instanceof Error ? err.message : "Erro ao gerar prompts VEO",
      );
    } finally {
      setVeoGenerating(false);
    }
  }, [effectiveProductName, effectiveProductCategory, veoStyle, veoDuration]);

  const handleVeoCopy = async (part: VeoPart, index: number) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(part, null, 2));
      setVeoCopiedIndex(index);
      setTimeout(() => setVeoCopiedIndex(null), 2000);
    } catch {
      // clipboard not available — silent fail
    }
  };

  const handleVeoCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(veoParts, null, 2));
      setVeoCopiedAll(true);
      setTimeout(() => setVeoCopiedAll(false), 2000);
    } catch {
      // clipboard not available — silent fail
    }
  };

  const handleVeoManualSubmit = () => {
    const text = veoManualText.trim();
    if (!text) return;
    const manualPart: VeoPart = {
      prompt: text,
      aspect_ratio: "9:16",
      duration: 8,
      audio: true,
      language: "pt-BR",
      part: 1,
      label: "Manual",
      reference_instructions:
        "Keep the same person, product and environment as the reference image.",
      negative_instructions:
        "Do not add on-screen text, logos, subtitles, watermarks, distorted hands, distorted face, or distorted product.",
      _metadata: {
        part: 1,
        total_parts: 1,
        product: effectiveProductName ?? "",
        label: "Manual",
      },
    };
    setVeoParts([manualPart]);
    setVeoManualMode(false);
  };

  const handleReset = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setSelectedProduct(null);
    setUploadedProductUrl(null);
    setUploadedProductName("");
    setSelectedVariationUrl(null);
    setSelectedVariationRawUrl(null);
    setSelectedAvatar(null);
    setUploadedAvatarUrl(null);
    setPose("De Frente");
    setCustomPose("");
    setEnvironment(null);
    setCustomEnvironment("");
    setStyle(null);
    setEnhancements([]);
    setGeneratedImageUrl(null);
    setGenerationError(null);
    setVeoParts([]);
    setVeoError(null);
    setVeoManualMode(false);
    setVeoManualText("");
    setVeoDuration("short");
    setVeoStyle("ugc");
    setSec1Open(true);
    setSec2Open(true);
    setSec3Open(false);
    setProductTab(0);
    setAvatarTab(0);
    setProductPage(0);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Box
      sx={{
        display: "flex",
        gap: { xs: 2, md: 3 },
        flexDirection: { xs: "column", md: "row" },
        alignItems: "flex-start",
      }}
    >
      {/* ── LEFT COLUMN: wizard (own scroll) ────────────────── */}
      <Box
        sx={{
          width: { xs: "100%", md: 400 },
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          maxHeight: { md: "calc(100dvh - 172px)" },
          overflow: { md: "hidden" },
        }}
      >
        {/* Scrollable sections */}
        <Box
          sx={{
            flex: 1,
            overflowY: { md: "auto" },
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            pr: { md: 0.5 },
            pb: 1,
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.1) transparent",
            "&::-webkit-scrollbar": { width: 4 },
            "&::-webkit-scrollbar-track": { background: "transparent" },
            "&::-webkit-scrollbar-thumb": {
              background: "rgba(255,255,255,0.1)",
              borderRadius: 4,
            },
            "&::-webkit-scrollbar-thumb:hover": {
              background: "rgba(255,255,255,0.2)",
            },
          }}
        >
          {/* ── Section 1: Product ──────────────────────────────── */}
          <Paper
            variant="outlined"
            sx={{ p: { xs: 2, sm: 2 }, borderRadius: 3, flexShrink: 0 }}
          >
            <SectionHeader
              number={1}
              title="Escolha o Produto"
              open={sec1Open}
              onToggle={() => setSec1Open((v) => !v)}
              summary={
                selectedProduct
                  ? selectedProduct.name
                  : productTab === 1 && uploadedProductUrl
                    ? uploadedProductName || "Imagem carregada"
                    : undefined
              }
            />
            <Collapse in={sec1Open} unmountOnExit>
              <Tabs
                value={productTab}
                onChange={(_, v: number) => setProductTab(v)}
                sx={{ mb: 2, minHeight: 36 }}
                TabIndicatorProps={{ sx: { height: 2 } }}
              >
                <Tab
                  label="Produtos Hype"
                  sx={{ minHeight: 36, py: 0.5, fontSize: "0.8rem" }}
                />
                <Tab
                  label="Upload"
                  sx={{ minHeight: 36, py: 0.5, fontSize: "0.8rem" }}
                />
              </Tabs>

              {productTab === 0 ? (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    maxHeight: 320,
                    overflow: "hidden",
                  }}
                >
                  {/* ── Selected product panel — sticky at top ── */}
                  {selectedProduct && (
                    <Box
                      sx={{
                        flexShrink: 0,
                        px: 1.5,
                        py: 1,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        bgcolor: "background.paper",
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.25,
                        }}
                      >
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 1.5,
                            overflow: "hidden",
                            flexShrink: 0,
                            border: "1px solid",
                            borderColor: "primary.dark",
                          }}
                        >
                          <img
                            src={
                              selectedVariationUrl ?? selectedProduct.imageUrl
                            }
                            alt={selectedProduct.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                              mb: 0.15,
                            }}
                          >
                            <CheckCircle
                              sx={{ fontSize: 12, color: "primary.main" }}
                            />
                            <Typography
                              variant="caption"
                              sx={{
                                color: "primary.main",
                                fontWeight: 700,
                                fontSize: "0.68rem",
                              }}
                            >
                              Selecionado
                            </Typography>
                          </Box>
                          <Typography
                            sx={{
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              color: "text.primary",
                              lineHeight: 1.3,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {selectedProduct.name}
                          </Typography>
                          {selectedProduct.priceBRL > 0 && (
                            <Typography
                              sx={{
                                fontSize: "0.72rem",
                                color: "secondary.main",
                                fontWeight: 700,
                              }}
                            >
                              {formatCurrency(
                                selectedProduct.priceBRL,
                                selectedProduct.currency,
                                usdToBrl,
                              )}
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      {/* Variation images */}
                      {variationImages.length > 1 && (
                        <Box
                          sx={{
                            mt: 1,
                            display: "flex",
                            gap: 0.75,
                            flexWrap: "wrap",
                          }}
                        >
                          {variationImages.map((url, i) => {
                            const rawUrl = rawVariationImages[i] ?? url;
                            const active =
                              (selectedVariationUrl ??
                                selectedProduct.imageUrl) === url;
                            return (
                              <Box
                                key={i}
                                component="button"
                                type="button"
                                onClick={() => {
                                  const isAlreadySelected =
                                    selectedVariationUrl === url;
                                  setSelectedVariationUrl(
                                    isAlreadySelected ? null : url,
                                  );
                                  setSelectedVariationRawUrl(
                                    isAlreadySelected ? null : rawUrl,
                                  );
                                }}
                                aria-pressed={active}
                                sx={{
                                  background: "none",
                                  padding: 0,
                                  outline: "none",
                                  cursor: "pointer",
                                  display: "block",
                                  width: 44,
                                  height: 44,
                                  borderRadius: "50%",
                                  overflow: "hidden",
                                  border: "2.5px solid",
                                  borderColor: active
                                    ? "secondary.main"
                                    : "divider",
                                  flexShrink: 0,
                                  transition: "border-color 0.15s",
                                  "&:hover": {
                                    borderColor: active
                                      ? "secondary.main"
                                      : "primary.main",
                                  },
                                }}
                              >
                                <img
                                  src={url}
                                  alt={`Variação ${i + 1}`}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    display: "block",
                                  }}
                                />
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* ── Product grid ── */}
                  <Box
                    sx={{
                      flex: 1,
                      overflowY: "auto",
                      scrollbarWidth: "thin",
                      scrollbarColor: "rgba(255,255,255,0.1) transparent",
                      "&::-webkit-scrollbar": { width: 4 },
                      "&::-webkit-scrollbar-track": {
                        background: "transparent",
                      },
                      "&::-webkit-scrollbar-thumb": {
                        background: "rgba(255,255,255,0.1)",
                        borderRadius: 4,
                      },
                    }}
                  >
                    <Box sx={{ p: 1 }}>
                      {loadingProducts && allProducts.length === 0 ? (
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(5, 1fr)",
                            gap: 0.5,
                          }}
                        >
                          {Array.from({ length: 15 }).map((_, i) => (
                            <Box key={i}>
                              <Skeleton
                                variant="rectangular"
                                sx={{ borderRadius: 2, aspectRatio: "1/1" }}
                              />
                              <Skeleton
                                variant="text"
                                sx={{ mt: 0.5, fontSize: "0.6rem" }}
                              />
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(5, 1fr)",
                            gap: 0.5,
                          }}
                        >
                          {displayedProducts.map((p) => (
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
                      )}
                    </Box>
                  </Box>
                  {/* end scroll wrapper */}

                  {/* ── Pagination controls ── */}
                  {allProducts.length > PAGE_SIZE && (
                    <Box
                      sx={{
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        px: 1.5,
                        py: 0.75,
                        borderTop: "1px solid",
                        borderColor: "divider",
                        bgcolor: "background.paper",
                      }}
                    >
                      <Button
                        size="small"
                        variant="text"
                        disabled={productPage === 0}
                        onClick={() => setProductPage((p) => p - 1)}
                        sx={{ fontSize: "0.75rem", minWidth: 0, px: 1 }}
                      >
                        ← Anterior
                      </Button>
                      <Typography variant="caption" color="text.disabled">
                        {productPage + 1} / {totalPages}
                      </Typography>
                      <Button
                        size="small"
                        variant="text"
                        disabled={productPage >= totalPages - 1}
                        onClick={() => setProductPage((p) => p + 1)}
                        sx={{ fontSize: "0.75rem", minWidth: 0, px: 1 }}
                      >
                        Próxima →
                      </Button>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box
                  sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
                >
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

              {/* ── Selected product summary + variation picker ───── */}
              {/* (now shown inside the product grid window above) */}
            </Collapse>
          </Paper>

          {/* ── Section 2: Avatar ──────────────────────────────── */}
          <Paper
            variant="outlined"
            sx={{ p: { xs: 2, sm: 2 }, borderRadius: 3, flexShrink: 0 }}
          >
            <SectionHeader
              number={2}
              title="Escolha o Influencer"
              open={sec2Open}
              onToggle={() => setSec2Open((v) => !v)}
              summary={
                avatarTab === 0 && selectedAvatar
                  ? selectedAvatar.name
                  : avatarTab === 1 && uploadedAvatarUrl
                    ? "Foto carregada"
                    : undefined
              }
            />
            <Collapse in={sec2Open} unmountOnExit>
              <Tabs
                value={avatarTab}
                onChange={(_, v: number) => setAvatarTab(v)}
                sx={{ mb: 2, minHeight: 36 }}
                TabIndicatorProps={{ sx: { height: 2 } }}
              >
                <Tab
                  label="Avatares Prontos"
                  sx={{ minHeight: 36, py: 0.5, fontSize: "0.8rem" }}
                />
                <Tab
                  label="Upload"
                  sx={{ minHeight: 36, py: 0.5, fontSize: "0.8rem" }}
                />
              </Tabs>

              {avatarTab === 0 ? (
                loadingAvatars ? (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(80px, 1fr))",
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
                        <Skeleton variant="circular" width={64} height={64} />
                        <Skeleton
                          variant="text"
                          width={48}
                          sx={{ fontSize: "0.62rem" }}
                        />
                      </Box>
                    ))}
                  </Box>
                ) : avatars.length === 0 ? (
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 3 }}
                  >
                    Nenhum avatar disponível ainda
                  </Typography>
                ) : (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(84px, 1fr))",
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
            </Collapse>
          </Paper>

          {/* ── Section 3: Configure ───────────────────────────── */}
          <Paper
            variant="outlined"
            sx={{ p: { xs: 2, sm: 2 }, borderRadius: 3, flexShrink: 0 }}
          >
            <SectionHeader
              number={3}
              title="Configure a Imagem"
              open={sec3Open}
              onToggle={() => setSec3Open((v) => !v)}
              summary={
                [pose, environment, style].filter(Boolean).join(" · ") ||
                undefined
              }
            />
            <Collapse in={sec3Open} unmountOnExit>
              {/* Pose */}
              <Typography
                variant="overline"
                color="text.disabled"
                sx={{ display: "block", mb: 1 }}
              >
                Pose
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 1,
                  mb: 2,
                }}
              >
                {POSES.map((p) => (
                  <TileButton
                    key={p.id}
                    icon={p.Icon}
                    label={p.label}
                    selected={pose === p.id}
                    onClick={() =>
                      setPose((prev) => (prev === p.id ? "" : p.id))
                    }
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
              <Typography
                variant="overline"
                color="text.disabled"
                sx={{ display: "block", mb: 1 }}
              >
                Ambiente
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 1,
                  mb: 2,
                }}
              >
                {ENVIRONMENTS.map((env) => (
                  <TileButton
                    key={env.id}
                    icon={env.Icon}
                    label={env.label}
                    selected={environment === env.id}
                    onClick={() =>
                      setEnvironment((prev) =>
                        prev === env.id ? null : env.id,
                      )
                    }
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
              <Typography
                variant="overline"
                color="text.disabled"
                sx={{ display: "block", mb: 1 }}
              >
                Estilo do Influencer
              </Typography>
              <Box
                sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2.5 }}
              >
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
                      color:
                        style === s ? "primary.contrastText" : "text.secondary",
                    }}
                  />
                ))}
              </Box>

              {/* Enhancements */}
              <Typography
                variant="overline"
                color="text.disabled"
                sx={{ display: "block", mb: 1 }}
              >
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
                      color: enhancements.includes(e)
                        ? "primary.contrastText"
                        : "text.secondary",
                    }}
                  />
                ))}
              </Box>
            </Collapse>
          </Paper>
        </Box>

        {/* ── Generate + Reset ─────────────────────────────── */}
        <Box
          sx={{
            flexShrink: 0,
            pt: 1.5,
            pb: { xs: 1, md: 0 },
            display: "flex",
            flexDirection: "column",
            gap: 1,
            borderTop: { md: "1px solid" },
            borderColor: { md: "divider" },
          }}
        >
          <Button
            variant="contained"
            size="large"
            fullWidth
            disabled={!canGenerate || generating}
            onClick={() => void handleGenerate()}
            startIcon={
              generating ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <AutoFixHigh />
              )
            }
            sx={{
              py: 1.5,
              fontSize: "0.95rem",
              fontWeight: 700,
              borderRadius: 2,
            }}
          >
            {generating ? "Gerando imagem…" : "Gerar Imagem"}
          </Button>

          {!canGenerate && !generating && (
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ textAlign: "center" }}
            >
              Escolha um produto e um influencer para gerar a imagem
            </Typography>
          )}

          <Button
            variant="outlined"
            size="medium"
            fullWidth
            onClick={handleReset}
            sx={{
              fontSize: "0.85rem",
              fontWeight: 600,
              borderRadius: 2,
              color: "text.secondary",
              borderColor: "divider",
            }}
          >
            Reiniciar
          </Button>
        </Box>
      </Box>
      {/* ── RIGHT COLUMN: generated image + VEO ─────────────── */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          maxHeight: { md: "calc(100dvh - 172px)" },
          overflow: { md: "hidden" },
        }}
      >
        {/* Scrollable content */}
        <Box
          sx={{
            flex: 1,
            overflowY: { md: "auto" },
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pb: 1,
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.1) transparent",
            "&::-webkit-scrollbar": { width: 4 },
            "&::-webkit-scrollbar-track": { background: "transparent" },
            "&::-webkit-scrollbar-thumb": {
              background: "rgba(255,255,255,0.1)",
              borderRadius: 4,
            },
            "&::-webkit-scrollbar-thumb:hover": {
              background: "rgba(255,255,255,0.2)",
            },
          }}
        >
          {generationError && <Alert severity="error">{generationError}</Alert>}

          {generating ? (
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: 3,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                minHeight: 320,
              }}
            >
              <CircularProgress size={40} color="primary" />
              <Typography variant="body2" color="text.secondary">
                Gerando imagem…
              </Typography>
            </Paper>
          ) : generatedImageUrl ? (
            <Paper
              variant="outlined"
              sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3 }}
            >
              <Box
                sx={{
                  position: "relative",
                  borderRadius: 2,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                  maxWidth: { xs: "60%", sm: 230 },
                  mx: "auto",
                  width: "100%",
                  bgcolor: "rgba(0,0,0,0.02)",
                }}
              >
                <img
                  src={generatedImageUrl}
                  alt="Imagem gerada"
                  style={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                    maxHeight: "none",
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    display: "flex",
                    gap: 1,
                    p: 2,
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
                  }}
                >
                  <Button
                    variant="text"
                    size="small"
                    startIcon={<Refresh />}
                    onClick={() => void handleGenerate()}
                    disabled={generating}
                    sx={{
                      flex: 1,
                      color: "white",
                      "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                    }}
                  >
                    Regenerar
                  </Button>
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
                      flex: 1,
                      color: "white",
                      borderColor: "rgba(255,255,255,0.5)",
                      "&:hover": {
                        borderColor: "white",
                        bgcolor: "rgba(255,255,255,0.1)",
                      },
                    }}
                  >
                    Baixar
                  </Button>
                </Box>
              </Box>
            </Paper>
          ) : (
            <Paper
              variant="outlined"
              sx={{
                borderRadius: 3,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1.5,
                minHeight: 320,
                border: "1px dashed",
                borderColor: "divider",
              }}
            >
              <ImageIcon
                sx={{ fontSize: 48, color: "text.disabled", opacity: 0.4 }}
              />
              <Typography
                variant="body2"
                color="text.disabled"
                sx={{ textAlign: "center", px: 2 }}
              >
                Sua imagem aparecerá aqui
              </Typography>
            </Paper>
          )}

          {/* ── Section 4: VEO 3.1 Prompt Style ───────────────── */}
          {generatedImageUrl && (
            <Paper
              variant="outlined"
              sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3 }}
            >
              {/* Header */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  mb: 0.5,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Videocam sx={{ fontSize: 18, color: "secondary.main" }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Escolha o Estilo do Vídeo
                  </Typography>
                </Box>
              </Box>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 2.5 }}
              >
                Prompts otimizados para vídeo
                {effectiveProductName ? (
                  <>
                    {" · "}
                    <Box component="em" sx={{ color: "text.primary" }}>
                      {effectiveProductName}
                    </Box>
                  </>
                ) : null}
              </Typography>

              {/* Duration */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  mb: 1.25,
                }}
              >
                <AccessTime sx={{ fontSize: 13, color: "text.disabled" }} />
                <Typography
                  variant="overline"
                  color="text.disabled"
                  sx={{ lineHeight: 1 }}
                >
                  Duração do Vídeo
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 1,
                  mb: 3,
                }}
              >
                {VEO_DURATIONS.map((d) => {
                  const selected = veoDuration === d.id;
                  return (
                    <Box
                      key={d.id}
                      component="button"
                      type="button"
                      onClick={() => setVeoDuration(d.id)}
                      aria-pressed={selected}
                      sx={{
                        all: "unset",
                        cursor: "pointer",
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 0.5,
                        p: 1.5,
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: selected ? "secondary.main" : "divider",
                        bgcolor: selected
                          ? "rgba(255,45,120,0.07)"
                          : "background.paper",
                        transition:
                          "border-color 0.15s, background-color 0.15s",
                        "&:hover": { borderColor: "secondary.main" },
                      }}
                    >
                      {d.recommended && (
                        <Chip
                          label="Recomendado"
                          size="small"
                          sx={{
                            position: "absolute",
                            top: -10,
                            left: "50%",
                            transform: "translateX(-50%)",
                            fontSize: "0.58rem",
                            height: 18,
                            bgcolor: "secondary.main",
                            color: "#fff",
                            fontWeight: 700,
                            "& .MuiChip-label": { px: 0.75 },
                          }}
                        />
                      )}
                      <d.Icon
                        sx={{
                          fontSize: 22,
                          color: selected ? "secondary.main" : "text.secondary",
                          mt: d.recommended ? 0.5 : 0,
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: "0.8rem",
                          fontWeight: selected ? 700 : 500,
                          color: selected ? "secondary.main" : "text.primary",
                        }}
                      >
                        {d.label}
                      </Typography>
                      <Typography
                        sx={{ fontSize: "0.65rem", color: "text.disabled" }}
                      >
                        {d.subtitle}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              {/* Style grid */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 1,
                  mb: 2.5,
                }}
              >
                {VEO_STYLES.map((s) => {
                  const selected = veoStyle === s.id;
                  return (
                    <Box
                      key={s.id}
                      component="button"
                      type="button"
                      onClick={() => setVeoStyle(s.id)}
                      aria-pressed={selected}
                      sx={{
                        all: "unset",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 1.25,
                        p: 1.5,
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: selected ? "secondary.main" : "divider",
                        bgcolor: selected
                          ? "rgba(255,45,120,0.07)"
                          : "background.paper",
                        transition:
                          "border-color 0.15s, background-color 0.15s",
                        "&:hover": { borderColor: "secondary.main" },
                      }}
                    >
                      <s.Icon
                        sx={{
                          fontSize: 20,
                          color: selected ? "secondary.main" : "text.secondary",
                          mt: 0.1,
                          flexShrink: 0,
                        }}
                      />
                      <Box>
                        <Typography
                          sx={{
                            fontSize: "0.82rem",
                            fontWeight: selected ? 700 : 500,
                            color: selected ? "secondary.main" : "text.primary",
                            lineHeight: 1.2,
                          }}
                        >
                          {s.label}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: "0.68rem",
                            color: "text.disabled",
                            mt: 0.25,
                          }}
                        >
                          {s.description}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              {/* Manual mode text input */}
              {veoManualMode && (
                <TextField
                  label="Seu prompt de vídeo"
                  value={veoManualText}
                  onChange={(e) => setVeoManualText(e.target.value)}
                  multiline
                  minRows={4}
                  fullWidth
                  size="small"
                  placeholder={`Realistic UGC TikTok video. Medium shot, stable camera. Creator presents ${effectiveProductName ?? "o produto"}. Audio: "Texto falado em português…"`}
                />
              )}

              {veoError && (
                <Alert severity="error" sx={{ mt: 1.5 }}>
                  {veoError}
                </Alert>
              )}
            </Paper>
          )}

          {/* ── VEO Prompts Output ─────────────────────────────── */}
          {veoParts.length > 0 && (
            <Paper
              ref={veoOutputRef}
              variant="outlined"
              sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3 }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 2,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Videocam sx={{ fontSize: 16, color: "secondary.main" }} />
                  <Typography variant="subtitle2">
                    Prompts Otimizados ({veoParts.length})
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    size="small"
                    variant={veoCopiedAll ? "contained" : "outlined"}
                    startIcon={
                      veoCopiedAll ? (
                        <CheckCircle sx={{ fontSize: 14 }} />
                      ) : (
                        <ContentCopy sx={{ fontSize: 14 }} />
                      )
                    }
                    onClick={() => void handleVeoCopyAll()}
                    sx={{
                      fontSize: "0.75rem",
                      bgcolor: veoCopiedAll ? "success.main" : undefined,
                      color: veoCopiedAll ? "#fff" : undefined,
                      "&:hover": {
                        bgcolor: veoCopiedAll ? "success.dark" : undefined,
                      },
                    }}
                  >
                    {veoCopiedAll ? "Copiado!" : "Copiar Todos"}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                    href="https://labs.google/fx/tools/video-fx"
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ fontSize: "0.75rem" }}
                  >
                    Abrir VEO
                  </Button>
                </Box>
              </Box>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {veoParts.map((part, i) => (
                  <Box key={i}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 0.75,
                      }}
                    >
                      <Chip
                        label={`Parte ${part.part}`}
                        size="small"
                        sx={{
                          bgcolor: "rgba(167,139,250,0.15)",
                          color: "#a78bfa",
                          fontWeight: 700,
                          fontSize: "0.65rem",
                          height: 20,
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 600, color: "text.primary" }}
                      >
                        {part.label}
                      </Typography>
                      <Tooltip
                        title={
                          veoCopiedIndex === i ? "Copiado!" : "Copiar JSON"
                        }
                      >
                        <IconButton
                          size="small"
                          onClick={() => void handleVeoCopy(part, i)}
                          sx={{ ml: "auto", color: "text.disabled" }}
                        >
                          <ContentCopy
                            sx={{
                              fontSize: 14,
                              color:
                                veoCopiedIndex === i
                                  ? "success.main"
                                  : "inherit",
                            }}
                          />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Box
                      sx={{
                        bgcolor: "rgba(0,0,0,0.3)",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1.5,
                        p: 1.5,
                        fontFamily: "monospace",
                        fontSize: "0.72rem",
                        color: "text.secondary",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        lineHeight: 1.6,
                        overflowX: "auto",
                      }}
                    >
                      {JSON.stringify(part, null, 2)}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Paper>
          )}
        </Box>

        {/* ── Sticky VEO generate button ──────────────────────── */}
        {generatedImageUrl && (
          <Box
            sx={{
              flexShrink: 0,
              pt: 1.5,
              pb: { xs: 1, md: 0 },
              display: "flex",
              flexDirection: "column",
              gap: 1,
              borderTop: { md: "1px solid" },
              borderColor: { md: "divider" },
            }}
          >
            {!veoManualMode ? (
              <>
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={veoGenerating || !effectiveProductName}
                  onClick={() => void handleGenerateVeo()}
                  startIcon={
                    veoGenerating ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : (
                      <AutoAwesome />
                    )
                  }
                  sx={{
                    py: 1.5,
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    borderRadius: 2,
                    background:
                      "linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)",
                    "&:hover": {
                      background:
                        "linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)",
                    },
                    "&:disabled": { opacity: 0.6 },
                  }}
                >
                  {veoGenerating
                    ? "Gerando prompts…"
                    : `✨ Gerar Prompts (${VEO_PART_COUNTS[veoDuration]} partes)`}
                </Button>

                <Button
                  variant="text"
                  fullWidth
                  onClick={() => setVeoManualMode(true)}
                  sx={{ color: "text.secondary", fontSize: "0.82rem" }}
                >
                  Prefiro escrever meu próprio texto
                </Button>
              </>
            ) : (
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleVeoManualSubmit}
                  disabled={!veoManualText.trim()}
                  sx={{
                    background:
                      "linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)",
                    flex: 1,
                  }}
                >
                  Usar como Prompt
                </Button>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => setVeoManualMode(false)}
                  sx={{ color: "text.secondary" }}
                >
                  Cancelar
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Page wrapper
// ---------------------------------------------------------------------------

export default function InfluencerIAPage() {
  return (
    <Box>
      <Box sx={{ mb: 1.5 }}>
        <Typography
          component="h1"
          sx={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "#fff",
            mb: 0.25,
            lineHeight: 1.3,
          }}
        >
          Influencer IA
        </Typography>
        <Typography
          sx={{
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.5)",
            lineHeight: 1.3,
          }}
        >
          Crie imagens UGC ultra-realistas com seu produto
        </Typography>
      </Box>

      <Suspense fallback={null}>
        <InfluencerIAWizard />
      </Suspense>
    </Box>
  );
}
