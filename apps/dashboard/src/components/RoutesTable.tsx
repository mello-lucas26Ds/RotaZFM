import type { DecisionSnapshot } from '@/lib/types';
import { formatKm, formatScore, routeShortName, statusLabel, statusTone } from '@/lib/dashboard-utils';

function badgeClass(status?: string) {
  const tone = statusTone(status);
  if (tone === 'success') return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200';
  if (tone === 'warning') return 'border-amber-400/25 bg-amber-400/10 text-amber-200';
  if (tone === 'danger') return 'border-red-400/25 bg-red-400/10 text-red-200';
  return 'border-slate-500/25 bg-slate-500/10 text-slate-300';
}

export default function RoutesTable({ snapshot }: { snapshot: DecisionSnapshot | null }) {
  const routes = snapshot?.routes ?? [];
  return (
    <section className="bento-card p-4 xl:col-span-4" aria-labelledby="routes-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="routes-title" className="card-title">Rotas avaliadas</h2>
          <p className="metadata mt-1">Progresso representa cobertura de dimensões, não viabilidade inventada.</p>
        </div>
        <span className="metadata number">{routes.length} rotas</span>
      </div>

      <div className="mt-4 overflow-x-auto no-scrollbar">
        <table className="w-full min-w-[390px] border-separate border-spacing-y-2 text-left text-xs">
          <thead className="metadata uppercase tracking-[0.12em]">
            <tr>
              <th className="px-2 py-1 font-medium">Corredor</th>
              <th className="px-2 py-1 font-medium">IAV</th>
              <th className="px-2 py-1 font-medium">Cobertura</th>
              <th className="px-2 py-1 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => {
              const dimensions = route.segments.flatMap((segment) => Object.values(segment.dimensions));
              const applicable = dimensions.filter((dimension) => dimension.status !== 'NAO_APLICAVEL');
              const scored = applicable.filter((dimension) => Number.isFinite(dimension.score)).length;
              const coverage = applicable.length ? Math.round((scored / applicable.length) * 100) : 0;
              return (
                <tr key={route.route_id} className="bg-slate-950/30">
                  <td className="rounded-l-xl px-2 py-3">
                    <div className="font-semibold text-slate-100">{routeShortName(route)}</div>
                    <div className="metadata mt-1">{formatKm(route.approx_distance_km)} · pior trecho {route.worst_segment_id ?? '—'}</div>
                  </td>
                  <td className="px-2 py-3">
                    <span className="font-display text-xl font-bold text-slate-50 number">{formatScore(route.iav)}</span>
                  </td>
                  <td className="px-2 py-3">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-300" style={{ width: `${Math.max(6, coverage)}%` }} />
                    </div>
                    <div className="metadata mt-1 number">{coverage}% · {scored}/{applicable.length}</div>
                  </td>
                  <td className="rounded-r-xl px-2 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${badgeClass(route.status)}`}>
                      {statusLabel(route.status)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {routes.length === 0 && (
              <tr>
                <td colSpan={4} className="rounded-xl bg-slate-950/30 px-3 py-8 text-center text-sm text-slate-400">
                  Consulte a viabilidade para carregar as rotas reais do motor IAV.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {snapshot?.scope_warning && (
        <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/8 p-3 text-[11px] leading-5 text-amber-100/85">
          {snapshot.scope_warning}
        </div>
      )}
    </section>
  );
}
