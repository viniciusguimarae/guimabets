// src/lib/server/saveProviderOdds.ts

import { getSupabaseAdmin } from './supabaseAdmin';
import { ParsedOdd } from '../providers/types';
import { randomUUID } from 'crypto';

export interface SaveProviderOddsResult {
  success: boolean;
  bookmakersCreated: number;
  eventsCreated: number;
  marketsCreated: number;
  selectionsCreated: number;
  oddsSaved: number;
  runId: string;
  error?: string;
}

export async function saveProviderOdds(
  providerName: string,
  odds: ParsedOdd[]
): Promise<SaveProviderOddsResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase admin client não configurado');
  }

  const runId = randomUUID();
  const collectedAt = new Date().toISOString();
  // TTL pré-jogo = 60 segundos
  const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

  let bookmakersCreated = 0;
  let eventsCreated = 0;
  let marketsCreated = 0;
  let selectionsCreated = 0;
  let oddsSaved = 0;

  try {
    for (const odd of odds) {
      // 1. Upsert Bookmaker
      const { data: bookmakerData, error: bError } = await supabase
        .from('bookmakers')
        .upsert(
          {
            name: odd.bookmaker.name,
            website_url: null,
            logo_url: null,
            is_active: true,
          },
          { onConflict: 'name' }
        )
        .select('id')
        .single();
      
      if (bError || !bookmakerData) {
        console.error('Erro bookmaker:', bError);
        continue;
      }
      const bookmakerId = bookmakerData.id;
      bookmakersCreated++; // just an approximation for metric

      // 2. Upsert Event
      const { data: eventData, error: eError } = await supabase
        .from('events')
        .upsert(
          {
            sport: odd.event.sport,
            league: odd.event.league,
            name: odd.event.eventName,
            start_time: odd.event.eventDate || new Date(Date.now() + 86400000 * 2).toISOString(),
            status: 'upcoming',
          },
          { onConflict: 'sport,league,name' }
        )
        .select('id')
        .single();
        
      if (eError || !eventData) {
        console.error('Erro event:', eError);
        continue;
      }
      const eventId = eventData.id;
      eventsCreated++;

      // 3. Upsert Market
      const { data: marketData, error: mError } = await supabase
        .from('markets')
        .upsert(
          {
            event_id: eventId,
            market_type: odd.market.type,
            market_name: odd.market.name,
          },
          { onConflict: 'event_id,market_type' }
        )
        .select('id')
        .single();
        
      if (mError || !marketData) {
        console.error('Erro market:', mError);
        continue;
      }
      const marketId = marketData.id;
      marketsCreated++;

      // 4. Upsert Selection
      const { data: selData, error: sError } = await supabase
        .from('market_selections')
        .upsert(
          {
            market_id: marketId,
            selection_name: odd.selection.name,
          },
          { onConflict: 'market_id,selection_name' }
        )
        .select('id')
        .single();
        
      if (sError || !selData) {
        console.error('Erro selection:', sError);
        continue;
      }
      const selectionId = selData.id;
      selectionsCreated++;

      // 5. Insert Odd Snapshot
      const { error: oError } = await supabase
        .from('odds_snapshots')
        .insert({
          selection_id: selectionId,
          bookmaker_id: bookmakerId,
          odd_decimal: odd.value,
          status: 'active',
          is_active: true,
          provider_run_id: runId,
          collected_at: collectedAt,
          expires_at: expiresAt,
        });

      if (oError) {
        console.error('Erro odd snapshot:', oError);
        continue;
      }
      oddsSaved++;
    }

    return {
      success: true,
      bookmakersCreated,
      eventsCreated,
      marketsCreated,
      selectionsCreated,
      oddsSaved,
      runId,
    };
  } catch (err) {
    console.error('Erro geral ao salvar odds:', err);
    return {
      success: false,
      bookmakersCreated,
      eventsCreated,
      marketsCreated,
      selectionsCreated,
      oddsSaved,
      runId,
      error: String(err),
    };
  }
}
