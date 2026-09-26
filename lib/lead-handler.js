/**
 * Shared lead handler – used by both the Netlify function (netlify/functions/lead.js)
 * and the plain Node server (server.js). Zero dependencies.
 *
 * Flow: validate -> spam checks -> email the business (Resend) -> auto-reply to the customer
 *       -> optional webhook (Zapier / Make / Google Sheets / CRM) -> optional local log.
 *
 * Environment variables:
 *   RESEND_API_KEY   API key from https://resend.com (free tier is plenty for a local business)
 *   LEAD_TO_EMAIL    where enquiries go, comma-separated allowed   (default info@vinylwrapsody.com)
 *   LEAD_FROM_EMAIL  verified sender, e.g. "Vinyl Wrapsody <quotes@vinylwrapsody.com>"
 *   LEAD_WEBHOOK_URL optional – JSON POST of every lead (e.g. a Zapier/Make hook feeding a Google Sheet)
 *   LEAD_LOG_FILE    optional – append every lead as JSON lines to this file (server.js default: data/leads.jsonl)
 *   SEND_AUTOREPLY   "false" to disable the customer confirmation email (default on)
 */
'use strict';

const BUSINESS = {
  name: 'Vinyl Wrapsody',
  phone: '07770 673 766',
  phoneIntl: '+447770673766',
  email: 'info@vinylwrapsody.com',
  site: 'https://www.vinylwrapsody.com',
};
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // per photo, after client-side compression
const MAX_TOTAL_BYTES = 5 * 1024 * 1024;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function clean(v, max = 500) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function validate(body) {
  const lead = {
    name: clean(body.name, 120),
    phone: clean(body.phone, 40),
    email: clean(body.email, 160).toLowerCase(),
    postcode: clean(body.postcode, 12).toUpperCase(),
    project: clean(body.project, 60) || 'Not specified',
    size: clean(body.size, 40),
    contactPref: clean(body.contact_pref, 40),
    message: clean(body.message, 4000),
    page: clean(body.page, 300),
    referrer: clean(body.referrer, 300),
    utm: clean(body.utm, 300),
    source: clean(body.source, 40) || 'website',
    consent: body.consent === true || body.consent === 'true' || body.consent === 'on',
    photos: [],
  };
  const errors = [];
  if (lead.name.length < 2) errors.push('Please enter your name.');
  if (lead.phone.replace(/\D/g, '').length < 10) errors.push('Please enter a valid phone number.');
  if (lead.source !== 'hero_callback' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) errors.push('Please enter a valid email address.');
  if (!lead.consent) errors.push('Please tick the consent box so we can contact you.');

  const photos = Array.isArray(body.photos) ? body.photos.slice(0, MAX_PHOTOS) : [];
  let total = 0;
  for (const p of photos) {
    if (!p || typeof p.data !== 'string') continue;
    const bytes = Math.floor(p.data.length * 0.75);
    if (bytes > MAX_PHOTO_BYTES) { errors.push('One of the photos is too large.'); continue; }
    total += bytes;
    if (total > MAX_TOTAL_BYTES) { errors.push('Photos are too large in total.'); break; }
    const name = clean(p.name, 80).replace(/[^\w.\-]/g, '_') || 'photo.jpg';
    lead.photos.push({ filename: name.endsWith('.jpg') ? name : name + '.jpg', content: p.data.replace(/[^A-Za-z0-9+/=]/g, '') });
  }
  return { lead, errors };
}

