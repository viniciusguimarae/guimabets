// src/app/api/opportunities/recalculate/route.ts
import { NextResponse } from 'next/server';
import { requireAdminSecret } from '@/lib/server/adminAuth';
import { isSupabaseServerConfigured } from '@/lib/server/supabaseAdmin';
import { recalculateOpportunities } from '@/lib/server/opportunityLifecycleService';

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
    const result = await recalculateOpportunities();

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: 'Erro ao recalcular oportunidades', details: String(err) },
      { status: 500 }
    );
  }
}
