import { ExternalLink, Radio } from 'lucide-react';
import type { NewsItem } from '@/lib/types';
import { formatDateTime, statusLabel } from '@/lib/dashboard-utils';

function semanticTags(item: NewsItem) {
  const tags = [statusLabel(item.confirmation_status)];
  if (item.route_id?.includes('br-319')) tags.push('BR-319');
  if (item.route_id?.includes('fluvial')) tags.push('Fluvial');
  if (item.evidence_role?.includes('official')) tags.push('oficial');
  if ((item.freshness_hours ?? 0) > 24) tags.push('stale >24h');
  return [...new Set(tags)].slice(0, 4);
}

export default function NewsRadar({ noticias }: { noticias: NewsItem[] }) {
  return (
    <section id="radar-noticias" className="bento-card p-4 xl:col-span-4" aria-labelledby="news-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="news-title" className="card-title flex items-center gap-2">
            <Radio aria-hidden className="h-4 w-4 text-cyan-300" />
            Radar de notícias
          </h2>
          <p className="metadata mt-1">Contexto semântico; notícia não confirmada nunca vira bloqueio.</p>
        </div>
        <span className="metadata number">{noticias.length} itens</span>
      </div>

      <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
        {noticias.map((item) => (
          <article key={item.evidence_id} className="rounded-2xl border border-cyan-300/10 bg-slate-950/28 p-3 transition hover:border-cyan-300/25">
            <div className="flex flex-wrap gap-1.5">
              {semanticTags(item).map((tag) => (
                <span key={tag} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tag.includes('stale') || tag.includes('Não') || tag.includes('Expirado') ? 'border-orange-400/25 bg-orange-400/10 text-orange-200' : 'border-cyan-300/15 bg-cyan-400/8 text-cyan-100'}`}>
                  {tag}
                </span>
              ))}
            </div>
            <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-slate-100">{item.title}</h3>
            <p className="mt-1 truncate text-xs text-slate-400">{item.relevance ?? 'Sem resumo contextual disponível.'}</p>
            <div className="metadata mt-2 flex items-center justify-between gap-3">
              <span className="truncate">{item.source ?? 'fonte não informada'} · {formatDateTime(item.published_at ?? item.collected_at)}</span>
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-cyan-300 hover:text-cyan-100" aria-label={`Abrir fonte da notícia ${item.title}`}>
                  fonte <ExternalLink aria-hidden className="h-3 w-3" />
                </a>
              )}
            </div>
          </article>
        ))}
        {noticias.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
            Nenhuma notícia contextual carregada.
          </div>
        )}
      </div>
    </section>
  );
}
