// Country / state / city data for the Business sign-up address.
//
// Country names are a STATIC map, NOT Intl.DisplayNames. Hermes — React Native's
// JS engine — does not implement Intl.DisplayNames, so the previous version's
// try/catch silently fell through to the raw ISO codes and the picker rendered
// "AD", "AE", "PA"… (Desktop and web use Intl directly and look fine, because
// they run on V8.) This map was generated from Node's full-ICU Intl.DisplayNames
// so the labels are identical to the desktop and web sign-up.
export const COUNTRY_NAMES: Record<string, string> = {
  AD: "Andorra",
  AE: "United Arab Emirates",
  AF: "Afghanistan",
  AG: "Antigua & Barbuda",
  AI: "Anguilla",
  AL: "Albania",
  AM: "Armenia",
  AO: "Angola",
  AQ: "Antarctica",
  AR: "Argentina",
  AS: "American Samoa",
  AT: "Austria",
  AU: "Australia",
  AW: "Aruba",
  AX: "Åland Islands",
  AZ: "Azerbaijan",
  BA: "Bosnia & Herzegovina",
  BB: "Barbados",
  BD: "Bangladesh",
  BE: "Belgium",
  BF: "Burkina Faso",
  BG: "Bulgaria",
  BH: "Bahrain",
  BI: "Burundi",
  BJ: "Benin",
  BL: "St. Barthélemy",
  BM: "Bermuda",
  BN: "Brunei",
  BO: "Bolivia",
  BQ: "Caribbean Netherlands",
  BR: "Brazil",
  BS: "Bahamas",
  BT: "Bhutan",
  BV: "Bouvet Island",
  BW: "Botswana",
  BY: "Belarus",
  BZ: "Belize",
  CA: "Canada",
  CC: "Cocos (Keeling) Islands",
  CD: "Congo - Kinshasa",
  CF: "Central African Republic",
  CG: "Congo - Brazzaville",
  CH: "Switzerland",
  CI: "Côte d’Ivoire",
  CK: "Cook Islands",
  CL: "Chile",
  CM: "Cameroon",
  CN: "China",
  CO: "Colombia",
  CR: "Costa Rica",
  CU: "Cuba",
  CV: "Cape Verde",
  CW: "Curaçao",
  CX: "Christmas Island",
  CY: "Cyprus",
  CZ: "Czechia",
  DE: "Germany",
  DJ: "Djibouti",
  DK: "Denmark",
  DM: "Dominica",
  DO: "Dominican Republic",
  DZ: "Algeria",
  EC: "Ecuador",
  EE: "Estonia",
  EG: "Egypt",
  EH: "Western Sahara",
  ER: "Eritrea",
  ES: "Spain",
  ET: "Ethiopia",
  FI: "Finland",
  FJ: "Fiji",
  FK: "Falkland Islands",
  FM: "Micronesia",
  FO: "Faroe Islands",
  FR: "France",
  GA: "Gabon",
  GB: "United Kingdom",
  GD: "Grenada",
  GE: "Georgia",
  GF: "French Guiana",
  GG: "Guernsey",
  GH: "Ghana",
  GI: "Gibraltar",
  GL: "Greenland",
  GM: "Gambia",
  GN: "Guinea",
  GP: "Guadeloupe",
  GQ: "Equatorial Guinea",
  GR: "Greece",
  GS: "South Georgia & South Sandwich Islands",
  GT: "Guatemala",
  GU: "Guam",
  GW: "Guinea-Bissau",
  GY: "Guyana",
  HK: "Hong Kong SAR China",
  HM: "Heard & McDonald Islands",
  HN: "Honduras",
  HR: "Croatia",
  HT: "Haiti",
  HU: "Hungary",
  ID: "Indonesia",
  IE: "Ireland",
  IL: "Israel",
  IM: "Isle of Man",
  IN: "India",
  IO: "British Indian Ocean Territory",
  IQ: "Iraq",
  IR: "Iran",
  IS: "Iceland",
  IT: "Italy",
  JE: "Jersey",
  JM: "Jamaica",
  JO: "Jordan",
  JP: "Japan",
  KE: "Kenya",
  KG: "Kyrgyzstan",
  KH: "Cambodia",
  KI: "Kiribati",
  KM: "Comoros",
  KN: "St. Kitts & Nevis",
  KP: "North Korea",
  KR: "South Korea",
  KW: "Kuwait",
  KY: "Cayman Islands",
  KZ: "Kazakhstan",
  LA: "Laos",
  LB: "Lebanon",
  LC: "St. Lucia",
  LI: "Liechtenstein",
  LK: "Sri Lanka",
  LR: "Liberia",
  LS: "Lesotho",
  LT: "Lithuania",
  LU: "Luxembourg",
  LV: "Latvia",
  LY: "Libya",
  MA: "Morocco",
  MC: "Monaco",
  MD: "Moldova",
  ME: "Montenegro",
  MF: "St. Martin",
  MG: "Madagascar",
  MH: "Marshall Islands",
  MK: "North Macedonia",
  ML: "Mali",
  MM: "Myanmar (Burma)",
  MN: "Mongolia",
  MO: "Macao SAR China",
  MP: "Northern Mariana Islands",
  MQ: "Martinique",
  MR: "Mauritania",
  MS: "Montserrat",
  MT: "Malta",
  MU: "Mauritius",
  MV: "Maldives",
  MW: "Malawi",
  MX: "Mexico",
  MY: "Malaysia",
  MZ: "Mozambique",
  NA: "Namibia",
  NC: "New Caledonia",
  NE: "Niger",
  NF: "Norfolk Island",
  NG: "Nigeria",
  NI: "Nicaragua",
  NL: "Netherlands",
  NO: "Norway",
  NP: "Nepal",
  NR: "Nauru",
  NU: "Niue",
  NZ: "New Zealand",
  OM: "Oman",
  PA: "Panama",
  PE: "Peru",
  PF: "French Polynesia",
  PG: "Papua New Guinea",
  PH: "Philippines",
  PK: "Pakistan",
  PL: "Poland",
  PM: "St. Pierre & Miquelon",
  PN: "Pitcairn Islands",
  PR: "Puerto Rico",
  PS: "Palestinian Territories",
  PT: "Portugal",
  PW: "Palau",
  PY: "Paraguay",
  QA: "Qatar",
  RE: "Réunion",
  RO: "Romania",
  RS: "Serbia",
  RU: "Russia",
  RW: "Rwanda",
  SA: "Saudi Arabia",
  SB: "Solomon Islands",
  SC: "Seychelles",
  SD: "Sudan",
  SE: "Sweden",
  SG: "Singapore",
  SH: "St. Helena",
  SI: "Slovenia",
  SJ: "Svalbard & Jan Mayen",
  SK: "Slovakia",
  SL: "Sierra Leone",
  SM: "San Marino",
  SN: "Senegal",
  SO: "Somalia",
  SR: "Suriname",
  SS: "South Sudan",
  ST: "São Tomé & Príncipe",
  SV: "El Salvador",
  SX: "Sint Maarten",
  SY: "Syria",
  SZ: "Eswatini",
  TC: "Turks & Caicos Islands",
  TD: "Chad",
  TF: "French Southern Territories",
  TG: "Togo",
  TH: "Thailand",
  TJ: "Tajikistan",
  TK: "Tokelau",
  TL: "Timor-Leste",
  TM: "Turkmenistan",
  TN: "Tunisia",
  TO: "Tonga",
  TR: "Türkiye",
  TT: "Trinidad & Tobago",
  TV: "Tuvalu",
  TW: "Taiwan",
  TZ: "Tanzania",
  UA: "Ukraine",
  UG: "Uganda",
  UM: "U.S. Outlying Islands",
  US: "United States",
  UY: "Uruguay",
  UZ: "Uzbekistan",
  VA: "Vatican City",
  VC: "St. Vincent & Grenadines",
  VE: "Venezuela",
  VG: "British Virgin Islands",
  VI: "U.S. Virgin Islands",
  VN: "Vietnam",
  VU: "Vanuatu",
  WF: "Wallis & Futuna",
  WS: "Samoa",
  XK: "Kosovo",
  YE: "Yemen",
  YT: "Mayotte",
  ZA: "South Africa",
  ZM: "Zambia",
  ZW: "Zimbabwe",
};

