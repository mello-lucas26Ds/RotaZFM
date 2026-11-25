import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ContractValidationError } from '@rotazfm/contracts';
import { DomainError } from '@rotazfm/domain';

function fingerprint(value: string) {
  return createHash('sha256').update(value).digest();
}

function matchesSecret(provided: string, expected: string) {
  return timingSafeEqual(fingerprint(provided), fingerprint(expected));
}

function configuredTokens() {
  return [
    process.env.DASHBOARD_AUTH_TOKEN,
    ...(process.env.IAV_MCP_API_KEYS ?? '').split(','),
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

export function authorizeDashboardApi(request: NextRequest) {
  const tokens = configuredTokens();
  if (tokens.length === 0) return null;

  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization')?.trim() ?? '');
  const provided = match?.[1]?.trim();
  if (provided && tokens.some((token) => matchesSecret(provided, token))) return null;

  return NextResponse.json(
    { error: { code: 'DASHBOARD_UNAUTHORIZED', message: 'Token do dashboard ausente ou inválido' } },
    { status: 401, headers: { 'www-authenticate': 'Bearer' } },
  );
}

export function jsonError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status },
  );
}

export function mapDecisionError(error: unknown) {
  if (error instanceof ContractValidationError) {
    return jsonError(400, 'INVALID_QUERY', error.message, error.errors);
  }
  if (error instanceof DomainError && error.code === 'ROUTE_NOT_FOUND') {
    return jsonError(404, 'ROUTE_NOT_FOUND', error.message);
  }
  if (error instanceof DomainError) {
    return jsonError(503, 'DECISION_UNAVAILABLE', 'DecisionSnapshot indisponível');
  }
  return jsonError(500, 'INTERNAL_ERROR', 'Erro interno');
}
