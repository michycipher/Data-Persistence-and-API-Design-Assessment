'use strict';

async function fetchJSON(url, apiName) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    const e = new Error(`${apiName} returned an invalid response`);
    e.statusCode = 502;
    e.api = apiName;
    throw e;
  }

  if (!res.ok) {
    const e = new Error(`${apiName} returned an invalid response`);
    e.statusCode = 502;
    e.api = apiName;
    throw e;
  }

  return res.json();
}

function classifyAgeGroup(age) {
  if (age <= 12) return 'child';
  if (age <= 19) return 'teenager';
  if (age <= 59) return 'adult';
  return 'senior';
}

async function enrichName(name) {
  const encoded = encodeURIComponent(name);

  const [genderData, agifyData, nationalizeData] = await Promise.all([
    fetchJSON(`https://api.genderize.io?name=${encoded}`, 'Genderize'),
    fetchJSON(`https://api.agify.io?name=${encoded}`, 'Agify'),
    fetchJSON(`https://api.nationalize.io?name=${encoded}`, 'Nationalize'),
  ]);

  // --- Validate Genderize ---
  if (!genderData.gender || !genderData.count || genderData.count === 0) {
    const e = new Error('Genderize returned an invalid response');
    e.statusCode = 502;
    e.api = 'Genderize';
    throw e;
  }

  // --- Validate Agify ---
  if (agifyData.age === null || agifyData.age === undefined) {
    const e = new Error('Agify returned an invalid response');
    e.statusCode = 502;
    e.api = 'Agify';
    throw e;
  }

  // --- Validate Nationalize ---
  if (
    !nationalizeData.country ||
    !Array.isArray(nationalizeData.country) ||
    nationalizeData.country.length === 0
  ) {
    const e = new Error('Nationalize returned an invalid response');
    e.statusCode = 502;
    e.api = 'Nationalize';
    throw e;
  }

  // Pick country with highest probability
  const topCountry = nationalizeData.country.reduce((best, c) =>
    c.probability > best.probability ? c : best
  );

  return {
    gender: genderData.gender,
    gender_probability: genderData.probability,
    sample_size: genderData.count,
    age: agifyData.age,
    age_group: classifyAgeGroup(agifyData.age),
    country_id: topCountry.country_id,
    country_probability: topCountry.probability,
  };
}

module.exports = { enrichName };
