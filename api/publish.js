const { sb, BC, auth, canAccess, readBody, audit, bcFetch } = require('./_lib');

// Publica UNA tarjeta por inspección y UNA subtarea (step) por cada hallazgo "NO".
// Es reanudable: si se agota el tiempo, devuelve done:false y el cliente vuelve a llamar.
module.exports = async (req, res) => {
  const me = await auth(req, res); if (!me) return;
  if (req.method !== 'POST') return res.status(405).end();
  const id = req.query.id;
  const { card, steps } = await readBody(req);
  const t0 = Date.now();

  const { data: ins } = await sb.from('inspections').select('*').eq('id', id).maybeSingle();
  if (!ins || ins.deleted_at || !canAccess(me, ins.propiedad, ins.tipo)) return res.status(404).json({ error: 'No existe.' });
  if (ins.estado === 'borrador') return res.status(400).json({ error: 'Cierra la inspección antes de publicar.' });
  if (ins.estado === 'publicada') return res.json({ done: true, url: ins.bc_url, cardId: ins.bc_card_id });
  const cfg = BC[ins.propiedad];
  if (!cfg) return res.status(400).json({ error: 'Propiedad sin configuración de Basecamp.' });
  if (!process.env.BC_REFRESH_TOKEN) return res.status(503).json({ error: 'Basecamp aún no está autorizado (falta BC_REFRESH_TOKEN).' });

  try {
    if (!(steps || []).length) {
      await sb.from('inspections').update({ estado: 'publicada', published_at: new Date().toISOString() }).eq('id', id);
      return res.json({ done: true, total: 0 });
    }
    let cardId = ins.bc_card_id, url = ins.bc_url, done = ins.bc_steps_done || 0;
    if (!cardId) {
      const c = await bcFetch(`/buckets/${cfg.bucket}/card_tables/lists/${cfg.column}/cards.json`, 'POST', { title: String(card.title).slice(0, 250), content: card.content });
      cardId = c.id; url = c.app_url;
      await sb.from('inspections').update({ bc_card_id: cardId, bc_url: url }).eq('id', id);
    }
    const list = steps || [];
    for (let i = done; i < list.length; i++) {
      if (Date.now() - t0 > 48000) return res.json({ done: false, progress: i, total: list.length });
      const s = list[i];
      // Los responsables salen de la configuración del servidor, no del navegador
      const who = s.rol === 'mant' ? cfg.mant : s.rol === 'limp' ? cfg.limp : (s.rol === 'ambos' ? `${cfg.mant},${cfg.limp}` : '');
      await bcFetch(`/buckets/${cfg.bucket}/card_tables/cards/${cardId}/steps.json`, 'POST', { title: String(s.title).slice(0, 250), assignees: String(who) });
      done = i + 1;
      await sb.from('inspections').update({ bc_steps_done: done }).eq('id', id);
    }
    await sb.from('inspections').update({ estado: 'publicada', published_at: new Date().toISOString() }).eq('id', id);
    audit(me.email, 'publish', id, `card ${cardId}, ${list.length} subtareas`);
    res.json({ done: true, url, cardId, total: list.length });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
