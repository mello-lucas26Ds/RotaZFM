'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Database, Gauge, Ship, Timer, Truck } from 'lucide-react';
import type { DecisionSnapshot, SourceStatus } from '@/lib/types';
import { criticalAlertCount, formatHours, formatScore, freshnessHours, routeShortName, sourceSummary } from '@/lib/dashboard-utils';

function KpiCard({ icon, label, value, detail, alert = false, index }: { icon: React.ReactNode; label: string; value: string; detail: string; alert?: boolean; index: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      className={`${alert ? 'bento-card-alert' : 'bento-card'} flex h-[116px] flex-col justify-between p-4`}
      aria-label={label}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="metadata uppercase tracking-[0.14em]">{label}</div>
        <div className={`rounded-xl border p-2 ${alert ? 'border-orange-400/30 bg-orange-500/10 text-orange-300' : 'border-cyan-300/15 bg-cyan-400/8 text-cyan-300'}`}>{icon}</div>
      </div>
      <div>
        <div className="kpi-number text-slate-50">{value}</div>
        <div className="metadata mt-2 truncate">{detail}</div>
      </div>
    </motion.section>
  );
}

export default function KpiCards({ snapshot, fontes }: { snapshot: DecisionSnapshot | null; fontes: SourceStatus[] }) {
  const br319 = snapshot?.routes.find((route) => route.route_id.includes('br-319'));
  const fluvial = snapshot?.routes.find((route) => !route.route_id.includes('br-319'));
  const sources = sourceSummary(fontes);
  const cards = [
    {
      icon: <Ship aria-hidden className="h-4 w-4" />,
      label: 'IAV Manaus–Belém',
      value: formatScore(fluvial?.iav),
      detail: fluvial ? `${routeShortName(fluvial)} · ${fluvial.status}` : 'aguardando consulta',
      alert: fluvial?.status === 'NAO_VIAVEL',
    },
    {
      icon: <Truck aria-hidden className="h-4 w-4" />,
      label: 'IAV BR-319 + SP',
      value: formatScore(br319?.iav),
      detail: br319 ? `${routeShortName(br319)} · ${br319.status}` : 'aguardando consulta',
      alert: br319?.status === 'NAO_VIAVEL' || br319?.status === 'NAO_AVALIAVEL',
    },
    {
      icon: <Timer aria-hidden className="h-4 w-4" />,
      label: 'Tempo médio',
      value: '—',
      detail: 'sem telemetria confirmada no modelo',
    },
    {
      icon: <AlertTriangle aria-hidden className="h-4 w-4" />,
      label: 'Alertas críticos',
      value: String(criticalAlertCount(snapshot)),
      detail: 'bloqueios duros + trechos críticos sem avaliação',
      alert: criticalAlertCount(snapshot) > 0,
    },
    {
      icon: <Database aria-hidden className="h-4 w-4" />,
      label: 'Fontes',
      value: `${sources.confirmed}/${sources.total || '—'}`,
      detail: `menor frescor ${formatHours(freshnessHours(snapshot))}`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card, index) => <KpiCard key={card.label} {...card} index={index} />)}
    </div>
  );
}
