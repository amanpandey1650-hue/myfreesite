// Vercel serverless endpoint: imports publicly listed institute names and locations
// from the official NIRF Engineering 2025 ranking page. It deliberately does not
// invent fees, eligibility, or placement numbers; those must be verified per institution.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const source = 'https://www.nirfindia.org/Rankings/2025/EngineeringRanking.html';
  try {
    const response = await fetch(source, {
      headers: { 'User-Agent': 'AdmissionWorldCollegeCatalogue/1.0 (educational directory)' }
    });
    if (!response.ok) throw new Error('NIRF returned HTTP ' + response.status);
    const html = await response.text();
    const clean = value => value
      .replace(/<script[\\s\\S]*?<\\/script>/gi, ' ')
      .replace(/<style[\\s\\S]*?<\\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\\s+/g, ' ')
      .trim();

    const colleges = [];
    const rows = html.match(/<tr\\b[^>]*>[\\s\\S]*?<\\/tr>/gi) || [];
    for (const row of rows) {
      const cells = (row.match(/<t[dh]\\b[^>]*>[\\s\\S]*?<\\/t[dh]>/gi) || []).map(clean);
      if (cells.length < 3) continue;
      const text = cells.join(' ');
      // NIRF's ranked tables usually include a rank as the last numeric cell.
      const rankCandidates = cells.map(v => v.match(/^#?\\s*(\\d{1,3})$/)).filter(Boolean);
      const rank = rankCandidates.length ? Number(rankCandidates[rankCandidates.length - 1][1]) : null;
      let name = '';
      let city = '';
      let state = '';
      if (/^IR-E-/.test(cells[0])) {
        name = cells[1] || '';
        city = cells.length >= 4 ? cells[cells.length - 4] : '';
        state = cells.length >= 3 ? cells[cells.length - 3] : '';
      } else if (cells.length >= 3 && !/^(name|institute|institute id|rank)$/i.test(cells[0])) {
        name = cells[0];
        city = cells.length >= 3 ? cells[cells.length - 3] : '';
        state = cells.length >= 2 ? cells[cells.length - 2] : '';
      }
      name = name.replace(/More Details Close/gi, '').trim();
      if (!name || /^(name|institute|institute id|institute name)$/i.test(name)) continue;
      // Avoid injecting links or claiming these are all private colleges: NIRF is a
      // ranking list of participating institutions and includes public institutions too.
      colleges.push({ name, city, state, rank, source });
    }
    const unique = new Map();
    colleges.forEach(c => {
      const key = c.name.toLowerCase();
      if (!unique.has(key)) unique.set(key, c);
    });
    return res.status(200).json({
      source,
      rankingYear: 2025,
      generatedAt: new Date().toISOString(),
      note: 'NIRF participating/ranked engineering institutions; not a complete private-college register. Verify private ownership, current B.Tech approval, fees, entrance requirements and placements with official sources.',
      colleges: Array.from(unique.values())
    });
  } catch (error) {
    return res.status(502).json({
      error: 'Could not retrieve the official NIRF engineering list right now.',
      source,
      detail: error.message,
      colleges: []
    });
  }
};
