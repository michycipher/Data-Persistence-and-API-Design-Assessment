'use strict';

/**
 * ISO 3166-1 alpha-2 country codes → full names
 * Covers all regions with emphasis on Africa (common in the dataset)
 */
const CODE_TO_NAME = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AO: 'Angola',
  AR: 'Argentina', AM: 'Armenia', AU: 'Australia', AT: 'Austria',
  AZ: 'Azerbaijan', BH: 'Bahrain', BD: 'Bangladesh', BY: 'Belarus',
  BE: 'Belgium', BJ: 'Benin', BO: 'Bolivia', BA: 'Bosnia and Herzegovina',
  BW: 'Botswana', BR: 'Brazil', BG: 'Bulgaria', BF: 'Burkina Faso',
  BI: 'Burundi', CM: 'Cameroon', CA: 'Canada', CF: 'Central African Republic',
  TD: 'Chad', CL: 'Chile', CN: 'China', CO: 'Colombia', CG: 'Congo',
  CD: 'Democratic Republic of the Congo', CR: 'Costa Rica', HR: 'Croatia',
  CU: 'Cuba', CY: 'Cyprus', CZ: 'Czech Republic', DK: 'Denmark',
  DJ: 'Djibouti', DO: 'Dominican Republic', EC: 'Ecuador', EG: 'Egypt',
  SV: 'El Salvador', GQ: 'Equatorial Guinea', ER: 'Eritrea', EE: 'Estonia',
  ET: 'Ethiopia', FI: 'Finland', FR: 'France', GA: 'Gabon', GM: 'Gambia',
  GE: 'Georgia', DE: 'Germany', GH: 'Ghana', GR: 'Greece', GT: 'Guatemala',
  GN: 'Guinea', GW: 'Guinea-Bissau', HT: 'Haiti', HN: 'Honduras',
  HU: 'Hungary', IN: 'India', ID: 'Indonesia', IR: 'Iran', IQ: 'Iraq',
  IE: 'Ireland', IL: 'Israel', IT: 'Italy', JM: 'Jamaica', JP: 'Japan',
  JO: 'Jordan', KZ: 'Kazakhstan', KE: 'Kenya', KW: 'Kuwait', KG: 'Kyrgyzstan',
  LA: 'Laos', LV: 'Latvia', LB: 'Lebanon', LR: 'Liberia', LY: 'Libya',
  LT: 'Lithuania', MG: 'Madagascar', MW: 'Malawi', MY: 'Malaysia',
  MV: 'Maldives', ML: 'Mali', MT: 'Malta', MR: 'Mauritania', MX: 'Mexico',
  MD: 'Moldova', MA: 'Morocco', MZ: 'Mozambique', MM: 'Myanmar',
  NA: 'Namibia', NP: 'Nepal', NL: 'Netherlands', NZ: 'New Zealand',
  NI: 'Nicaragua', NE: 'Niger', NG: 'Nigeria', NO: 'Norway', OM: 'Oman',
  PK: 'Pakistan', PA: 'Panama', PG: 'Papua New Guinea', PY: 'Paraguay',
  PE: 'Peru', PH: 'Philippines', PL: 'Poland', PT: 'Portugal', QA: 'Qatar',
  RO: 'Romania', RU: 'Russia', RW: 'Rwanda', SA: 'Saudi Arabia',
  SN: 'Senegal', RS: 'Serbia', SL: 'Sierra Leone', SO: 'Somalia',
  ZA: 'South Africa', SS: 'South Sudan', ES: 'Spain', LK: 'Sri Lanka',
  SD: 'Sudan', SE: 'Sweden', CH: 'Switzerland', SY: 'Syria', TW: 'Taiwan',
  TJ: 'Tajikistan', TZ: 'Tanzania', TH: 'Thailand', TG: 'Togo',
  TT: 'Trinidad and Tobago', TN: 'Tunisia', TR: 'Turkey', TM: 'Turkmenistan',
  UG: 'Uganda', UA: 'Ukraine', AE: 'United Arab Emirates', GB: 'United Kingdom',
  US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan', VE: 'Venezuela',
  VN: 'Vietnam', YE: 'Yemen', ZM: 'Zambia', ZW: 'Zimbabwe',
  DRC: 'Democratic Republic of the Congo', UK: 'United Kingdom',
};

/**
 * Reverse map: lowercase country name → ISO code
 * Used by the NLP parser to resolve "from nigeria" → "NG"
 */
const NAME_TO_CODE = {};
for (const [code, name] of Object.entries(CODE_TO_NAME)) {
  NAME_TO_CODE[name.toLowerCase()] = code;
}

// Extra aliases for common variations
const ALIASES = {
  'usa': 'US', 'america': 'US', 'united states of america': 'US',
  'uk': 'GB', 'england': 'GB', 'britain': 'GB', 'great britain': 'GB',
  'uae': 'AE', 'emirates': 'AE',
  'russia': 'RU', 'congo': 'CG', 'drc': 'CD',
  'ivory coast': 'CI', "cote d'ivoire": 'CI',
  'south korea': 'KR', 'north korea': 'KP',
  'korea': 'KR',
  'iran': 'IR', 'persia': 'IR',
  'czechia': 'CZ',
};

/**
 * Get country name from ISO code
 * @param {string} code
 * @returns {string}
 */
function getCountryName(code) {
  if (!code) return null;
  return CODE_TO_NAME[code.toUpperCase()] || code;
}

/**
 * Get ISO code from country name (for NLP parser)
 * @param {string} name
 * @returns {string|null}
 */
function getCountryCode(name) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  return ALIASES[lower] || NAME_TO_CODE[lower] || null;
}

module.exports = { getCountryName, getCountryCode, CODE_TO_NAME };
