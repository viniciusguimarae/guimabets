import { NextResponse } from 'next/server';
import { runFinalInvestigation } from '@/lib/server/oddsAgoraFinalInvestigationService';

export async function POST(req: Request) {
  try {
    const adminSecret = req.headers.get('x-admin-secret');
    if (!adminSecret || adminSecret !== process.env.GMB_ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runFinalInvestigation();
    return NextResponse.json(result);
  } catch (error) {
    console.error('OddsAgora Final Investigation Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
