// src/app/api/scraper/probe/route.ts
import { NextResponse } from 'next/server';
import { requireAdminSecret } from '@/lib/server/adminAuth';
import { oddsAgoraProvider } from '@/lib/providers/oddsAgoraProvider';
import { oddspediaProvider } from '@/lib/providers/oddspediaProvider';
import type { OddsProviderAdapter } from '@/lib/providers/types';

export const dynamic = 'force-dynamic';

const providers: Record<string, OddsProviderAdapter> = {
  oddsagora: oddsAgoraProvider,
  oddspedia: oddspediaProvider,
};

export async function POST(request: Request) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  let body: { provider?: string } = {};
  try {
    body = await request.json();
  } catch {
    // body vazio OK
  }

  const providerName = body.provider;

  // Se nenhum provider especificado, probar todos
  if (!providerName) {
    const results = await Promise.all(
      Object.values(providers).map((p) => p.probeSource())
    );
    return NextResponse.json({ results, probedAt: new Date().toISOString() });
  }

  const provider = providers[providerName];
  if (!provider) {
    return NextResponse.json(
      {
        error: `Provider desconhecido: ${providerName}`,
        available: Object.keys(providers),
      },
      { status: 400 }
    );
  }

  const result = await provider.probeSource();
  return NextResponse.json(result);
}
