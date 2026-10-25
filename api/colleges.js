// Nationwide B.Tech/engineering catalogue backed by the open-source Indian Colleges
// dataset, which republishes public AICTE institution/course records.
// Upstream project/API: https://github.com/anburocky3/indian-colleges-data
const UPSTREAM = 'https://indian-colleges-list.vercel.app/api/institutions';
const SOURCE_REPO = 'https://github.com/anburocky3/indian-colleges-data';
const CACHE_MS = 6 * 60 * 60 * 1000;
let cache = { at: 0, records: null };

const text = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const isEngineering = p => {
  const course = text(p.course || p.programme || p.program || p.name).toLowerCase();
  const level = text(p.level).toLowerCase();
  const type = text(p.programme || p.program || '').toLowerCase();
  return /(b\.?tech|bachelor of technology|engineering and technology|computer science|mechanical engineering|civil engineering|electrical engineering|electronics|information technology)/i.test(course + ' ' + type)
    && (!level || /under.?graduate|ug|degree|bachelor/i.test(level));
};
const isPrivate = item => /private|self.?financ/i.test(text(item.institution_type || item.management || item.type));

function normalizeInstitution(item) {
  const programmes = Array.isArray(item.programmes) ? item.programmes : (Array.isArray(item.courses) ? item.courses : []);
  const relevant = programmes.filter(isEngineering);
  const address = text(item.address);
  const parts = address.split(',').map(text).filter(Boolean);
  const name = text(item.institute_name || item.name || item.institution_name);
  if (!name) return null;
  return {
    id: text(item.aicte_id || item.id || item.other_id),
    name,
    city: text(item.city || item.town || item.district || parts[parts.length - 1] || ''),
    state: text(item.state || item.state_name || ''),
    district: text(item.district || ''),
    address,
    university: text(item.university || item.affiliating_university || ''),
    institutionType: text(item.institution_type || item.management || item.type || 'Not listed'),
    private: isPrivate(item),
    programmes: relevant.map(p => ({
      course: text(p.course || p.programme || p.program || p.name),
      level: text(p.level),
      intake: text(p.intake),
      availability: text(p.availability),
      approvalYear: text(p.year || p.academic_year)
    })),
    website: text(item.website || item.url || ''),
    fees: null,
    eligibility: null,
    entranceExams: [],
    placementStats: null,
    dataSource: 'AICTE public records via Indian Colleges dataset',
    sourceUrl: SOURCE_REPO,
    lastVerified: null,
    verificationNote: 'College identity/course listing comes from the dataset. Fees, admission eligibility, entrance exams and placements need verification from the official college website.'
  };
}

async function loadAll() {
  if (cache.records && Date.now() - cache.at < CACHE_MS) return cache.records;
  const response = await fetch(UPSTREAM, {
    headers: { 'User-Agent': 'AdmissionWorldCollegeCatalogue/1.0' },
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) throw new Error('College dataset API returned HTTP ' + response.status);
  const json = await response.json();
  const raw = Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : Array.isArray(json.institutions) ? json.institutions : []);
  if (!raw.length) throw new Error('Dataset API returned no institution records');
  const normalized = raw.map(normalizeInstitution).filter(Boolean);
  // Prefer records whose course catalogue includes an engineering/B.Tech programme.
  const engineering = normalized.filter(c => c.programmes.length > 0);
  const selected = engineering.length ? engineering : normalized;
  const unique = new Map();
  for (const item of selected) {
    const key = (item.id || item.name + '|' + item.state).toLowerCase();
    if (!unique.has(key)) unique.set(key, item);
  }
  cache = { at: Date.now(), records: [...unique.values()] };
  return cache.records;
}

async function requireUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const response = await fetch(url.replace(/\\/$/, '') + '/auth/v1/user', {
    headers: { apikey: anon, Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) return null;
  return response.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Use GET' });
  }
  try {
    const user = await requireUser(req);
    if (!user || !user.id) return res.status(401).json({ ok: false, error: 'Login required' });
    let records = await loadAll();
    const q = text(req.query.q).toLowerCase();
    const state = text(req.query.state).toLowerCase();
    const type = text(req.query.type).toLowerCase();
    const privateOnly = req.query.private === 'true' || req.query.private === '1';
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '250', 10) || 250));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);
    if (q) records = records.filter(c => [c.name,c.city,c.state,c.district,c.address,c.university,...c.programmes.map(p=>p.course)].join(' ').toLowerCase().includes(q));
    if (state) records = records.filter(c => c.state.toLowerCase() === state || c.state.toLowerCase().includes(state));
    if (privateOnly) records = records.filter(c => c.private);
    if (type) records = records.filter(c => c.institutionType.toLowerCase().includes(type));
    const total = records.length;
    const page = records.slice(offset, offset + limit);
    return res.status(200).json({
      ok: true,
      source: SOURCE_REPO,
      upstream: UPSTREAM,
      fetchedAt: new Date(cache.at).toISOString(),
      total,
      count: page.length,
      offset,
      limit,
      filters: { q: q || null, state: state || null, type: type || null, private: privateOnly },
      note: 'This directory is based on publicly available AICTE institution/course records in a community-maintained dataset. It is not a guarantee that every institution is currently approved or currently offers B.Tech. Check the current AICTE approval and college admissions page. Fees, eligibility, entrance exams and placement statistics are not fabricated and must be verified from official sources.',
      colleges: page
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: 'The nationwide college dataset is temporarily unavailable.',
      source: SOURCE_REPO,
      colleges: []
    });
  }
};
