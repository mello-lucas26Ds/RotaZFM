import { NextRequest, NextResponse } from 'next/server';
import { normalizedSources } from '@rotazfm/api';
import { authorizeDashboardApi, jsonError } from '@/lib/api-utils';
import { buildEmbeddedDecisionInput } from '@/lib/embedded-decision';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const unauthorized = authorizeDashboardApi(request);
  if (unauthorized) return unauthorized;

  try {
    return NextResponse.json({ fontes: normalizedSources(buildEmbeddedDecisionInput()) });
  } catch {
    return jsonError(500, 'INTERNAL_ERROR', 'Erro interno');
  }
}
