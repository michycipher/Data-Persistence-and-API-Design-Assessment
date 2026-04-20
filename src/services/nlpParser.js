'use strict';

const { getCountryCode } = require('./countries');

/**
 * Natural Language Query Parser
 *
 * Converts plain English queries into structured filter objects.
 * Rule-based only — no AI, no LLMs.
 *
 * Supported patterns:
 *   Gender   : male, males, man, men | female, females, woman, women, girl, girls
 *   Age group: young (16–24), teenager/teen, adult, senior/elderly, child/children/kids
 *   Age range: above/over/older than N, below/under/younger than N, between N and M
 *   Country  : "from [country]", "in [country]"
 */

// Keyword maps

const GENDER_MALE_WORDS    = ['male', 'males', 'man', 'men'];
const GENDER_FEMALE_WORDS  = ['female', 'females', 'woman', 'women', 'girl', 'girls'];

const AGE_GROUP_MAP = {
  young:      { min_age: 16, max_age: 24 },     // "young" is a special case — not a stored group
  teenager:   { age_group: 'teenager' },
  teenagers:  { age_group: 'teenager' },
  teen:       { age_group: 'teenager' },
  teens:      { age_group: 'teenager' },
  adult:      { age_group: 'adult' },
  adults:     { age_group: 'adult' },
  senior:     { age_group: 'senior' },
  seniors:    { age_group: 'senior' },
  elderly:    { age_group: 'senior' },
  old:        { age_group: 'senior' },
  child:      { age_group: 'child' },
  children:   { age_group: 'child' },
  kids:       { age_group: 'child' },
  kid:        { age_group: 'child' },
};

// Helpers 

function toInt(str) {
  const n = parseInt(str, 10);
  return isNaN(n) ? null : n;
}

/**
 * Parse a plain English query string into filter/sort parameters.
 *
 * @param {string} query   Raw query string (e.g. "young males from nigeria")
 * @returns {{ filters: object, interpreted: boolean }}
 */
function parseQuery(query) {
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return { filters: {}, interpreted: false };
  }

  const q       = query.toLowerCase().trim();
  const words   = q.split(/\s+/);
  const filters = {};

  // Gender 
  if (words.some(w => GENDER_MALE_WORDS.includes(w))) {
    filters.gender = 'male';
  }
  if (words.some(w => GENDER_FEMALE_WORDS.includes(w))) {
    // "male and female" → no gender filter (both genders)
    if (filters.gender === 'male') {
      delete filters.gender; // both genders mentioned -> no restriction
    } else {
      filters.gender = 'female';
    }
  }

  // Age group / young 
  for (const word of words) {
    if (AGE_GROUP_MAP[word]) {
      const mapping = AGE_GROUP_MAP[word];
      Object.assign(filters, mapping);
      break; // first match wins
    }
  }

  // Age qualifiers 
  // "above N" / "over N" / "older than N"
  const aboveMatch = q.match(/(?:above|over|older than)\s+(\d+)/);
  if (aboveMatch) {
    filters.min_age = toInt(aboveMatch[1]);
  }

  // "below N" / "under N" / "younger than N"
  const belowMatch = q.match(/(?:below|under|younger than)\s+(\d+)/);
  if (belowMatch) {
    filters.max_age = toInt(belowMatch[1]);
  }

  // "between N and M"
  const betweenMatch = q.match(/between\s+(\d+)\s+and\s+(\d+)/);
  if (betweenMatch) {
    filters.min_age = toInt(betweenMatch[1]);
    filters.max_age = toInt(betweenMatch[2]);
  }

  // "aged N" / "age N"
  const agedMatch = q.match(/\baged?\s+(\d+)\b/);
  if (agedMatch) {
    filters.min_age = toInt(agedMatch[1]);
    filters.max_age = toInt(agedMatch[1]);
  }

  //  Country
  // "from [country]" or "in [country]"
  const countryMatch = q.match(/(?:from|in)\s+([a-z\s]+?)(?:\s+(?:above|below|over|under|older|younger|aged|between|who|with|and)|$)/);
  if (countryMatch) {
    const countryName = countryMatch[1].trim();
    const code        = getCountryCode(countryName);
    if (code) filters.country_id = code;
  }

  // Determine if anything was interpreted 
  const interpreted = Object.keys(filters).length > 0;

  return { filters, interpreted };
}

module.exports = { parseQuery };