/** Cheap, invisible spam checks: honeypot field + form filled in under 3 seconds. */
function looksLikeSpam(body, lead) {
  if (body.website) return 'honeypot';
  const t = Number(body._t || 0);
  if (t && Date.now() - t < 3000) return 'too-fast';
  if (/https?:\/\/\S+.*https?:\/\/\S+.*https?:\/\//s.test(lead.message)) return 'links';
  return null;
}

function leadToHtml(lead, when) {
  const row = (k, v) => v ? `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:6px 0">${v}</td></tr>` : '';
  const tel = lead.phone.replace(/\D/g, '');
  return `<!doctype html><body style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
<h2 style="margin:0 0 4px">New quote request: ${esc(lead.project)}</h2>
<p style="margin:0 0 16px;color:#666">${esc(when)} · via ${esc(lead.source)}</p>
<table style="border-collapse:collapse;font-size:15px">
${row('Name', esc(lead.name))}
${row('Phone', `<a href="tel:${esc(tel)}">${esc(lead.phone)}</a> &nbsp; <a href="https://wa.me/${tel.replace(/^0/, '44')}">WhatsApp</a>`)}
${row('Email', lead.email ? `<a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a>` : '')}
${row('Postcode', esc(lead.postcode))}
${row('Project', esc(lead.project))}
${row('Size', esc(lead.size))}
${row('Prefers', esc(lead.contactPref))}
${row('Message', esc(lead.message).replace(/\n/g, '<br>'))}
${row('Photos', lead.photos.length ? `${lead.photos.length} attached` : '')}
${row('Page', esc(lead.page))}
${row('Referrer', esc(lead.referrer))}
${row('UTM', esc(lead.utm))}
</table>
<p style="margin-top:20px;font-size:13px;color:#888">Reply to this email to respond to the customer directly.</p></body>`;
}

function autoReplyHtml(lead) {
  const first = esc(lead.name.split(' ')[0]);
  return `<!doctype html><body style="font-family:Arial,sans-serif;color:#111;line-height:1.6;max-width:600px">
<h2 style="font-weight:400">Thanks ${first}, we've got your enquiry</h2>
<p>One of the team will be in touch within one working day, usually much sooner, to talk through your ${esc(lead.project.toLowerCase())} project.</p>
<p><strong>What happens next</strong></p>
<ol><li>We review your details${lead.photos.length ? ' and photos' : ''} and prepare a price guide.</li>
<li>We arrange a free visit with samples so you can see finishes in your own space.</li>
<li>You get a fixed quote and available installation dates.</li></ol>
<p>Need us sooner? Call <a href="tel:${BUSINESS.phoneIntl}">${BUSINESS.phone}</a> or reply to this email.</p>
<p style="color:#888;font-size:13px">${BUSINESS.name} · 39 Rudgard Way, Liphook, Hampshire, GU30 7GW · <a href="${BUSINESS.site}">${BUSINESS.site.replace('https://', '')}</a></p></body>`;
}

async function sendResend(msg, apiKey) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/**
 * @param {object} body  parsed JSON body from the browser
 * @param {object} env   process.env (or a subset)
 * @param {object} [opts] { log: fn(line) }  optional lead logger
 * @returns {{status:number, body:object}}
 */
async function handleLead(body, env, opts = {}) {
  if (!body || typeof body !== 'object') return { status: 400, body: { ok: false, error: 'Invalid request' } };
  const { lead, errors } = validate(body);
  if (errors.length) return { status: 422, body: { ok: false, error: errors.join(' ') } };

  const spam = looksLikeSpam(body, lead);
  if (spam) return { status: 200, body: { ok: true, spam } }; // pretend success so bots stop retrying

  const when = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' });
  const record = Object.assign({}, lead, { photos: lead.photos.map(p => p.filename), receivedAt: new Date().toISOString() });
  if (opts.log) { try { await opts.log(record); } catch (e) { console.error('lead log failed', e); } }

  const to = (env.LEAD_TO_EMAIL || BUSINESS.email).split(',').map(s => s.trim()).filter(Boolean);
  const from = env.LEAD_FROM_EMAIL || `${BUSINESS.name} Website <onboarding@resend.dev>`;
  const results = { emailed: false, autoReplied: false, webhook: false };

  if (env.RESEND_API_KEY) {
    try {
      await sendResend({
        from, to,
        reply_to: lead.email || undefined,
        subject: `New ${lead.project} quote request from ${lead.name}${lead.postcode ? ' (' + lead.postcode + ')' : ''}`,
        html: leadToHtml(lead, when),
        attachments: lead.photos.map(p => ({ filename: p.filename, content: p.content })),
      }, env.RESEND_API_KEY);
      results.emailed = true;
    } catch (e) {
      console.error('lead email failed', e);
      return { status: 502, body: { ok: false, error: 'Could not send your enquiry right now' } };
    }
    if (lead.email && env.SEND_AUTOREPLY !== 'false') {
      try {
        await sendResend({ from, to: [lead.email], reply_to: to[0], subject: `Thanks ${lead.name.split(' ')[0]}, we've got your enquiry – ${BUSINESS.name}`, html: autoReplyHtml(lead) }, env.RESEND_API_KEY);
        results.autoReplied = true;
      } catch (e) { console.error('auto-reply failed', e); }
    }
  } else {
    console.warn('RESEND_API_KEY not set – lead logged only:', JSON.stringify(record));
  }

  if (env.LEAD_WEBHOOK_URL) {
    try {
      const r = await fetch(env.LEAD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
      results.webhook = r.ok;
    } catch (e) { console.error('webhook failed', e); }
  }

  return { status: 200, body: { ok: true, results } };
}

module.exports = { handleLead, validate, looksLikeSpam, leadToHtml, autoReplyHtml, BUSINESS };
