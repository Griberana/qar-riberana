const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// ── Config Basecamp por propiedad (cuenta 5762750; cada hotel es un proyecto) ──
const ACCOUNT = '5762750';
const BC = {
  MX051: { bucket: 36711588, column: 7182928835, mant: 53464183, limp: 46915080, nombre: 'Comfort Inn Monterrey Valle' },
  MX056: { bucket: 36711535, column: 7182913074, mant: 50359961, limp: 46391269, nombre: 'Comfort Inn Tampico' },
  MX061: { bucket: 36711611, column: 7182933951, mant: 46391236, limp: 46391195, nombre: 'Comfort Inn Puerto Vallarta' },
};

// ── PIN y sesión ──
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(String(pin), salt, 32).toString('hex');
}
function checkPin(pin, stored) {
  const [salt, h] = String(stored).split(':');
  const x = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(x, 'hex'));
}
const b64 = (s) => Buffer.from(s).toString('base64url');
function signToken(payload) {
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}
function readToken(tok) {
  if (!tok) return null;
  const [body, sig] = tok.split('.');
  const ok = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(body || '').digest('base64url');
  if (!sig || sig.length !== ok.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(ok))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

// Devuelve el usuario vigente (se relee de la BD: permisos siempre al día)
async function auth(req, res) {
  const tok = (req.headers.authorization || '').replace('Bearer ', '');
  const p = readToken(tok);
  if (p) {
    const { data: u } = await sb.from('users').select('*').eq('email', p.email).maybeSingle();
    if (u && u.activo) return u;
  }
  res.status(401).json({ error: 'No autorizado' });
  return null;
}
const publicUser = (u) => ({ email: u.email, nombre: u.nombre, rol: u.rol, esAdmin: u.rol === 'admin', propiedades: u.propiedades, tipos: u.tipos, activo: u.activo });
const canAccess = (u, propiedad, tipo) =>
  u.rol === 'admin' || ((u.propiedades.includes('ALL') || u.propiedades.includes(propiedad)) && u.tipos.includes(tipo));

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((ok) => {
    let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } });
  });
}
const audit = (actor, action, inspection_id, detail) =>
  sb.from('audit_log').insert({ actor, action, inspection_id, detail }).then(() => {}, () => {});

// ── Basecamp (OAuth: el refresh token no caduca; el access token dura ~2 semanas) ──
let _at = null, _atExp = 0;
async function bcToken() {
  if (_at && Date.now() < _atExp) return _at;
  const q = new URLSearchParams({
    type: 'refresh', refresh_token: process.env.BC_REFRESH_TOKEN,
    client_id: process.env.BC_CLIENT_ID, client_secret: process.env.BC_CLIENT_SECRET,
  });
  const r = await fetch('https://launchpad.37signals.com/authorization/token?' + q, { method: 'POST' });
  const j = await r.json();
  if (!j.access_token) throw new Error('Basecamp: no se pudo renovar el token (' + JSON.stringify(j) + ')');
  _at = j.access_token; _atExp = Date.now() + 6 * 3600 * 1000;
  return _at;
}
async function bcFetch(path, method, body) {
  const url = path.startsWith('http') ? path : `https://3.basecampapi.com/${ACCOUNT}${path}`;
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, {
      method: method || 'GET',
      headers: { Authorization: 'Bearer ' + (await bcToken()), 'Content-Type': 'application/json', 'User-Agent': 'QAR Riberana (' + (process.env.ADMIN_EMAIL || 'admin') + ')' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429) { await new Promise((s) => setTimeout(s, 3000)); continue; }
    if (!r.ok) throw new Error(`Basecamp ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return r.status === 204 ? null : r.json();
  }
  throw new Error('Basecamp: demasiadas solicitudes, reintenta.');
}

module.exports = { sb, BC, ACCOUNT, hashPin, checkPin, signToken, readToken, auth, publicUser, canAccess, readBody, audit, bcFetch };
