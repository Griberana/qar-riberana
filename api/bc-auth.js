// Paso único: el administrador abre /api/bc-auth para autorizar a Basecamp.
module.exports = (req, res) => {
  const redirect = `${process.env.APP_URL}/api/bc-callback`;
  const q = new URLSearchParams({ type: 'web_server', client_id: process.env.BC_CLIENT_ID, redirect_uri: redirect });
  res.writeHead(302, { Location: 'https://launchpad.37signals.com/authorization/new?' + q });
  res.end();
};
