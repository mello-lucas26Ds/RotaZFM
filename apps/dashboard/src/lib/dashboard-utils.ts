import type { DecisionSnapshot, DimensionAssessment, DimensionKey, RouteAssessment, SourceStatus } from './types';

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  nivel: 'Nível do rio',
  chuva: 'Chuva',
  trafego: 'Tráfego',
  qualidade: 'Qualidade',
  restricao: 'Restrição',
};

export const DIMENSION_ORDER: DimensionKey[] = ['nivel', 'chuva', 'trafego', 'qualidade', 'restricao'];

export function formatScore(value: number | null | undefined) {
  return Number.isFinite(value) ? String(Math.round(value as number)) : '—';
}

export function formatKm(value: number | null | undefined) {
  return Number.isFinite(value) ? `${Math.round(value as number).toLocaleString('pt-BR')} km` : '—';
}

export function formatHours(value: number | null | undefined) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value as number)}h`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Manaus',
  }).format(date);
}

export function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    VIAVEL: 'Viável',
    VIAVEL_COM_RESSALVAS: 'Ressalvas',
    NAO_VIAVEL: 'Não viável',
    NAO_AVALIAVEL: 'Não avaliável',
    NAO_APLICAVEL: 'N/A',
    CONFIRMADO: 'Confirmado',
    NAO_CONFIRMADO: 'Não confirmado',
    CONFLITANTE: 'Conflitante',
    INDISPONIVEL: 'Indisponível',
    EXPIRADO: 'Expirado',
  };
  return labels[status ?? ''] ?? status ?? '—';
}

export function statusTone(status?: string) {
  if (status === 'VIAVEL' || status === 'CONFIRMADO') return 'success';
  if (status === 'VIAVEL_COM_RESSALVAS' || status === 'NAO_CONFIRMADO') return 'warning';
  if (status === 'NAO_VIAVEL' || status === 'CONFLITANTE' || status === 'INDISPONIVEL') return 'danger';
  return 'neutral';
}

export function routeShortName(route?: RouteAssessment) {
  if (!route) return '—';
  return route.route_id.includes('br-319') ? 'Manaus–Porto Velho–SP' : 'Manaus–Belém–SP';
}

export function dimensionEntries(route?: RouteAssessment) {
  const entries = new Map<DimensionKey, DimensionAssessment>();
  for (const segment of route?.segments ?? []) {
    for (const key of DIMENSION_ORDER) {
      const dimension = segment.dimensions[key];
      if (!dimension || entries.has(key)) continue;
      entries.set(key, dimension);
    }
  }
  return DIMENSION_ORDER.map((key) => entries.get(key)).filter((value): value is DimensionAssessment => Boolean(value));
}

export function dimensionCoverage(snapshot?: DecisionSnapshot | null) {
  const dimensions = (snapshot?.routes ?? []).flatMap((route) =>
    route.segments.flatMap((segment) => Object.values(segment.dimensions)),
  );
  const applicable = dimensions.filter((dimension) => dimension.status !== 'NAO_APLICAVEL');
  if (applicable.length === 0) return 0;
  return Math.round((applicable.filter((dimension) => Number.isFinite(dimension.score)).length / applicable.length) * 100);
}

export function criticalAlertCount(snapshot?: DecisionSnapshot | null) {
  if (!snapshot) return 0;
  const hardBlockers = snapshot.blockers?.length ?? 0;
  const criticalUnavailable = snapshot.routes.reduce(
    (count, route) => count + route.segments.filter((segment) => segment.critical && segment.status === 'NAO_AVALIAVEL').length,
    0,
  );
  return hardBlockers + criticalUnavailable;
}

export function sourceSummary(fontes: SourceStatus[]) {
  const confirmed = fontes.filter((fonte) => fonte.status === 'CONFIRMADO').length;
  return { confirmed, total: fontes.length };
}

export function freshnessHours(snapshot?: DecisionSnapshot | null) {
  const values = (snapshot?.evidences ?? [])
    .map((evidence) => evidence.freshness_hours)
    .filter((value): value is number => Number.isFinite(value));
  if (values.length === 0) return null;
  return Math.min(...values);
}

export function hasLiveData(snapshot?: DecisionSnapshot | null) {
  return (snapshot?.routes ?? []).some((route) => Number.isFinite(route.iav));
}

export function isPartial(snapshot?: DecisionSnapshot | null) {
  return Boolean(snapshot && (snapshot.missing_data.length > 0 || !hasLiveData(snapshot)));
}

export function deriveSeries(snapshot?: DecisionSnapshot | null) {
  const labels = ['D-4', 'D-3', 'D-2', 'D-1', 'Hoje'];
  const routes = snapshot?.routes ?? [];
  const series = routes.map((route) => {
    const current = Number.isFinite(route.iav) ? route.iav : null;
    const coverage = dimensionCoverage(snapshot);
    const evidenceProxy = current === null ? null : Math.max(0, Math.min(100, current));
    return {
      name: routeShortName(route),
      data: [null, null, null, coverage > 0 ? coverage : null, evidenceProxy],
    };
  });
  return { labels, series };
}
