// Minimal tests for the lead handler (run: npm test). No email is sent – RESEND_API_KEY is unset.
const assert = require('assert');
const { handleLead, validate, looksLikeSpam } = require('../lib/lead-handler');

(async () => {
  const good = { name: 'Test Person', phone: '07700 900123', email: 'test@example.com', project: 'Kitchen', consent: true, _t: String(Date.now() - 10000), photos: [{ name: 'a.jpg', data: Buffer.from('hello').toString('base64') }] };

  let r = await handleLead(good, {}, { log: async () => {} });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.ok, true); assert.strictEqual(r.body.results.emailed, false);

  r = await handleLead({ ...good, email: 'nope' }, {});
  assert.strictEqual(r.status, 422); assert.match(r.body.error, /email/i);

  r = await handleLead({ ...good, consent: false }, {});
  assert.strictEqual(r.status, 422);

  r = await handleLead({ ...good, website: 'http://spam' }, {});
  assert.strictEqual(r.body.spam, 'honeypot');

  r = await handleLead({ ...good, _t: String(Date.now()) }, {});
  assert.strictEqual(r.body.spam, 'too-fast');

  // hero callback form has no email
  r = await handleLead({ name: 'Cb', phone: '07700900123', project: 'Kitchen', consent: true, source: 'hero_callback', _t: String(Date.now() - 20000) }, {});
  assert.strictEqual(r.status, 200);

  const v = validate({ name: '<b>x</b>', phone: '0'.repeat(50), photos: [{ name: '../../etc', data: 'aa==' }] });
  assert.strictEqual(v.lead.phone.length, 40); assert.strictEqual(v.lead.photos[0].filename, '.._.._etc.jpg');
  assert.strictEqual(looksLikeSpam({}, { message: '' }), null);

  // when a mail provider is configured but unreachable, the user gets a clear failure not a silent success
  const origFetch = global.fetch; global.fetch = async () => ({ ok: false, status: 500, text: async () => 'boom' });
  r = await handleLead(good, { RESEND_API_KEY: 'x' });
  assert.strictEqual(r.status, 502);
  global.fetch = origFetch;

  console.log('lead-handler tests passed');
})().catch(e => { console.error(e); process.exit(1); });
