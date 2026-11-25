'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Flame, Map as MapIcon } from 'lucide-react';

const CorredorMap3D = dynamic(() => import('./CorredorMap3D'), {
  ssr: false,
  loading: () => <div className="flex h-[310px] items-center justify-center rounded-2xl bg-[#08111e] text-sm text-slate-500">Carregando corredor 3D…</div>,
});

const LogisticsHeatmap = dynamic(() => import('./LogisticsHeatmap'), {
  ssr: false,
  loading: () => <div className="flex h-[310px] items-center justify-center rounded-2xl bg-[#08111e] text-sm text-slate-500">Carregando heatmap…</div>,
});

export default function MapCard() {
  const [mode, setMode] = useState<'3d' | 'heat'>('3d');
  return (
    <section className="bento-card p-4 xl:col-span-4" aria-labelledby="map-title">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id="map-title" className="card-title">Corredor Amazônico</h2>
          <p className="metadata mt-1">Manaus como hub pulsante; rotas ZFM em ciano e comparativo Panamá em fogo.</p>
        </div>
        <div className="flex rounded-full border border-cyan-300/10 bg-slate-950/50 p-1" role="group" aria-label="Alternar visualização do mapa">
          <button
            type="button"
            onClick={() => setMode('3d')}
            aria-pressed={mode === '3d'}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${mode === '3d' ? 'bg-cyan-400/15 text-cyan-100' : 'text-slate-500 hover:text-slate-200'}`}
          >
            <MapIcon aria-hidden className="h-3.5 w-3.5" /> 3D
          </button>
          <button
            type="button"
            onClick={() => setMode('heat')}
            aria-pressed={mode === 'heat'}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${mode === 'heat' ? 'bg-orange-400/15 text-orange-100' : 'text-slate-500 hover:text-slate-200'}`}
          >
            <Flame aria-hidden className="h-3.5 w-3.5" /> heatmap
          </button>
        </div>
      </div>
      {mode === '3d' ? <CorredorMap3D /> : <LogisticsHeatmap />}
    </section>
  );
}
