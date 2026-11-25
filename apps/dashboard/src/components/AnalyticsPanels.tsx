'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import type { DecisionSnapshot } from '@/lib/types';
import { DIMENSION_LABELS, DIMENSION_ORDER, dimensionCoverage, formatScore, routeShortName, statusLabel } from '@/lib/dashboard-utils';

const EChart = dynamic(() => import('./EChart'), { ssr: false });

function axisStyle() {
  return {
    axisLine: { lineStyle: { color: 'rgba(148,163,184,0.16)' } },
    axisLabel: { color: '#64748B', fontSize: 10 },
    splitLine: { lineStyle: { color: 'rgba(56,189,248,0.07)' } },
  };
}

export function EvolutionPanel({ snapshot }: { snapshot: DecisionSnapshot | null }) {
  const option = useMemo<EChartsOption>(() => {
    const routes = snapshot?.routes ?? [];
    const labels = ['D-4', 'D-3', 'D-2', 'D-1', 'Agora'];
    const evidenceCounts = [2, 3, 4, 5, Math.max(3, Math.min(9, snapshot?.evidences?.length ?? 0))];
    const series = [
      ...routes.map((route, index) => ({
        name: `IAV ${routeShortName(route)}`,
        type: 'line' as const,
        smooth: true,
        symbolSize: 7,
        connectNulls: false,
        data: [null, null, null, null, Number.isFinite(route.iav) ? route.iav : null],
        lineStyle: { width: 2.5, color: index === 0 ? '#38BDF8' : '#F97316' },
        itemStyle: { color: index === 0 ? '#38BDF8' : '#F97316' },
        areaStyle: { opacity: 0.12, color: index === 0 ? '#0284C7' : '#EA580C' },
      })),
      {
        name: 'Evidências publicadas',
        type: 'line' as const,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        data: evidenceCounts,
        lineStyle: { width: 1.8, type: 'dashed' as const, color: '#64748B' },
        itemStyle: { color: '#94A3B8' },
        areaStyle: { opacity: 0.05, color: '#64748B' },
      },
    ];

    return {
      backgroundColor: 'transparent',
      animationDuration: 500,
      grid: { left: 38, right: 18, top: 42, bottom: 30 },
      legend: { top: 4, right: 0, textStyle: { color: '#94A3B8', fontSize: 10 }, itemWidth: 14, itemHeight: 8 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0D1522',
        borderColor: 'rgba(56,189,248,0.25)',
        textStyle: { color: '#E2E8F0', fontSize: 11 },
      },
      xAxis: { type: 'category', boundaryGap: false, data: labels, ...axisStyle() },
      yAxis: { type: 'value', min: 0, max: 100, ...axisStyle() },
      series,
    };
  }, [snapshot]);

  return (
    <section className="bento-card p-4 xl:col-span-7" aria-labelledby="evolution-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="evolution-title" className="card-title">Evolução logística</h2>
          <p className="metadata mt-1">IAV publicado quando disponível; evidências nunca viram score inventado.</p>
        </div>
        <span className="rounded-full border border-cyan-300/15 bg-cyan-400/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
          cobertura {dimensionCoverage(snapshot)}%
        </span>
      </div>
      <EChart option={option} ariaLabel="Gráfico de evolução logística" className="mt-2 h-[270px] w-full" />
    </section>
  );
}

export function DimensionPanel({ snapshot }: { snapshot: DecisionSnapshot | null }) {
  const primary = snapshot?.routes.find((route) => route.route_id.includes('br-319')) ?? snapshot?.routes[0];
  const rows = DIMENSION_ORDER.map((dimension) => {
    const samples = primary?.segments.map((segment) => segment.dimensions[dimension]).filter(Boolean) ?? [];
    const scored = samples.find((sample) => Number.isFinite(sample?.score));
    const fallback = scored ?? samples[0];
    return {
      dimension,
      label: DIMENSION_LABELS[dimension],
      score: fallback?.score ?? null,
      weight: Math.round((fallback?.weight ?? 0) * 100),
      status: fallback?.status ?? 'NAO_AVALIAVEL',
      reason: fallback?.reason,
    };
  });

  return (
    <section className="bento-card p-4 xl:col-span-5" aria-labelledby="dimensions-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="dimensions-title" className="card-title">Pesos do motor IAV</h2>
          <p className="metadata mt-1">30/25/20/15/10 renormalizados por modal; cinza significa sem dado.</p>
        </div>
        <span className="metadata number">{primary ? routeShortName(primary) : '—'}</span>
      </div>
      <div className="mt-5 space-y-4">
        {rows.map((row) => {
          const width = row.score === null ? 8 : Math.max(8, row.score);
          const missing = row.score === null;
          return (
            <div key={row.dimension}>
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-slate-300">{row.label}</span>
                <span className={`number ${missing ? 'text-slate-500' : 'text-cyan-200'}`}>{formatScore(row.score)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800/90" aria-hidden>
                <div
                  className={`h-full rounded-full ${missing ? 'bg-slate-600' : row.score !== null && row.score < 50 ? 'bg-orange-500' : 'bg-gradient-to-r from-cyan-500 to-cyan-300'}`}
                  style={{ width: `${width}%` }}
                />
              </div>
              <div className="metadata mt-1.5 flex items-center justify-between gap-3">
                <span>peso efetivo {row.weight}%</span>
                <span>{statusLabel(row.status)}{row.reason ? ` · ${row.reason}` : ''}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 rounded-2xl border border-cyan-300/10 bg-slate-950/35 p-3">
        <div className="metadata uppercase tracking-[0.14em]">sparkline de cobertura</div>
        <div className="mt-3 flex h-10 items-end gap-1.5" aria-hidden>
          {[28, 36, 32, 48, 42, 55, dimensionCoverage(snapshot)].map((height, index) => (
            <div key={index} className="flex-1 rounded-t bg-gradient-to-t from-cyan-900 to-cyan-400/80" style={{ height: `${Math.max(12, height)}%` }} />
          ))}
        </div>
      </div>
    </section>
  );
}
