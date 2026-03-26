// DTO types for Hyppado trending data

// TimeRange is defined in lib/filters/timeRange.ts — re-exported here for
// backward compatibility with imports from lib/types/dto.ts.
export type { TimeRange } from "@/lib/filters/timeRange";

export interface DateRangeParams {
  range?: "1d" | "7d" | "30d" | "90d";
  start?: string; // ISO date
  end?: string; // ISO date
}

// ============================================
// Video DTO
// ============================================
export interface VideoDTO {
  id: string;
  title: string; // Descrição do vídeo
  duration: string; // Duração
  creatorHandle: string; // Usuário do criador
  publishedAt: string; // Data de publicação
  revenueBRL: number; // Receita (valor na moeda da região)
  currency: string; // Moeda da receita (ex: "USD", "BRL")
  sales: number; // Vendas
  views: number; // Visualizações
  gpmBRL: number; // GPM (R$)
  cpaBRL: number; // CPA (R$)
  adRatio: number; // Ratio de visualizações de Ads
  adCostBRL: number; // Custo de publicidade (R$)
  roas: number; // ROAS
  sourceUrl: string; // Link da fonte de dados
  tiktokUrl: string; // Link do TikTok (canonical when possible)
  thumbnailUrl: string | null; // Real thumbnail from TikTok oEmbed
  dateRange: string; // Intervalo de datas
  categoryId?: string; // externalId da categoria EchoTik
  product?: ProductDTO; // Produto relacionado ao vídeo (opcional)
}

// ============================================
// Product DTO
// ============================================
export interface ProductDTO {
  id: string;
  name: string; // Nome do produto
  imageUrl: string; // Link da imagem
  category: string; // Categoria
  priceBRL: number; // Preço (R$)
  launchDate: string; // Data de lançamento
  isNew?: boolean; // Produto novo?
  rating: number; // Classificações do produto
  sales: number; // Vendas
  avgPriceBRL: number; // Preço médio por unidade (R$)
  commissionRate: number; // Taxa de comissão
  revenueBRL: number; // Receita(R$)
  liveRevenueBRL: number; // Receitas ao vivo (R$)
  videoRevenueBRL: number; // Receita de vídeo (R$)
  mallRevenueBRL: number; // Receita de shopping centers (R$)
  creatorCount: number; // Número de criadores
  creatorConversionRate: number; // Taxa de conversão de criadores
  sourceUrl: string; // Link da fonte de dados
  tiktokUrl: string; // Link do TikTok
  dateRange: string; // Intervalo de datas
}

// ============================================
// Creator DTO
// ============================================
export interface CreatorDTO {
  id: string;
  name: string; // Nome do criador
  handle: string; // Usuário do criador
  followers: number; // Seguidores
  revenueBRL: number; // Receita (R$)
  productCount: number; // Quantidade de produtos
  liveCount: number; // Número de transmissões ao vivo
  liveGmvBRL: number; // GMV ao vivo (R$)
  videoCount: number; // Número de vídeos
  videoGmvBRL: number; // GMV por vídeo (R$)
  likes: number; // Total de curtidas (diggCount da API Echotik; API não fornece views para influencers)
  debutDate: string; // Data de estreia do criador
  sourceUrl: string; // Link da fonte de dados
  tiktokUrl: string; // Link do TikTok
  dateRange: string; // Intervalo de datas
  avatarUrl?: string; // Avatar URL
  ecScore?: number; // E-commerce score
  category?: string; // Categoria principal
}

// ============================================
// Dashboard aggregate DTOs
// ============================================
export interface DashboardKPIs {
  totalVideos: number;
  totalProducts: number;
  newProducts: number;
  activeCreators: number;
  totalRevenueBRL: number;
  avgRoas: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  topVideos: VideoDTO[];
  topProducts: ProductDTO[];
  newProducts: ProductDTO[];
  topCreators: CreatorDTO[];
}

// ============================================
// User feature types
// ============================================
export interface SavedItemDTO {
  id: string;
  type: "video" | "product";
  externalId: string;
  title: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface CollectionDTO {
  id: string;
  name: string;
  itemCount: number;
  createdAt: string;
}

export interface NoteDTO {
  id: string;
  type: "video" | "product" | "creator";
  externalId: string;
  content: string;
  createdAt: string;
}

export interface AlertDTO {
  id: string;
  title: string;
  description?: string;
  severity: "info" | "warning" | "success";
  type: string;
  payload?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

// ============================================
// API Response types
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
