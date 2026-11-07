const { auth, publicUser } = require('./_lib');
module.exports = async (req, res) => { const u = await auth(req, res); if (u) res.json({ user: publicUser(u) }); };
