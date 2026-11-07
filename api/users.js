const { sb, hashPin, auth, publicUser, readBody, audit } = require('./_lib');

module.exports = async (req, res) => {
  const me = await auth(req, res); if (!me) return;
  if (me.rol !== 'admin') return res.status(403).json({ error: 'Solo el administrador.' });
  const email = String(req.query.email || '').toLowerCase();

  if (req.method === 'GET') {
    const { data } = await sb.from('users').select('*').order('nombre');
    return res.json({ users: (data || []).map(publicUser) });
  }
  const b = await readBody(req);
  if (req.method === 'POST') {
    const em = String(b.email || '').trim().toLowerCase();
    if (!em || !b.nombre || !/^\d{4,8}$/.test(String(b.pin || ''))) return res.status(400).json({ error: 'Nombre, correo y PIN (4-8 dígitos) son obligatorios.' });
    if (!(b.propiedades || []).length || !(b.tipos || []).length) return res.status(400).json({ error: 'Asigna al menos una propiedad y un tipo de inspección.' });
    const { error } = await sb.from('users').insert({ email: em, nombre: b.nombre.trim(), pin_hash: hashPin(b.pin), rol: 'supervisor', propiedades: b.propiedades, tipos: b.tipos });
    if (error) return res.status(400).json({ error: error.code === '23505' ? 'Ese correo ya existe.' : error.message });
    audit(me.email, 'user_create', null, em);
    return res.json({ ok: true });
  }
  if (req.method === 'PATCH' && email) {
    const upd = {};
    for (const k of ['nombre', 'propiedades', 'tipos', 'activo']) if (b[k] !== undefined) upd[k] = b[k];
    if (b.pin) upd.pin_hash = hashPin(b.pin);
    await sb.from('users').update(upd).eq('email', email);
    audit(me.email, 'user_update', null, email);
    return res.json({ ok: true });
  }
  if (req.method === 'DELETE' && email) {
    if (email === me.email) return res.status(400).json({ error: 'No puedes eliminar tu propio usuario.' });
    await sb.from('users').delete().eq('email', email);
    audit(me.email, 'user_delete', null, email);
    return res.json({ ok: true });
  }
  res.status(405).end();
};
