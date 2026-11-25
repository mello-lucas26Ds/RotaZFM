import { NextRequest, NextResponse } from 'next/server';
import { assertIavQuery } from '@rotazfm/contracts';
import { consultarViabilidade } from '@rotazfm/api';
import { authorizeDashboardApi, jsonError, mapDecisionError } from '@/lib/api-utils';
import { buildEmbeddedDecisionInput } from '@/lib/embedded-decision';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const unauthorized = authorizeDashboardApi(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => null);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return jsonError(400, 'INVALID_JSON', 'Corpo da requisição não é JSON válido');
    }
    const query = assertIavQuery(body);
    return NextResponse.json(
      consultarViabilidade(query, {
        buildInput: (options) => buildEmbeddedDecisionInput((options as { query?: unknown } | undefined)?.query),
      }),
    );
  } catch (error) {
    return mapDecisionError(error);
  }
}
