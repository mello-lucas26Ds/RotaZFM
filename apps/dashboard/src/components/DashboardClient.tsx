'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Flame, KeyRound, RefreshCw, Search } from 'lucide-react';
import Sidebar from './Sidebar';
import KpiCards from './KpiCards';
import { DimensionPanel, EvolutionPanel } from './AnalyticsPanels';
import MapCard from './MapCard';
import RoutesTable from './RoutesTable';
import NewsRadar from './NewsRadar';
import type { DecisionSnapshot, NewsItem, SourceStatus } from '@/lib/types';
import { hasLiveData, isPartial } from '@/lib/dashboard-utils';

function manausDate(offsetDays: number) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Manaus', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

export default function DashboardClient() {
  const [snapshot, setSnapshot] = useState<DecisionSnapshot | null>(null);
  const [fontes, setFontes] = useState<SourceStatus[]>([]);
  const [noticias, setNoticias] = useState<NewsItem[]>([]);
  const [token, setToken] = useState('');
  const [tokenDraft, setTokenDraft] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shippingDate, setShippingDate] = useState(() => manausDate(1));
  const [weight, setWeight] = useState('10000');
  const [loadType, setLoadType] = useState('SECA');

  const headers = useCallback((extra: HeadersInit = {}) => ({
    ...extra,
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const query = {
      origem: 'MANAUS',
      destino: 'SAO_PAULO',
      data_embarque: shippingDate,
      carga: {
        tipo: loadType,
        peso_bruto_total_kg: Number(weight),
        quantidade_caminhoes: 1,
      },
    };

    try {
      const [viabilityResponse, sourcesResponse, newsResponse] = await Promise.all([
        fetch('/api/v1/viabilidade', {
          method: 'POST',
          headers: headers({ 'content-type': 'application/json' }),
          body: JSON.stringify(query),
          cache: 'no-store',
        }),
        fetch('/api/v1/fontes', { headers: headers(), cache: 'no-store' }),
        fetch('/api/v1/noticias', { headers: headers(), cache: 'no-store' }),
      ]);
      const [viabilityBody, sourcesBody, newsBody] = await Promise.all([
        readJson(viabilityResponse),
        readJson(sourcesResponse),
        readJson(newsResponse),
      ]);

      if (viabilityResponse.status === 401 || sourcesResponse.status === 401 || newsResponse.status === 401) {
        setAuthRequired(true);
        setSnapshot(null);
        setError('Informe o token do dashboard para consultar o motor IAV.');
        return;
      }
      if (!viabilityResponse.ok) {
        throw new Error(viabilityBody?.error?.message ?? 'Não foi possível consultar a viabilidade.');
      }
      if (!sourcesResponse.ok || !newsResponse.ok) {
        throw new Error('Viabilidade carregada, mas fontes/notícias ficaram indisponíveis.');
      }

      setAuthRequired(false);
      setSnapshot(viabilityBody);
      setFontes(sourcesBody?.fontes ?? []);
      setNoticias(newsBody?.noticias ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro inesperado ao carregar o command center.');
    } finally {
      setLoading(false);
    }
  }, [headers, loadType, shippingDate, weight]);

  useEffect(() => {
    void load();
  }, [load]);

  const live = useMemo(() => hasLiveData(snapshot), [snapshot]);
  const partial = useMemo(() => isPartial(snapshot), [snapshot]);

  function submitToken(event: React.FormEvent) {
    event.preventDefault();
    const clean = tokenDraft.trim();
    if (!clean) return;
    setToken(clean);
    setTokenDraft('');
  }

  return (
    <div id="command-center" className="min-h-screen bg-canvas">
      <Sidebar fontes={fontes} live={live} partial={partial} />
      <main className="min-h-screen px-4 py-5 sm:px-5 lg:ml-60 lg:px-6">
        <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-300">
              <Flame aria-hidden className="h-3.5 w-3.5" />
              Operação ZFM · Command Center
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">Antecipação de viabilidade Manaus → Brasil</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              IAV explicável com evidências públicas, frescor declarado, bloqueios PBTC e estados de fallback sem score inventado.
            </p>
          </div>

          <form className="bento-card grid gap-3 p-3 sm:grid-cols-[140px_130px_120px_auto]" onSubmit={(event) => { event.preventDefault(); void load(); }} aria-label="Consultar viabilidade">
            <label className="text-xs text-slate-400">
              Embarque
              <input className="mt-1 w-full rounded-xl border border-cyan-300/10 bg-slate-950/55 px-3 py-2 text-sm text-slate-100" type="date" value={shippingDate} onChange={(event) => setShippingDate(event.target.value)} />
            </label>
            <label className="text-xs text-slate-400">
              Peso kg
              <input className="mt-1 w-full rounded-xl border border-cyan-300/10 bg-slate-950/55 px-3 py-2 text-sm text-slate-100 number" inputMode="numeric" value={weight} onChange={(event) => setWeight(event.target.value.replace(/\D/g, '').slice(0, 5))} />
            </label>
            <label className="text-xs text-slate-400">
              Carga
              <select className="mt-1 w-full rounded-xl border border-cyan-300/10 bg-slate-950/55 px-3 py-2 text-sm text-slate-100" value={loadType} onChange={(event) => setLoadType(event.target.value)}>
                <option value="SECA">Seca</option>
                <option value="CONTEINERIZADA">Contêiner</option>
              </select>
            </label>
            <button type="submit" className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60" disabled={loading}>
              {loading ? <RefreshCw aria-hidden className="h-4 w-4 animate-spin" /> : <Search aria-hidden className="h-4 w-4" />}
              Consultar
            </button>
          </form>
        </header>

        {(authRequired || error) && (
          <div className="bento-card-alert mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" role="status">
            <div>
              <div className="text-sm font-semibold text-orange-100">{authRequired ? 'Token necessário' : 'Falha de carregamento'}</div>
              <div className="mt-1 text-xs text-orange-100/70">{error ?? 'A página é pública; as chamadas de API exigem DASHBOARD_AUTH_TOKEN.'}</div>
            </div>
            {authRequired && (
              <form className="flex gap-2" onSubmit={submitToken}>
                <label className="sr-only" htmlFor="dashboard-token">Token do dashboard</label>
                <input id="dashboard-token" type="password" value={tokenDraft} onChange={(event) => setTokenDraft(event.target.value)} placeholder="DASHBOARD_AUTH_TOKEN" className="w-56 rounded-xl border border-orange-300/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
                <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-slate-950">
                  <KeyRound aria-hidden className="h-4 w-4" /> Entrar
                </button>
              </form>
            )}
          </div>
        )}

        <KpiCards snapshot={snapshot} fontes={fontes} />
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <EvolutionPanel snapshot={snapshot} />
          <DimensionPanel snapshot={snapshot} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <MapCard />
          <RoutesTable snapshot={snapshot} />
          <NewsRadar noticias={noticias} />
        </div>

        <footer className="metadata mt-5 flex flex-col gap-2 border-t border-cyan-300/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span>RotaZFM · decisão física/regulatória, não cotação de custo.</span>
          <span>rule_version {snapshot?.rule_version ?? '—'} · catálogo {snapshot?.catalog_version ?? '—'}</span>
        </footer>
      </main>
    </div>
  );
}
