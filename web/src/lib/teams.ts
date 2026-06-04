export const TEAM_COLORS: Record<string, [string, string]> = {
  ATL: ['#E03A3E', '#FFFFFF'],
  BOS: ['#007A33', '#FFFFFF'],
  BKN: ['#000000', '#FFFFFF'],
  CHA: ['#00788C', '#FFFFFF'],
  CHI: ['#CE1141', '#FFFFFF'],
  CLE: ['#6F263D', '#FFB81C'],
  DAL: ['#002B5E', '#C4CED4'],
  DEN: ['#0E2240', '#FEC524'],
  DET: ['#C8102E', '#FFFFFF'],
  GSW: ['#1D428A', '#FDB927'],
  HOU: ['#CE1141', '#FFFFFF'],
  IND: ['#041E42', '#FFC72C'],
  LAC: ['#1D428A', '#FFFFFF'],
  LAL: ['#552583', '#FDB927'],
  MEM: ['#5D76A9', '#FFFFFF'],
  MIA: ['#000000', '#F9423A'],
  MIL: ['#00471B', '#EEE1C6'],
  MIN: ['#0C2340', '#78BE20'],
  NOP: ['#0C2340', '#B4975A'],
  NYK: ['#006BB6', '#F58426'],
  OKC: ['#002D62', '#EF3B24'],
  ORL: ['#0077C0', '#C4CED4'],
  PHI: ['#006BB6', '#FFFFFF'],
  PHX: ['#1D1160', '#E56020'],
  POR: ['#000000', '#E03A3E'],
  SAC: ['#5A2D81', '#FFFFFF'],
  SAS: ['#000000', '#C4CED4'],
  TOR: ['#CE1141', '#FFFFFF'],
  UTA: ['#002B5C', '#F9A01B'],
  WAS: ['#002B5C', '#FFFFFF'],
}

export function teamColors(abbr: string): { bg: string; text: string } {
  const [bg, text] = TEAM_COLORS[abbr] ?? ['#F59E0B', '#000000']
  return { bg, text }
}