/** Display names, alphabetical — what the Country picker shows. */
export const COUNTRIES: string[] = Object.values(COUNTRY_NAMES).sort((a, b) => a.localeCompare(b));

const CODE_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_NAMES).map(([code, name]) => [name, code]),
);

/**
 * countriesnow.space spells a number of countries differently from CLDR
 * ("Czech Republic" vs "Czechia", "Turkey" vs "Türkiye", "Congo, Democratic
 * Republic of the" vs "Congo - Kinshasa"). Sending the display name loses those
 * lookups silently, so requests go through the API's own spelling, keyed by ISO
 * code. Only the entries that actually differ are listed; everything else uses
 * the display name unchanged.
 */
const API_COUNTRY_NAMES: Record<string, string> = {
  AG: "Antigua and Barbuda",
  BA: "Bosnia and Herzegovina",
  CG: "Congo",
  CI: "Ivory Coast",
  CZ: "Czech Republic",
  KN: "Saint Kitts and Nevis",
  LC: "Saint Lucia",
  MM: "Myanmar",
  ST: "Sao Tome and Principe",
  SZ: "Swaziland",
  TR: "Turkey",
  TT: "Trinidad and Tobago",
  VC: "Saint Vincent and the Grenadines",
};

const apiNameFor = (country: string): string => {
  const code = CODE_BY_NAME[country];
  return (code && API_COUNTRY_NAMES[code]) || country;
};

