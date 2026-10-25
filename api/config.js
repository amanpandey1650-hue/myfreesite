// Public browser configuration only. Set these environment variables in Vercel.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const url = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  return res.status(200).json({
    configured: Boolean(url && anonKey),
    supabaseUrl: url,
    supabaseAnonKey: anonKey
  });
};
