const { sb, BC, auth, canAccess, readBody, audit, bcFetch, bcUpload } = require('./_lib');

// Adjunta un PDF en Basecamp.
//  · ?id=<inspección>            → comentario con el PDF en la tarjeta de esa inspección
//  · ?propiedad=MX051&title=...  → tarjeta nueva (reporte consolidado) con el PDF dentro
module.exports = async (req, res) => {
  const me = await auth(req, res); if (!me) return;
  if (req.method !== 'POST') return res.status(405).end();
  const { name, base64, nota } = await readBody(req);
  if (!name || !base64) return res.status(400).json({ error: 'Falta el archivo.' });
  const buf = Buffer.from(base64, 'base64');
  if (buf.length > 3.2 * 1024 * 1024) return res.status(413).json({ error: 'El PDF pesa demasiado (' + Math.round(buf.length / 1024) + ' KB).' });
  if (!process.env.BC_REFRESH_TOKEN) return res.status(503).json({ error: 'Basecamp aún no está autorizado.' });
  const safe = String(name).replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ]/g, '_').slice(0, 120);
  const html = (sgid) => `<p>${nota || '📎 ' + safe}</p><bc-attachment sgid="${sgid}"></bc-attachment>`;
  try {
    if (req.query.id) {
      const { data: ins } = await sb.from('inspections').select('*').eq('id', req.query.id).maybeSingle();
      if (!ins || ins.deleted_at || !canAccess(me, ins.propiedad, ins.tipo)) return res.status(404).json({ error: 'No existe.' });
      if (!ins.bc_card_id) return res.status(400).json({ error: 'La inspección aún no tiene tarjeta en Basecamp.' });
      const cfg = BC[ins.propiedad];
      const sgid = await bcUpload(safe, buf, 'application/pdf');
      await bcFetch(`/buckets/${cfg.bucket}/recordings/${ins.bc_card_id}/comments.json`, 'POST', { content: html(sgid) });
      audit(me.email, 'attach', ins.id, safe);
      return res.json({ ok: true });
    }
    const prop = req.query.propiedad, cfg = BC[prop];
    if (!cfg || !(me.rol === 'admin' || me.propiedades.includes('ALL') || me.propiedades.includes(prop))) return res.status(403).json({ error: 'Sin acceso a esa propiedad.' });
    const sgid = await bcUpload(safe, buf, 'application/pdf');
    const c = await bcFetch(`/buckets/${cfg.bucket}/card_tables/lists/${cfg.column}/cards.json`, 'POST', {
      title: String(req.query.title || 'Reporte Dashboard').slice(0, 250), content: html(sgid),
    });
    audit(me.email, 'report_card', null, `${prop} ${c.id}`);
    return res.json({ ok: true, url: c.app_url });
  } catch (e) { res.status(502).json({ error: e.message }); }
};
