// Artist display name (Book 05 §12.1, Book 09 §17): stage_name || legacy name || real_name.

export interface ArtistNames {
  stage_name: string | null;
  legacy_name: string | null;
  real_name: string | null;
}

export function artistDisplayName(a: ArtistNames): string {
  return (a.stage_name ?? '').trim() || (a.legacy_name ?? '').trim() || (a.real_name ?? '').trim();
}

/** The real name, shown as a secondary line only when it differs from the display name. */
export function artistSecondaryName(a: ArtistNames): string | null {
  const real = (a.real_name ?? '').trim();
  return real && real !== artistDisplayName(a) ? real : null;
}
