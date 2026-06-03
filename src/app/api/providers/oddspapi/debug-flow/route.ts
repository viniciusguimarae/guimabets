import { NextResponse } from 'next/server';
import { requireAdminSecret } from '@/lib/server/adminAuth';
import * as oddsPapi from '@/lib/providers/oddsPapiProvider';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const { step, payload } = body;

  try {
    if (step === 'sports') {
      const result = await oddsPapi.getSportsDiagnostic();
      return NextResponse.json(result);
    }
    if (step === 'tournaments') {
      const result = await oddsPapi.getTournamentsDiagnostic(payload?.sportId ?? 10);
      return NextResponse.json(result);
    }
    if (step === 'odds-probe') {
      if (!payload?.tournamentId) return NextResponse.json({ ok: false, error: 'tournamentId não fornecido' });
      const result = await oddsPapi.getOddsProbeDiagnostic(payload.tournamentId);
      return NextResponse.json(result);
    }
    return NextResponse.json({ ok: false, error: 'Passo inválido: ' + step }, { status: 400 });
  } catch(e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
