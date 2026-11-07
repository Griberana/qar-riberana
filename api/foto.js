const { sb, auth, readBody } = require('./_lib');
// Recibe una foto (dataURL ya comprimida en el navegador), la sube a Storage y devuelve la URL pública.
module.exports = async (req, res) => {
  const me = await auth(req, res); if (!me) return;
  if (req.method !== 'POST') return res.status(405).end();
  const { dataUrl, inspectionId } = await readBody(req);
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || '');
  if (!m) return res.status(400).json({ error: 'Imagen inválida.' });
  const ext = m[1].split('/')[1].replace('jpeg', 'jpg');
  const path = `${String(inspectionId || 'x').replace(/[^\w-]/g, '')}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const { error } = await sb.storage.from('qar-fotos').upload(path, Buffer.from(m[2], 'base64'), { contentType: m[1] });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ url: `${process.env.SUPABASE_URL}/storage/v1/object/public/qar-fotos/${path}` });
};
