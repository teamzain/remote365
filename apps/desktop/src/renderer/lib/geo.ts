// Countries, US states / Canadian provinces, and city suggestions for the
// business sign-up address. Country names come from the browser's own
// locale data (Intl.DisplayNames); cities are fetched on demand from the
// public countriesnow.space API and fall back to free typing when it is
// unreachable.

const ISO_CODES = 'AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI KH CM CA CV KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW XK'.split(' ');

const displayNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();

export const COUNTRIES: string[] = Array.from(new Set(ISO_CODES.map((code) => {
  try { return displayNames?.of(code) || code; } catch { return code; }
}))).sort((a, b) => a.localeCompare(b));

export const US_STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'];

export const CA_PROVINCES = ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Yukon'];

/** Countries whose address needs a state / province before the city. */
export const statesFor = (country: string): string[] | null => {
  if (country === 'United States') return US_STATES;
  if (country === 'Canada') return CA_PROVINCES;
  return null;
};

const cache = new Map<string, string[]>();

/** City names for a country (and state, where one applies). Empty when unknown. */
export async function fetchCities(country: string, state?: string | null): Promise<string[]> {
  if (!country) return [];
  const key = `${country}|${state || ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const url = state
    ? `https://countriesnow.space/api/v0.1/countries/state/cities/q?country=${encodeURIComponent(country)}&state=${encodeURIComponent(state)}`
    : `https://countriesnow.space/api/v0.1/countries/cities/q?country=${encodeURIComponent(country)}`;
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 7000) : null;
    const res = await fetch(url, { signal: controller?.signal });
    if (timer) clearTimeout(timer);
    const json = await res.json();
    const list: string[] = Array.isArray(json?.data) ? json.data.filter((c: unknown) => typeof c === 'string') : [];
    cache.set(key, list);
    return list;
  } catch {
    return [];
  }
}
