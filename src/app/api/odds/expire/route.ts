// src/app/api/odds/expire/route.ts
import { NextResponse } from 'next/server';
import { requireAdminSecret } from '@/lib/server/adminAuth';
import { isSupabaseServerConfigured } from '@/lib/server/supabaseAdmin';
import { expireOldOdds, markEventStartedOdds } from '@/lib/server/oddsLifecycleService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: 'Supabase não configurado.' },
      { status: 503 }
    );
  }

  try {
    const [expiredOdds, eventStartedOdds] = await Promise.all([
      expireOldOdds(),
      markEventStartedOdds(),
    ]);

    return NextResponse.json({
      ok: true,
      expiredOdds,
      eventStartedOdds,
      processedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Erro ao expirar odds', details: String(err) },
      { status: 500 }
    );
  }
}
