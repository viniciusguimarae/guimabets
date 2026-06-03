// src/app/api/mock/generate/route.ts
import { NextResponse } from 'next/server';
import { requireAdminSecret } from '@/lib/server/adminAuth';
import { isSupabaseServerConfigured } from '@/lib/server/supabaseAdmin';
import { mockProvider } from '@/lib/providers/mockProvider';
import { recalculateOpportunities } from '@/lib/server/opportunityLifecycleService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: 'Supabase não configurado. Não é possível gerar dados mock server-side.' },
      { status: 503 }
    );
  }

  try {
    // 1. Gerar dados mock no banco
    const mockResult = await mockProvider.generateData();

    // 2. Recalcular oportunidades com os novos dados
    const recalcResult = await recalculateOpportunities();

    return NextResponse.json({
      ok: true,
      mock: mockResult,
      recalculate: recalcResult,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Erro ao gerar dados mock', details: String(err) },
      { status: 500 }
    );
  }
}
