function generateCSV(data) {
  if (!data || data.length === 0) return '';

  const headers = [
    'id',
    'name',
    'gender',
    'gender_probability',
    'age',
    'age_group',
    'country_id',
    'country_name',
    'country_probability',
    'created_at',
  ];

  const rows = data.map((row) =>
    [
      row.id,
      row.name,
      row.gender,
      row.gender_probability,
      row.age,
      row.age_group,
      row.country_id,
      row.country_name,
      row.country_probability,
      row.created_at,
    ].join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

module.exports = { generateCSV };