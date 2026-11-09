const { sb, hashPin, checkPin, signToken, readBody, publicUser, audit } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const faltan = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SESSION_SECRET'].filter((k) => !process.env[k]);
  if (faltan.length) return res.status(500).json({ error: 'Falta configurar en Vercel: ' + faltan.join(', ') });

  const { email = '', pin = '' } = await readBody(req);
  const em = String(email).trim().toLowerCase();
  const pn = String(pin).trim();
  if (!em || !pn) return res.status(400).json({ error: 'Completa correo y PIN.' });

  // El administrador definido en Vercel (ADMIN_EMAIL / ADMIN_PIN) siempre puede entrar:
  // se crea o se actualiza su PIN automáticamente.
  const envEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const envPin = String(process.env.ADMIN_PIN || '').trim();
  if (envEmail && envPin && em === envEmail && pn === envPin) {
    const { error } = await sb.from('users').upsert(
      { email: em, nombre: 'Administrador', pin_hash: hashPin(pn), rol: 'admin', propiedades: ['ALL'], tipos: ['qar', 'diaria'], activo: true },
      { onConflict: 'email' }
    );
    if (error) return res.status(500).json({ error: 'Error de base de datos: ' + error.message });
  }

  const { data: u, error: e2 } = await sb.from('users').select('*').eq('email', em).maybeSingle();
  if (e2) return res.status(500).json({ error: 'Error de base de datos: ' + e2.message });
  if (!u || !checkPin(pn, u.pin_hash)) return res.status(401).json({ error: 'Correo o PIN incorrecto.' });
  if (!u.activo) return res.status(403).json({ error: 'Usuario inactivo. Contacta al administrador.' });
  audit(em, 'login');
  res.json({ token: signToken({ email: em, exp: Date.now() + 12 * 3600 * 1000 }), user: publicUser(u) });
};