/** Offline fallback for the two countries we ship subdivisions for. */
export const US_STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'];

export const CA_PROVINCES = ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Yukon'];

/** Synchronous subdivisions, available before any network call resolves. */
export const localStatesFor = (country: string): string[] | null => {
  if (country === 'United States') return US_STATES;
  if (country === 'Canada') return CA_PROVINCES;
  return null;
};

const API = 'https://countriesnow.space/api/v0.1';
const stateCache = new Map<string, string[]>();
const cityCache = new Map<string, string[]>();

async function getJson(url: string): Promise<any | null> {
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;
    const res = await fetch(url, { signal: controller?.signal });
    if (timer) clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Subdivisions for a country. Returns [] when the country genuinely has none
 * (Singapore, Monaco, Vatican City…) AND when the lookup fails — the caller
 * cannot distinguish, so a failure degrades to "no state field" rather than
 * blocking sign-up behind a field that can never be filled.
 */
export async function fetchStates(country: string): Promise<string[]> {
  if (!country) return [];
  const hit = stateCache.get(country);
  if (hit) return hit;

  const local = localStatesFor(country);
  if (local) { stateCache.set(country, local); return local; }

  const json = await getJson(`${API}/countries/states/q?country=${encodeURIComponent(apiNameFor(country))}`);
  const raw = json && json.data && Array.isArray(json.data.states) ? json.data.states : [];
  const list: string[] = raw
    .map((s: any) => (s && typeof s.name === 'string' ? s.name : null))
    .filter((s: string | null): s is string => !!s)
    .sort((a: string, b: string) => a.localeCompare(b));
  stateCache.set(country, list);
  return list;
}

/** City names for a country (and state, where one applies). Empty when unknown. */
export async function fetchCities(country: string, state?: string | null): Promise<string[]> {
  if (!country) return [];
  const key = `${country}|${state || ''}`;
  const hit = cityCache.get(key);
  if (hit) return hit;

  const name = apiNameFor(country);
  const url = state
    ? `${API}/countries/state/cities/q?country=${encodeURIComponent(name)}&state=${encodeURIComponent(state)}`
    : `${API}/countries/cities/q?country=${encodeURIComponent(name)}`;
  const json = await getJson(url);
  const list: string[] = Array.isArray(json?.data)
    ? json.data.filter((c: unknown): c is string => typeof c === 'string').sort((a: string, b: string) => a.localeCompare(b))
    : [];
  cityCache.set(key, list);
  return list;
}
