import { NextRequest, NextResponse } from 'next/server';
import { normalizedNews } from '@rotazfm/api';
import { authorizeDashboardApi, jsonError } from '@/lib/api-utils';
import { buildEmbeddedDecisionInput } from '@/lib/embedded-decision';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const unauthorized = authorizeDashboardApi(request);
  if (unauthorized) return unauthorized;

  try {
    return NextResponse.json({
      noticias: normalizedNews(request.nextUrl.searchParams, { input: buildEmbeddedDecisionInput() }),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('inválida')) {
      return jsonError(400, 'INVALID_QUERY', error.message);
    }
    return jsonError(500, 'INTERNAL_ERROR', 'Erro interno');
  }
}
