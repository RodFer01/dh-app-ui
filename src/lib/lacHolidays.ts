// LAC public holidays 2026
// Sources: Wikipedia, government sites. Easter 2026 = April 5.

export interface Holiday {
  date: string    // YYYY-MM-DD
  name: string    // English name
  country: 'BR' | 'AR' | 'CL' | 'CO' | 'MX'
  countryName: string
  flag: string
}

export const LAC_HOLIDAYS_2026: Holiday[] = [
  // ── BRAZIL ────────────────────────────────────────────────────────────────
  { date: '2026-01-01', name: "New Year's Day",          country: 'BR', countryName: 'Brazil',    flag: '🇧🇷' },
  { date: '2026-02-16', name: 'Carnival Monday',         country: 'BR', countryName: 'Brazil',    flag: '🇧🇷' },
  { date: '2026-02-17', name: 'Carnival Tuesday',        country: 'BR', countryName: 'Brazil',    flag: '🇧🇷' },
  { date: '2026-04-03', name: 'Good Friday',             country: 'BR', countryName: 'Brazil',    flag: '🇧🇷' },
  { date: '2026-04-21', name: 'Tiradentes Day',          country: 'BR', countryName: 'Brazil',    flag: '🇧🇷' },
  { date: '2026-05-01', name: 'Labour Day',              country: 'BR', countryName: 'Brazil',    flag: '🇧🇷' },
  { date: '2026-06-04', name: 'Corpus Christi',          country: 'BR', countryName: 'Brazil',    flag: '🇧🇷' },
  { date: '2026-09-07', name: 'Independence Day',        country: 'BR', countryName: 'Brazil',    flag: '🇧🇷' },
  { date: '2026-10-12', name: 'Our Lady of Aparecida',   country: 'BR', countryName: 'Brazil',    flag: '🇧🇷' },
  { date: '2026-11-02', name: "All Souls' Day",          country: 'BR', countryName: 'Brazil',    flag: '🇧🇷' },
  { date: '2026-11-15', name: 'Republic Day',            country: 'BR', countryName: 'Brazil',    flag: '🇧🇷' },
  { date: '2026-11-20', name: 'Black Consciousness Day', country: 'BR', countryName: 'Brazil',    flag: '🇧🇷' },
  { date: '2026-12-25', name: 'Christmas Day',           country: 'BR', countryName: 'Brazil',    flag: '🇧🇷' },

  // ── ARGENTINA ─────────────────────────────────────────────────────────────
  { date: '2026-01-01', name: "New Year's Day",                               country: 'AR', countryName: 'Argentina', flag: '🇦🇷' },
  { date: '2026-02-16', name: 'Carnival Monday',                              country: 'AR', countryName: 'Argentina', flag: '🇦🇷' },
  { date: '2026-02-17', name: 'Carnival Tuesday',                             country: 'AR', countryName: 'Argentina', flag: '🇦🇷' },
  { date: '2026-03-24', name: 'Day of Remembrance for Truth and Justice',     country: 'AR', countryName: 'Argentina', flag: '🇦🇷' },
  { date: '2026-04-02', name: 'Veterans and Fallen of the Malvinas War',      country: 'AR', countryName: 'Argentina', flag: '🇦🇷' },
  { date: '2026-04-03', name: 'Good Friday',                                  country: 'AR', countryName: 'Argentina', flag: '🇦🇷' },
  { date: '2026-05-01', name: 'Labour Day',                                   country: 'AR', countryName: 'Argentina', flag: '🇦🇷' },
  { date: '2026-05-25', name: 'May Revolution Day',                           country: 'AR', countryName: 'Argentina', flag: '🇦🇷' },
  { date: '2026-06-15', name: "Güemes Day",                                   country: 'AR', countryName: 'Argentina', flag: '🇦🇷' },
  { date: '2026-06-20', name: 'General Belgrano Memorial Day',                country: 'AR', countryName: 'Argentina', flag: '🇦🇷' },
  { date: '2026-07-09', name: 'Independence Day',                             country: 'AR', countryName: 'Argentina', flag: '🇦🇷' },
  { date: '2026-08-17', name: 'General San Martín Memorial Day',              country: 'AR', countryName: 'Argentina', flag: '🇦🇷' },
  { date: '2026-10-12', name: 'Respect for Cultural Diversity Day',           country: 'AR', countryName: 'Argentina', flag: '🇦🇷' },
  { date: '2026-11-23', name: 'National Sovereignty Day',                     country: 'AR', countryName: 'Argentina', flag: '🇦🇷' },
  { date: '2026-12-08', name: 'Immaculate Conception',                        country: 'AR', countryName: 'Argentina', flag: '🇦🇷' },
  { date: '2026-12-25', name: 'Christmas Day',                                country: 'AR', countryName: 'Argentina', flag: '🇦🇷' },

  // ── CHILE ─────────────────────────────────────────────────────────────────
  { date: '2026-01-01', name: "New Year's Day",          country: 'CL', countryName: 'Chile',     flag: '🇨🇱' },
  { date: '2026-04-03', name: 'Good Friday',             country: 'CL', countryName: 'Chile',     flag: '🇨🇱' },
  { date: '2026-04-04', name: 'Holy Saturday',           country: 'CL', countryName: 'Chile',     flag: '🇨🇱' },
  { date: '2026-05-01', name: 'Labour Day',              country: 'CL', countryName: 'Chile',     flag: '🇨🇱' },
  { date: '2026-05-21', name: 'Navy Day',                country: 'CL', countryName: 'Chile',     flag: '🇨🇱' },
  { date: '2026-06-21', name: 'National Indigenous Peoples Day', country: 'CL', countryName: 'Chile', flag: '🇨🇱' },
  { date: '2026-06-29', name: 'Saints Peter and Paul',   country: 'CL', countryName: 'Chile',     flag: '🇨🇱' },
  { date: '2026-07-16', name: 'Our Lady of Mount Carmel',country: 'CL', countryName: 'Chile',     flag: '🇨🇱' },
  { date: '2026-08-15', name: 'Assumption of Mary',      country: 'CL', countryName: 'Chile',     flag: '🇨🇱' },
  { date: '2026-09-18', name: 'Independence Day',        country: 'CL', countryName: 'Chile',     flag: '🇨🇱' },
  { date: '2026-09-19', name: 'Army Day',                country: 'CL', countryName: 'Chile',     flag: '🇨🇱' },
  { date: '2026-10-12', name: 'Columbus Day',            country: 'CL', countryName: 'Chile',     flag: '🇨🇱' },
  { date: '2026-10-31', name: 'Reformation Day',         country: 'CL', countryName: 'Chile',     flag: '🇨🇱' },
  { date: '2026-11-01', name: "All Saints' Day",         country: 'CL', countryName: 'Chile',     flag: '🇨🇱' },
  { date: '2026-12-08', name: 'Immaculate Conception',   country: 'CL', countryName: 'Chile',     flag: '🇨🇱' },
  { date: '2026-12-25', name: 'Christmas Day',           country: 'CL', countryName: 'Chile',     flag: '🇨🇱' },

  // ── COLOMBIA ──────────────────────────────────────────────────────────────
  { date: '2026-01-01', name: "New Year's Day",          country: 'CO', countryName: 'Colombia',  flag: '🇨🇴' },
  { date: '2026-01-12', name: 'Epiphany',                country: 'CO', countryName: 'Colombia',  flag: '🇨🇴' },
  { date: '2026-03-23', name: "Saint Joseph's Day",      country: 'CO', countryName: 'Colombia',  flag: '🇨🇴' },
  { date: '2026-04-02', name: 'Maundy Thursday',         country: 'CO', countryName: 'Colombia',  flag: '🇨🇴' },
  { date: '2026-04-03', name: 'Good Friday',             country: 'CO', countryName: 'Colombia',  flag: '🇨🇴' },
  { date: '2026-05-01', name: 'International Workers Day',country: 'CO', countryName: 'Colombia', flag: '🇨🇴' },
  { date: '2026-05-18', name: 'Ascension Day',           country: 'CO', countryName: 'Colombia',  flag: '🇨🇴' },
  { date: '2026-06-08', name: 'Corpus Christi',          country: 'CO', countryName: 'Colombia',  flag: '🇨🇴' },
  { date: '2026-06-15', name: 'Sacred Heart',            country: 'CO', countryName: 'Colombia',  flag: '🇨🇴' },
  { date: '2026-06-29', name: 'Saints Peter and Paul',   country: 'CO', countryName: 'Colombia',  flag: '🇨🇴' },
  { date: '2026-07-20', name: 'Declaration of Independence', country: 'CO', countryName: 'Colombia', flag: '🇨🇴' },
  { date: '2026-08-07', name: 'Battle of Boyacá',        country: 'CO', countryName: 'Colombia',  flag: '🇨🇴' },
  { date: '2026-08-17', name: 'Assumption of Mary',      country: 'CO', countryName: 'Colombia',  flag: '🇨🇴' },
  { date: '2026-10-12', name: 'Columbus Day',            country: 'CO', countryName: 'Colombia',  flag: '🇨🇴' },
  { date: '2026-11-02', name: "All Saints' Day",         country: 'CO', countryName: 'Colombia',  flag: '🇨🇴' },
  { date: '2026-11-16', name: 'Independence of Cartagena',country: 'CO', countryName: 'Colombia', flag: '🇨🇴' },
  { date: '2026-12-08', name: 'Immaculate Conception',   country: 'CO', countryName: 'Colombia',  flag: '🇨🇴' },
  { date: '2026-12-25', name: 'Christmas Day',           country: 'CO', countryName: 'Colombia',  flag: '🇨🇴' },

  // ── MEXICO ────────────────────────────────────────────────────────────────
  { date: '2026-01-01', name: "New Year's Day",          country: 'MX', countryName: 'Mexico',    flag: '🇲🇽' },
  { date: '2026-02-02', name: 'Constitution Day',        country: 'MX', countryName: 'Mexico',    flag: '🇲🇽' },
  { date: '2026-03-16', name: "Benito Juárez's Birthday",country: 'MX', countryName: 'Mexico',    flag: '🇲🇽' },
  { date: '2026-05-01', name: 'Labour Day',              country: 'MX', countryName: 'Mexico',    flag: '🇲🇽' },
  { date: '2026-09-16', name: 'Independence Day',        country: 'MX', countryName: 'Mexico',    flag: '🇲🇽' },
  { date: '2026-11-16', name: 'Revolution Day',          country: 'MX', countryName: 'Mexico',    flag: '🇲🇽' },
  { date: '2026-12-25', name: 'Christmas Day',           country: 'MX', countryName: 'Mexico',    flag: '🇲🇽' },
]

// Quick lookup: date → list of holidays on that day
export function getHolidaysForDate(date: string): Holiday[] {
  return LAC_HOLIDAYS_2026.filter(h => h.date === date)
}

// Country display colors
export const COUNTRY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  BR: { bg: '#E8F5E9', border: '#2E7D32', text: '#1B5E20' },
  AR: { bg: '#E3F2FD', border: '#1565C0', text: '#0D47A1' },
  CL: { bg: '#FCE4EC', border: '#C62828', text: '#7F0000' },
  CO: { bg: '#FFF8E1', border: '#F57F17', text: '#7A5800' },
  MX: { bg: '#F3E5F5', border: '#6A1B9A', text: '#4A148C' },
}
