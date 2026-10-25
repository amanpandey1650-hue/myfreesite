const { FirecrawlApp } = require('@mendable/firecrawl-js');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST' });
  }
  try {
    if (!process.env.FIRECRAWL_API_KEY) return res.status(503).json({ error: 'Scraper is not configured yet. Add FIRECRAWL_API_KEY in Vercel environment variables.' });
    const target = String((req.body || {}).url || '').trim();
    if (!/^https?:\/\//i.test(target)) return res.status(400).json({ error: 'Provide a valid http(s) URL.' });
    const parsed = new URL(target);
    if (parsed.username || parsed.password) return res.status(400).json({ error: 'URLs with embedded credentials are not allowed.' });
    const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
    const result = await app.scrapeUrl(target, { formats: ['markdown'], onlyMainContent: true });
    const markdown = typeof result.markdown === 'string' ? result.markdown : '';
    return res.status(200).json({
      ok: true,
      url: target,
      title: result.metadata && result.metadata.title ? result.metadata.title : '',
      description: result.metadata && result.metadata.description ? result.metadata.description : '',
      markdown: markdown.slice(0, 50000),
      truncated: markdown.length > 50000
    });
  } catch (error) {
    return res.status(502).json({ error: 'Could not scrape that page. Check the URL, Firecrawl configuration and provider limits.' });
  }
};
