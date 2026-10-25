const cheerio = require('cheerio');

const SOURCE_URL = 'https://www.nirfindia.org/Rankings/2025/EngineeringRanking.html';
const CACHE_SECONDS = 21600;
let memoryCache = { at: 0, colleges: null };

function normalize(value) {
  return String(value || '').replace(/\\s+/g, ' ').trim();
}

function extractNirf(html) {
  const $ = cheerio.load(html);
  const colleges = [];
  $('table tr').each((_, row) => {
    const cells = $(row).find('th,td').map((__, cell) => normalize($(cell).text())).get();
    if (cells.length < 2) return;
    const joined = cells.join(' ');
    if (/^(rank|institute|institute name|name)\\b/i.test(cells[0])) return;

    // NIRF tables contain a rank and institute name. Pick a likely name cell
    // rather than assuming the same number of columns on every table revision.
    let rank = null;
    let rankIndex = -1;
    for (let i = 0; i < Math.min(3, cells.length); i++) {
      const match = cells[i].match(/^#?\\s*(\\d{1,3})\\s*$/);
      if (match) { rank = Number(match[1]); rankIndex = i; break; }
    }
    let name = '';
    if (rankIndex >= 0) {
      name = cells.slice(rankIndex + 1).find(v => v && !/^view details$/i.test(v)) || '';
    } else {
      name = cells.find((v, i) => i > 0 && v && /[a-z]{3}/i.test(v)) || '';
    }
    name = normalize(name.replace(/more details|close/gi, ''));
    if (!name || name.length < 4 || /^https?:/i.test(name)) return;

    // City/state columns differ by NIRF table. Only expose a value if it can be
    // identified conservatively; never fabricate a location or institution data.
    const tail = cells.slice(-3);
    const city = tail.length >= 3 ? tail[tail.length - 2] : '';
    const state = tail.length >= 2 ? tail[tail.length - 1] : '';
    colleges.push({
      name,
      city: city && city.length < 80 ? city : '',
      state: state && state.length < 80 ? state : '',
      rank,
      source: SOURCE_URL,
      sourceYear: 2025,
      website: '',
      fees: null,
      eligibility: null,
      entranceExams: [],
      placementStats: null,
      verifiedAt: null
    });
  });

  const unique = new Map();
  for (const college of colleges) {
    const key = college.name.toLocaleLowerCase();
    if (!unique.has(key)) unique.set(key, college);
  }
  return [...unique.values()];
}

async function getColleges() {
  if (memoryCache.colleges && Date.now() - memoryCache.at < CACHE_SECONDS * 1000) {
    return memoryCache.colleges;
  }
  const response = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'AdmissionWorldCollegeCatalogue/1.0 (+https://admissionworld.vercel.app)' },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error('NIRF source returned HTTP ' + response.status);
  const html = await response.text();
  const colleges = extractNirf(html);
  if (!colleges.length) throw new Error('Could not parse institution rows from NIRF source');
  memoryCache = { at: Date.now(), colleges };
  return colleges;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    let colleges = await getColleges();
    const query = normalize(req.query.q).toLocaleLowerCase();
    const state = normalize(req.query.state).toLocaleLowerCase();
    const limit = Math.min(500, Math.max(1, Number.parseInt(req.query.limit || '250', 10) || 250));
    if (query) colleges = colleges.filter(c =>
      [c.name, c.city, c.state].join(' ').toLocaleLowerCase().includes(query));
    if (state) colleges = colleges.filter(c => (c.state || '').toLocaleLowerCase() === state);
    colleges = colleges.slice(0, limit);

    return res.status(200).json({
      ok: true,
      source: SOURCE_URL,
      sourceYear: 2025,
      fetchedAt: new Date().toISOString(),
      total: colleges.length,
      filters: { q: query || null, state: state || null, limit },
      note: 'This is a ranking-source import, not a complete list of private B.Tech colleges. Fees, eligibility, entrance exams, and placement statistics are not inferred; verify these from each institution’s official pages.',
      colleges
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: 'College data source is temporarily unavailable.',
      source: SOURCE_URL,
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
      colleges: []
    });
  }
};
