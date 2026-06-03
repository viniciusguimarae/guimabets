// src/app/api/providers/oddspapi/bookmakers/route.ts
import { NextResponse } from 'next/server';
import { requireAdminSecret } from '@/lib/server/adminAuth';
import { listBookmakers } from '@/lib/providers/oddsPapiProvider';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  const result = await listBookmakers();
  return NextResponse.json(result);
}
