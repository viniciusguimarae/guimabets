// src/app/api/scraper/run/route.ts
import { NextResponse } from 'next/server';
import { requireAdminSecret } from '@/lib/server/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  // Etapa 2: Scraper real não implementado ainda.
  // Esta rota existe como placeholder para a Etapa 3.
  return NextResponse.json({
    ok: false,
    stage: 'Etapa 2',
    message:
      'Scraper real ainda não implementado nesta etapa. ' +
      'Use /api/mock/generate para gerar dados de teste no Supabase. ' +
      'Implementação real de scraping prevista para a Etapa 3.',
    roadmap: {
      etapa2: 'Backend mínimo e ciclo de vida das odds ✅',
      etapa3: 'Scraper real com dados de fontes públicas (Em breve)',
    },
  });
}
