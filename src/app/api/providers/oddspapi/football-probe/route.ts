// src/app/api/providers/oddspapi/football-probe/route.ts
import { NextResponse } from 'next/server';
import { requireAdminSecret } from '@/lib/server/adminAuth';
import { footballProbe } from '@/lib/providers/oddsPapiProvider';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  const result = await footballProbe();
  return NextResponse.json(result);
}
