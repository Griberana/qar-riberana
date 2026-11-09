// Diagnóstico: abre /api/health para ver qué variable falta. No muestra ningún valor secreto.
module.exports = async (req, res) => {
  const vars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SESSION_SECRET', 'ADMIN_EMAIL', 'ADMIN_PIN', 'APP_URL', 'BC_CLIENT_ID', 'BC_CLIENT_SECRET', 'BC_REFRESH_TOKEN'];
  const out = { variables: {}, supabase: null };
  for (const k of vars) out.variables[k] = process.env[k] ? 'ok' : 'FALTA';
  const url = process.env.SUPABASE_URL || '';
  out.supabase_url_formato = /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) ? 'ok' : 'revisar (debe ser https://xxxx.supabase.co sin diagonal ni texto extra)';
  try {
    const { sb } = require('./_lib');
    const { count, error } = await sb.from('users').select('*', { count: 'exact', head: true });
    out.supabase = error ? 'ERROR: ' + error.message : 'conectado, usuarios: ' + count;
  } catch (e) { out.supabase = 'ERROR: ' + e.message; }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(out, null, 2));
};
