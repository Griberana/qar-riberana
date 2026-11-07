const { sb, auth, canAccess, readBody, audit } = require('./_lib');

const META = 'id,propiedad,tipo,estado,fecha,supervisor,user_email,score,bc_card_id,bc_url,updated_at,closed_at,published_at';

module.exports = async (req, res) => {
  const me = await auth(req, res); if (!me) return;
  const id = req.query.id, action = req.query.action;

  // ── Listar (solo lo que el usuario puede ver) ──
  if (req.method === 'GET' && !id) {
    let q = sb.from('inspections').select(META + ',data').is('deleted_at', null).order('fecha', { ascending: false }).order('updated_at', { ascending: false }).limit(500);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    const rows = (data || []).filter((r) => canAccess(me, r.propiedad, r.tipo));
    // Supervisores: ven sus borradores y el historial de lo que pueden ver
    return res.json({ inspections: rows });
  }

  if (!id) return res.status(400).json({ error: 'Falta id.' });
  const { data: cur } = await sb.from('inspections').select('*').eq('id', id).maybeSingle();
  if (cur && cur.deleted_at) return res.status(404).json({ error: 'No existe.' });

  if (req.method === 'GET') {
    if (!cur || !canAccess(me, cur.propiedad, cur.tipo)) return res.status(404).json({ error: 'No existe.' });
    return res.json({ inspection: cur });
  }

  // ── Eliminar: solo administrador (borrado lógico con bitácora) ──
  if (req.method === 'DELETE') {
    if (me.rol !== 'admin') return res.status(403).json({ error: 'Solo el administrador puede eliminar inspecciones.' });
    await sb.from('inspections').update({ deleted_at: new Date().toISOString(), deleted_by: me.email }).eq('id', id);
    audit(me.email, 'delete', id, cur ? `${cur.propiedad} ${cur.fecha} ${cur.tipo}` : '');
    return res.json({ ok: true });
  }

  const b = await readBody(req);

  // ── Acciones de estado ──
  if (req.method === 'POST' && action) {
    if (!cur || !canAccess(me, cur.propiedad, cur.tipo)) return res.status(404).json({ error: 'No existe.' });
    if (action === 'close') {
      if (cur.estado !== 'borrador') return res.json({ inspection: cur });
      const upd = { estado: 'cerrada', closed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      if (b.data) { upd.data = b.data; upd.score = b.score ?? cur.score; }
      const { data } = await sb.from('inspections').update(upd).eq('id', id).select().single();
      audit(me.email, 'close', id);
      return res.json({ inspection: data });
    }
    if (action === 'reopen') {
      if (me.rol !== 'admin') return res.status(403).json({ error: 'Solo el administrador puede reabrir.' });
      if (cur.estado === 'publicada') return res.status(400).json({ error: 'Ya está publicada en Basecamp; no se puede reabrir.' });
      const { data } = await sb.from('inspections').update({ estado: 'borrador', closed_at: null, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      audit(me.email, 'reopen', id);
      return res.json({ inspection: data });
    }
    return res.status(400).json({ error: 'Acción desconocida.' });
  }

  // ── Crear / guardar borrador (autosave) ──
  if (req.method === 'PUT') {
    const { propiedad, tipo, fecha, supervisor, data, score } = b;
    if (!['qar', 'diaria'].includes(tipo) || !propiedad) return res.status(400).json({ error: 'Datos inválidos.' });
    if (!canAccess(me, propiedad, tipo)) return res.status(403).json({ error: 'No tienes acceso a esa propiedad / tipo de inspección.' });
    if (cur) {
      if (!canAccess(me, cur.propiedad, cur.tipo)) return res.status(403).json({ error: 'Sin acceso.' });
      if (cur.estado !== 'borrador') return res.status(409).json({ error: 'La inspección está cerrada y no se puede editar.' });
      const { data: row, error } = await sb.from('inspections').update({ propiedad, tipo, fecha, supervisor, data, score, updated_at: new Date().toISOString() }).eq('id', id).select(META).single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ inspection: row });
    }
    const { data: row, error } = await sb.from('inspections').insert({ id, propiedad, tipo, fecha, supervisor, data, score, user_email: me.email }).select(META).single();
    if (error) return res.status(500).json({ error: error.message });
    audit(me.email, 'create', id, `${propiedad} ${tipo}`);
    return res.json({ inspection: row });
  }
  res.status(405).end();
};
