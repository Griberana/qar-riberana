// Basecamp regresa aquí con ?code=... ; se intercambia por el token permanente y se muestra para copiarlo a Vercel.
module.exports = async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Falta el código de autorización.');
  const q = new URLSearchParams({
    type: 'web_server', client_id: process.env.BC_CLIENT_ID, client_secret: process.env.BC_CLIENT_SECRET,
    redirect_uri: `${process.env.APP_URL}/api/bc-callback`, code,
  });
  const r = await fetch('https://launchpad.37signals.com/authorization/token?' + q, { method: 'POST' });
  const j = await r.json();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!j.refresh_token) return res.status(400).send('<pre>No se obtuvo el token:\n' + JSON.stringify(j, null, 2) + '</pre>');
  res.send(`<!doctype html><meta charset=utf-8><body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px">
<h2>✅ Basecamp autorizado</h2>
<p>Copia este valor y pégalo en Vercel → Settings → Environment Variables con el nombre <b>BC_REFRESH_TOKEN</b>. Después haz <i>Redeploy</i>.</p>
<textarea readonly style="width:100%;height:110px;font-family:monospace" onclick="this.select()">${j.refresh_token}</textarea>
<p style="color:#a00">Es secreto: no lo compartas ni lo envíes por chat. Cierra esta pestaña cuando lo hayas pegado.</p></body>`);
};
