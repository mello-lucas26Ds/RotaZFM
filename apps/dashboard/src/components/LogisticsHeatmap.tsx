'use client';

import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
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
      interleaved: true,
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#08111e] to-transparent" />
      <div className="absolute bottom-3 left-3 rounded-full border border-orange-400/30 bg-slate-950/75 px-3 py-1.5 text-[11px] font-medium text-orange-200 backdrop-blur">
        Pico operacional: BR-319 / estiagem amazônica
      </div>
    </div>
  );
}
