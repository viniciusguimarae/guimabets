// src/app/api/scraper/run/route.ts
import { NextResponse } from 'next/server';
import { requireAdminSecret } from '@/lib/server/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const provider = body.provider?.toLowerCase() || 'oddsagora';

    if (provider === 'oddsagora') {
      const baseUrl = request.url.substring(0, request.url.indexOf('/api'));
      // Fazer uma chamada interna para a rota do OddsAgora,
      // passando os mesmos headers para manter auth
      const runRes = await fetch(`${baseUrl}/api/scraper/oddsagora/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': request.headers.get('x-admin-secret') || '',
        },
        body: JSON.stringify({ mode: 'parse_and_save' })
      });
      const data = await runRes.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({
      ok: false,
      message: `Provider ${provider} não suportado na Etapa 4. Foco atual no OddsAgora.`,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
