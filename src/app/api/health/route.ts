// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { isSupabaseServerConfigured } from '@/lib/server/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const serverMode = process.env.NEXT_PUBLIC_USE_SERVER_DATA === 'true';
  const supabaseConfigured = isSupabaseServerConfigured();

  const health = {
    ok: true,
    mode: serverMode ? 'server' : 'local',
    supabase: {
      configured: supabaseConfigured,
      url: process.env.SUPABASE_URL
        ? `${process.env.SUPABASE_URL.substring(0, 25)}...`
        : null,
    },
    adminSecret: !!process.env.GMB_ADMIN_SECRET,
    version: '2.0.0',
    stage: 'Etapa 2 — Backend Mínimo',
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(health);
}
