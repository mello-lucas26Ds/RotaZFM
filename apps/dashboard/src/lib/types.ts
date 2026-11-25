export type DimensionKey = 'nivel' | 'chuva' | 'trafego' | 'qualidade' | 'restricao';

export type RouteStatus = 'VIAVEL' | 'VIAVEL_COM_RESSALVAS' | 'NAO_VIAVEL' | 'NAO_AVALIAVEL' | 'NAO_APLICAVEL';

export interface DimensionAssessment {
  dimension: DimensionKey;
  weight: number;
  score: number | null;
  weighted_score: number | null;
  status: RouteStatus | 'NAO_APLICAVEL';
  reason?: string;
  source?: string;
  freshness_hours?: number;
}

export interface Evidence {
  route_id?: string;
  segment_id?: string;
  dimension?: DimensionKey;
  source?: string;
  source_url?: string;
  evidence_id?: string;
  confirmation_status?: string;
  freshness_hours?: number;
  collected_at?: string;
  published_at?: string;
  method?: string;
  value?: Record<string, unknown> | null;
}

export interface SegmentAssessment {
  segment_id: string;
  name: string;
  from: string;
  to: string;
  road: string | null;
  mode: string;
  critical: boolean;
  status: RouteStatus;
  iav: number | null;
  dimensions: Partial<Record<DimensionKey, DimensionAssessment>>;
  blockers?: Array<Record<string, unknown>>;
  missing_data?: Array<Record<string, unknown>>;
  evidences?: Evidence[];
}

export interface RouteAssessment {
  route_id: string;
  name: string;
  mode: string;
  origin: string;
  destination: string;
  approx_distance_km: number;
  status: RouteStatus;
  iav: number | null;
  worst_segment_id?: string;
  segments: SegmentAssessment[];
}

export interface DecisionSnapshot {
  rule_version: string;
  catalog_version: string;
  query: {
    origem: string;
    destino: string;
    data_embarque: string;
    carga: {
      tipo: string;
      peso_bruto_total_kg: number;
      quantidade_caminhoes: number;
    };
  };
  routes: RouteAssessment[];
  missing_data: Array<Record<string, unknown>>;
  blockers: Array<Record<string, unknown>>;
  evidences: Evidence[];
  related_news: NewsItem[];
  scope_warning?: string;
}

export interface SourceStatus {
  source: string;
  source_url?: string | null;
  status: string;
  last_collected_at: string | null;
  evidence_count: number;
  confirmation_status_counts?: Record<string, number>;
}

export interface NewsItem {
  evidence_id: string;
  title: string;
  url?: string;
  source?: string;
  source_url?: string;
  published_at?: string;
  collected_at?: string;
  updated_at?: string | null;
  confirmation_status?: string;
  blocker?: boolean;
  route_id?: string;
  segment_id?: string;
  relevance?: string;
  evidence_role?: string;
  freshness_hours?: number;
}

export interface DashboardData {
  snapshot: DecisionSnapshot;
  fontes: SourceStatus[];
  noticias: NewsItem[];
}
