import { artistDisplayName, artistSecondaryName } from '@/domain/artists';
import { AppError, MESSAGES, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { toUsage, type UsageVM } from '@/features/vendors/data/vendorsRepository';

export interface ArtistVM extends UsageVM {
  id: string;
  displayName: string;
  realNameSecondary: string | null;
  stageName: string;
  realName: string;
  legacyName: string | null;
  phone: string;
  contactDetails: string;
  notes: string;
  systemNotes: string;
  isArchived: boolean;
}

const COLUMNS = 'id, stage_name, real_name, legacy_name, phone, contact_details, notes, system_notes, is_archived';

type ArtistRow = {
  id: string; stage_name: string; real_name: string; legacy_name: string | null; phone: string;
  contact_details: string; notes: string; system_notes: string; is_archived: boolean;
};

function toVM(a: ArtistRow, usage: UsageVM): ArtistVM {
  return {
    id: a.id,
    displayName: artistDisplayName(a),
    realNameSecondary: artistSecondaryName(a),
    stageName: a.stage_name,
    realName: a.real_name,
    legacyName: a.legacy_name,
    phone: a.phone,
    contactDetails: a.contact_details,
    notes: a.notes,
    systemNotes: a.system_notes,
    isArchived: a.is_archived,
    ...usage,
  };
}

export async function listArtists(includeArchived = false): Promise<ArtistVM[]> {
  let q = supabase.from('artists').select(COLUMNS);
  if (!includeArchived) q = q.eq('is_archived', false);
  const [artists, usage] = await Promise.all([q, supabase.from('v_artist_usage').select('*')]);
  if (artists.error) throw toAppError(artists.error, 'listArtists', MESSAGES.load);
  if (usage.error) throw toAppError(usage.error, 'listArtists', MESSAGES.load);
  const byId = new Map(usage.data.map((u) => [u.artist_id, u]));
  return artists.data
    .map((a) => toVM(a, toUsage(byId.get(a.id))))
    .sort((x, y) => x.displayName.localeCompare(y.displayName, 'he'));
}

export async function getArtist(id: string): Promise<ArtistVM> {
  const [artist, usage] = await Promise.all([
    supabase.from('artists').select(COLUMNS).eq('id', id).maybeSingle(),
    supabase.from('v_artist_usage').select('*').eq('artist_id', id).maybeSingle(),
  ]);
  if (artist.error) throw toAppError(artist.error, 'getArtist', MESSAGES.load);
  if (!artist.data) throw new AppError('NOT_FOUND', 'artist', MESSAGES.notFound, 'getArtist');
  return toVM(artist.data, toUsage(usage.data ?? undefined));
}

export interface ArtistInput {
  id?: string;
  stageName: string;
  realName: string;
  phone: string;
  contactDetails: string;
  notes: string;
  systemNotes: string;
}

export async function saveArtist(input: ArtistInput): Promise<string> {
  const row = {
    stage_name: input.stageName.trim(),
    real_name: input.realName.trim(),
    phone: input.phone.trim(),
    contact_details: input.contactDetails,
    notes: input.notes,
    system_notes: input.systemNotes,
  };
  if (input.id) {
    const { error } = await supabase.from('artists').update(row).eq('id', input.id);
    if (error) throw toAppError(error, 'saveArtist');
    return input.id;
  }
  const { data, error } = await supabase.from('artists').insert(row).select('id').single();
  if (error) throw toAppError(error, 'saveArtist');
  return data.id;
}

export async function archiveArtist(id: string): Promise<void> {
  const { error } = await supabase.from('artists').update({ is_archived: true }).eq('id', id);
  if (error) throw toAppError(error, 'archiveArtist');
}
