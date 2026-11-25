'use client';

import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { ArcLayer } from '@deck.gl/layers';

type HeatPoint = {
  position: [number, number];
  weight: number;
};

const HEAT_POINTS: HeatPoint[] = [
  { position: [-60.02, -3.1], weight: 95 },
  { position: [-58.9, -3.3], weight: 72 },
  { position: [-62.2, -4.7], weight: 82 },
  { position: [-63.9, -8.76], weight: 88 },
  { position: [-60.7, -10.9], weight: 44 },
  { position: [-56.1, -15.6], weight: 34 },
  { position: [-48.5, -1.45], weight: 78 },
  { position: [-49.1, -5.5], weight: 62 },
  { position: [-47.5, -8.0], weight: 52 },
  { position: [-46.63, -23.55], weight: 92 },
];

const HEAT_LABELS: Array<[string, number, number]> = [
  ['Manaus', 252, 78],
  ['Porto Velho', 330, 142],
  ['Belém', 612, 76],
  ['São Paulo', 530, 232],
];

const ARCS = [
  { source: [-60.02, -3.1], target: [-48.5, -1.45], color: [56, 189, 248] },
  { source: [-60.02, -3.1], target: [-63.9, -8.76], color: [249, 115, 22] },
  { source: [-63.9, -8.76], target: [-46.63, -23.55], color: [56, 189, 248] },
  { source: [-48.5, -1.45], target: [-46.63, -23.55], color: [2, 132, 199] },
];

export default function LogisticsHeatmap() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    maplibregl.setWorkerUrl('/maplibre-gl-worker.js');
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#08111e' },
          },
        ],
      },
      center: [-55.5, -10.5],
      zoom: 3.35,
      attributionControl: false,
      interactive: false,
      fadeDuration: 0,
    });

    const overlay = new MapboxOverlay({
      interleaved: false,
      layers: [
        new HeatmapLayer<HeatPoint>({
          id: 'logistics-heat',
          data: HEAT_POINTS,
          getPosition: (point) => point.position,
          getWeight: (point) => point.weight,
          radiusPixels: 58,
          intensity: 1.55,
          threshold: 0.05,
          colorRange: [
            [56, 189, 248, 24],
            [2, 132, 199, 92],
            [245, 158, 11, 150],
            [249, 115, 22, 205],
            [239, 68, 68, 225],
          ],
        }),
        new ArcLayer({
          id: 'logistics-arcs',
          data: ARCS,
          getSourcePosition: (arc) => arc.source as [number, number],
          getTargetPosition: (arc) => arc.target as [number, number],
          getSourceColor: (arc) => [...arc.color, 180] as [number, number, number, number],
          getTargetColor: (arc) => [...arc.color, 210] as [number, number, number, number],
          getWidth: 2.4,
          widthUnits: 'pixels',
          greatCircle: true,
        }),
      ],
    });

    map.addControl(overlay);
    return () => {
      map.removeControl(overlay);
      map.remove();
    };
  }, []);

  return (
    <div className="relative h-[340px] overflow-hidden rounded-2xl border border-cyan-300/10 bg-[#08111e]">
      <div ref={containerRef} className="absolute inset-0" aria-label="Heatmap analítico da pressão logística" />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="heat-fire"><stop offset="0%" stopColor="#ef4444" stopOpacity="0.72"/><stop offset="45%" stopColor="#f97316" stopOpacity="0.34"/><stop offset="100%" stopColor="#f97316" stopOpacity="0"/></radialGradient>
          <radialGradient id="heat-cyan"><stop offset="0%" stopColor="#38bdf8" stopOpacity="0.58"/><stop offset="55%" stopColor="#0284c7" stopOpacity="0.22"/><stop offset="100%" stopColor="#0284c7" stopOpacity="0"/></radialGradient>
          <linearGradient id="arc-cyan" x1="0" x2="1"><stop stopColor="#38bdf8"/><stop offset="1" stopColor="#67e8f9"/></linearGradient>
        </defs>
        <g stroke="#38bdf8" strokeOpacity="0.07" strokeWidth="1">{Array.from({ length: 15 }, (_, i) => <line key={`v${i}`} x1={i * 55} y1="0" x2={i * 55} y2="300" />)}{Array.from({ length: 7 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * 48} x2="800" y2={i * 48} />)}</g>
        <ellipse cx="250" cy="86" rx="150" ry="82" fill="url(#heat-cyan)"/>
        <ellipse cx="356" cy="132" rx="170" ry="98" fill="url(#heat-fire)"/>
        <ellipse cx="530" cy="230" rx="160" ry="82" fill="url(#heat-cyan)"/>
        <ellipse cx="612" cy="78" rx="130" ry="74" fill="url(#heat-cyan)"/>
        <path d="M252 78 C330 18 500 24 610 74" fill="none" stroke="url(#arc-cyan)" strokeWidth="4" strokeLinecap="round" opacity="0.95"/>
        <path d="M252 78 C240 128 290 174 530 232" fill="none" stroke="#f97316" strokeWidth="3" strokeDasharray="7 8" strokeLinecap="round" opacity="0.9"/>
        <path d="M612 76 C650 138 620 188 532 232" fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" opacity="0.72"/>
        {HEAT_LABELS.map(([label, x, y]) => <g key={label}><circle cx={x} cy={y} r="6" fill="#38bdf8" stroke="#cffafe" strokeWidth="2"/><text x={x + 12} y={y - 8} fill="#e2e8f0" fontSize="15" fontWeight="700">{label}</text></g>)}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#08111e]/70 to-transparent" />
      <div className="absolute bottom-3 left-3 rounded-full border border-orange-400/30 bg-slate-950/75 px-3 py-1.5 text-[11px] font-medium text-orange-200 backdrop-blur">
        Pico operacional: BR-319 / estiagem amazônica
      </div>
    </div>
  );
}
