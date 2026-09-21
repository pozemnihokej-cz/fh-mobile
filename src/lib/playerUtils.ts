/**
 * Normalizes player/staff position strings to standardized Czech labels.
 */
const POSITION_MAP_CZ: Record<string, string> = {
  // Goalkeepers
  gk: 'Brankář',
  g: 'Brankář',
  br: 'Brankář',
  goalkeeper: 'Brankář',
  brankář: 'Brankář',
  brankarka: 'Brankářka',
  brankářka: 'Brankářka',

  // Defenders
  df: 'Obránce',
  d: 'Obránce',
  obr: 'Obránce',
  defender: 'Obránce',
  obránce: 'Obránce',
  obrankyne: 'Obránkyně',
  obránkyně: 'Obránkyně',
  cb: 'Střední obránce',
  lb: 'Levý obránce',
  rb: 'Pravý obránce',
  sw: 'Libero',
  stopper: 'Stopper',

  // Midfielders
  mf: 'Záložník',
  m: 'Záložník',
  mid: 'Záložník',
  zál: 'Záložník',
  midfielder: 'Záložník',
  záložník: 'Záložník',
  záložnice: 'Záložnice',
  zaloznice: 'Záložnice',
  cm: 'Záložník',
  lm: 'Levý záložník',
  rm: 'Pravý záložník',

  // Forwards
  fw: 'Útočník',
  f: 'Útočník',
  att: 'Útočník',
  úto: 'Útočník',
  forward: 'Útočník',
  útočník: 'Útočník',
  útočnice: 'Útočnice',
  utocnice: 'Útočnice',
  cf: 'Útočník',
  lw: 'Levé křídlo',
  rw: 'Pravé křídlo',

  // Staff / Roles
  coach: 'Trenér',
  trener: 'Trenér',
  trenér: 'Trenér',
  headcoach: 'Hlavní trenér',
  assistant: 'Asistent',
  referee: 'Rozhodčí',
  rozhodčí: 'Rozhodčí',
  official: 'Funkcionář',
  captain: 'Kapitán',
  c: 'Kapitán',
};

export function formatPositionCz(position?: string | null, isCoach?: boolean): string | null {
  if (isCoach) return 'Trenér';
  if (!position) return null;
  const trimmed = position.trim();
  if (!trimmed) return null;

  const key = trimmed.toLowerCase();
  return POSITION_MAP_CZ[key] ?? trimmed;
}
