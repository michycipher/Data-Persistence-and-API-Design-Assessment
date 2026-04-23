'use strict';

const { getCountryCode } = require('./countries');

// Helpers 

function toInt(str) {
  const n = parseInt(str, 10);
  return isNaN(n) ? null : n;
}

// Test a word-boundary regex against a lowercased string
function has(pattern, str) {
  return pattern.test(str);
}

// Gender detection 

const MALE_RE   = /\b(male|males|man|men)\b/;
const FEMALE_RE = /\b(female|females|woman|women|girl|girls)\b/;

function extractGender(q) {
  const isMale   = MALE_RE.test(q);
  const isFemale = FEMALE_RE.test(q);
  if (isMale && isFemale) return null;   // both -> no gender filter
  if (isMale)   return 'male';
  if (isFemale) return 'female';
  return null;
}

// Age group / young detection

function extractAgeGroup(q) {
  // "young" is a special case — maps to a min/max range, not a stored group
  if (/\byoung\b/.test(q))                              return { min_age: 16, max_age: 24 };
  if (/\b(teenager|teenagers|teen|teens)\b/.test(q))    return { age_group: 'teenager' };
  if (/\b(adult|adults)\b/.test(q))                     return { age_group: 'adult' };
  if (/\b(senior|seniors|elderly)\b/.test(q))           return { age_group: 'senior' };
  if (/\b(child|children|kids|kid)\b/.test(q))          return { age_group: 'child' };
  return null;
}

// Age qualifiers

function extractAgeRange(q) {
  const result = {};

  // "between N and M"  (check first — more specific)
  const between = q.match(/\bbetween\s+(\d+)\s+and\s+(\d+)\b/);
  if (between) {
    result.min_age = toInt(between[1]);
    result.max_age = toInt(between[2]);
    return result;
  }

  // "above N" / "over N" / "older than N"
  const above = q.match(/\b(?:above|over|older\s+than)\s+(\d+)\b/);
  if (above) result.min_age = toInt(above[1]);

  // "below N" / "under N" / "younger than N"
  const below = q.match(/\b(?:below|under|younger\s+than)\s+(\d+)\b/);
  if (below) result.max_age = toInt(below[1]);

  // "aged N" / "age N"
  const aged = q.match(/\baged?\s+(\d+)\b/);
  if (aged) {
    result.min_age = toInt(aged[1]);
    result.max_age = toInt(aged[1]);
  }

  return result;
}

// Country extraction

// Stop words that signal the country name has ended
const STOP_WORDS = ['above', 'below', 'over', 'under', 'older', 'younger',
                    'aged', 'age', 'between', 'who', 'with', 'and', 'or'];
const STOP_RE = new RegExp(`\\b(${STOP_WORDS.join('|')})\\b`);

function extractCountry(q) {
  // Match "from X" or "in X" — greedy capture of everything after the keyword
  const match = q.match(/\b(?:from|in)\s+([a-z][a-z\s]*)/);
  if (!match) return null;

  let raw = match[1].trim();

  // Trim any trailing stop words and what follows them
  const stopIdx = raw.search(STOP_RE);
  if (stopIdx > 0) raw = raw.slice(0, stopIdx).trim();

  // Try the whole remaining string first, then progressively shorter
  // (handles multi-word country names like "south africa")
  const words = raw.split(/\s+/);
  for (let len = words.length; len >= 1; len--) {
    const candidate = words.slice(0, len).join(' ').trim();
    const code = getCountryCode(candidate);
    if (code) return code;
  }

  return null;
}

// Main parser

/**
 * Parse a plain English query into structured filter params.
 *
 * @param {string} query
 * @returns {{ filters: object, interpreted: boolean }}
 */
function parseQuery(query) {
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return { filters: {}, interpreted: false };
  }

  const q       = query.toLowerCase().trim();
  const filters = {};

  // Gender
  const gender = extractGender(q);
  if (gender) filters.gender = gender;

  // Age group / "young"
  const ageGroup = extractAgeGroup(q);
  if (ageGroup) Object.assign(filters, ageGroup);

  // Numeric age qualifiers
  const ageRange = extractAgeRange(q);
  Object.assign(filters, ageRange);

  // Country
  const countryId = extractCountry(q);
  if (countryId) filters.country_id = countryId;

  const interpreted = Object.keys(filters).length > 0;
  return { filters, interpreted };
}

module.exports = { parseQuery };
