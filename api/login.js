const { sb, hashPin, checkPin, signToken, readBody, publicUser, audit } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const { email = '', pin = '' } = await readBody(req);
  const em = String(email).trim().toLowerCase();
  if (!em || !pin) return res.status(400).json({ error: 'Completa correo y PIN.' });

  // Primer arranque: si no hay usuarios, el admin se crea con ADMIN_EMAIL / ADMIN_PIN (variables de entorno)
  const { count } = await sb.from('users').select('*', { count: 'exact', head: true });
  if (!count && em === String(process.env.ADMIN_EMAIL || '').toLowerCase() && String(pin) === String(process.env.ADMIN_PIN)) {
    await sb.from('users').insert({ email: em, nombre: 'Administrador', pin_hash: hashPin(pin), rol: 'admin', propiedades: ['ALL'], tipos: ['qar', 'diaria'] });
  }

  const { data: u } = await sb.from('users').select('*').eq('email', em).maybeSingle();
  if (!u || !checkPin(pin, u.pin_hash)) return res.status(401).json({ error: 'Correo o PIN incorrecto.' });
  if (!u.activo) return res.status(403).json({ error: 'Usuario inactivo. Contacta al administrador.' });
  audit(em, 'login');
  res.json({ token: signToken({ email: em, exp: Date.now() + 12 * 3600 * 1000 }), user: publicUser(u) });
};
