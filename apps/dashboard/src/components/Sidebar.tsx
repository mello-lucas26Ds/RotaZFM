import { Activity, Flame, Gauge, Map, Newspaper, RadioTower, Route, ShieldCheck } from 'lucide-react';
import type { SourceStatus } from '@/lib/types';
import { sourceSummary } from '@/lib/dashboard-utils';

const NAV = [
  { label: 'Command Center', icon: Gauge, active: true },
  { label: 'Rotas', icon: Route },
  { label: 'Mapa operacional', icon: Map },
  { label: 'Radar de notícias', icon: Newspaper },
  { label: 'Fontes', icon: RadioTower },
];

export default function Sidebar({ fontes, live, partial }: { fontes: SourceStatus[]; live: boolean; partial: boolean }) {
  const sources = sourceSummary(fontes);
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-cyan-300/10 bg-[#08101c]/95 px-4 py-5 backdrop-blur lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-1">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-400/30 bg-orange-500/10">
          <Flame aria-hidden className="h-5 w-5 text-orange-400" />
        </div>
        <div>
          <div className="font-display text-lg font-bold tracking-tight text-slate-50">RotaZFM</div>
          <div className="metadata uppercase tracking-[0.18em]">Os Boitatá</div>
        </div>
      </div>

      <nav className="mt-8 space-y-1" aria-label="Navegação principal">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.label}
              href="#command-center"
              aria-current={item.active ? 'page' : undefined}
              className={`group flex items-center gap-3 rounded-xl border-l-2 px-3 py-2.5 text-sm transition ${
                item.active
                  ? 'border-cyan-400 bg-gradient-to-r from-cyan-400/15 to-transparent text-cyan-100'
                  : 'border-transparent text-slate-400 hover:bg-white/[0.035] hover:text-slate-100'
              }`}
            >
              <Icon aria-hidden className={`h-4 w-4 ${item.active ? 'text-cyan-300' : 'text-slate-500 group-hover:text-cyan-200'}`} />
              {item.label}
            </a>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-cyan-300/10 bg-slate-950/40 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          <ShieldCheck aria-hidden className="h-4 w-4 text-emerald-400" />
          Status operacional
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className={`relative flex h-2.5 w-2.5 ${live ? 'text-emerald-400' : 'text-amber-400'}`}>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-30" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
          </span>
          <span className="text-sm font-semibold text-slate-100">{live ? 'AO VIVO' : partial ? 'IAV PARCIAL' : 'AGUARDANDO'}</span>
        </div>
        <div className="metadata mt-3">
          {sources.confirmed}/{sources.total || '—'} fontes confirmadas · evidências com fonte, data e frescor
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
          <Activity aria-hidden className="h-3.5 w-3.5 text-cyan-300" />
          Motor determinístico v2026-11-23
        </div>
      </div>
    </aside>
  );
}
