# Vinyl Wrapsody – website rebuild with lead capture

A fast, dependency-free rebuild of [vinylwrapsody.com](https://www.vinylwrapsody.com) focused on turning visitors into enquiries. See `CONVERSION-AUDIT.md` for what was wrong with the original and what changed.

## What's in the box

| Path | What it is |
| --- | --- |
| `src/pages/*.html` | Page content (home, kitchen, commercial, contact, thank-you, privacy, 404, and one `location.html` template) |
| `src/partials/*.html` | Shared pieces: header, footer, quote form, trust bar, testimonials, FAQ, process |
| `src/data/site.json` | Phone, email, address, hours, GA ID, social links – **edit this to change contact details everywhere** |
| `src/data/locations.json` | One entry per location page (Basingstoke, Guildford, Woking). Add an object to add a town. |
| `build.js` | Builds `src/` into `public/` (no npm packages needed) |
| `public/` | The finished website. Deploy this folder to any static host. |
| `lib/lead-handler.js` | Validates a quote request, blocks spam, emails the business, auto-replies to the customer |
| `netlify/functions/lead.js` | Serverless endpoint `/api/lead` for Netlify |
| `server.js` | Plain Node server for local preview or a VPS (serves `public/` + `/api/lead`, logs leads to `data/leads.jsonl`) |

## Run it locally

```bash
npm run dev        # builds the site and serves it at http://localhost:8080
npm test           # runs the lead-handler tests
```

Without `RESEND_API_KEY` set, enquiries are written to `data/leads.jsonl` and printed in the terminal instead of emailed.

## Deploy (recommended: Netlify, free)

1. Push this repo to GitHub and click **Add new site → Import an existing project** in Netlify. `netlify.toml` already sets the build command, publish folder and the `/api/lead` function.
2. Create a free account at [resend.com](https://resend.com), add and verify the `vinylwrapsody.com` domain (two DNS records), and create an API key.
3. In Netlify: **Site settings → Environment variables**, add:
   - `RESEND_API_KEY` – the key from Resend
   - `LEAD_TO_EMAIL` – `info@vinylwrapsody.com` (comma-separate to copy in more people)
   - `LEAD_FROM_EMAIL` – `Vinyl Wrapsody Website <quotes@vinylwrapsody.com>`
   - optional `LEAD_WEBHOOK_URL` – a Zapier/Make webhook if you want every lead in a Google Sheet or CRM
4. Point the domain at Netlify (**Domain management → Add domain**). The old WordPress URLs redirect to the new ones (see `netlify.toml`) so Google rankings carry over.
5. Submit a test enquiry from the live site and check it arrives, with the photo attached and the customer auto-reply.

Any other host works too (Vercel, Cloudflare Pages, a VPS with `npm start`); only the `/api/lead` endpoint needs the small serverless function or `server.js`.

## Editing content

- Text and images: edit the file in `src/pages/` or `src/partials/`, then run `npm run build`.
- New photos: drop them in `public/assets/img/` (keep them under ~400 KB; 1800px wide is plenty).
- Testimonials: `src/partials/testimonials.html`. FAQ: `src/partials/faq.html`.
- Form fields: `src/partials/quote-form-fields.html` (front end) and `lib/lead-handler.js` (what gets emailed).

## Tracking

The existing Google Analytics property (`G-TE60WB7V9N`) is kept. These events fire and can be marked as conversions in GA4 / imported to Google Ads:

- `generate_lead` – quote form or hero callback submitted (also fires on `/thank-you/`)
- `click_call` – any phone number tapped
- `click_whatsapp` – any WhatsApp link tapped
- `open_quote_modal` – quote pop-up opened

## Things to confirm with the business before launch

- The "Rated 5 stars on Google" claim – check the current Google rating and review count and update `src/partials/trust-bar.html` / hero text.
- Timescales ("most kitchens in 2–3 days") and the "50–70% cheaper" figure are taken from the existing site copy and reviews; adjust if needed.
- Publishing indicative prices ("kitchens from £X") usually lifts enquiry rates further; there is a placeholder answer in the FAQ ready for it.
