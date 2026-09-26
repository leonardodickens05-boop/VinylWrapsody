# Vinyl Wrapsody – conversion audit and what the rebuild changes

Reviewed 26 Sep 2026 against https://www.vinylwrapsody.com (WordPress + Beaver Builder + Gravity Forms). Every page, desktop and mobile, was fetched and rendered in a real browser.

## The big one: there is no way to send an enquiry

Every "Get a quote", "Contact us" and "Arrange a visit" button on the site (11 of them on the homepage alone) links to `/contact/#form`. That section on the contact page contains **no form**. Gravity Forms' CSS and reCAPTCHA scripts load on every page, so a form was configured at some point, but the form itself is not rendered anywhere. A visitor who clicks the main call to action lands on a page that only shows a phone number and an email address. One of the Google reviews says "Got a call within an hour after submitting my details online", so this used to work and is currently broken. This alone is likely costing most of the site's leads.

## Other lead leaks found

1. **Phone number is hidden on desktop.** The number only appears in the footer and on the contact page. Mobile gets a floating call button (third-party "Call Now Button" plugin); desktop gets nothing in the header.
2. **No WhatsApp path.** Trades customers love sending a photo on WhatsApp. The site has a WhatsApp icon in the footer only.
3. **Contact page meta description advertises a different phone number** (020 3633 8287) from the one on the site (07770 673766). Whichever is wrong is losing calls from Google.
4. **No trust signals above the fold.** The 5-star Google reviews, 10-year guarantee, 15 years' experience, 3M DI-NOC and Cover Styl' materials and the Home Builder Awards 2026 win are all buried well down the page.
5. **Nothing answers price or time objections.** No FAQ, no "from" prices, no "how long does it take". The most common reasons people don't enquire go unaddressed.
6. **Before/after photos exist but aren't used as before/after.** The Basingstoke page has real before and after pairs (hotel bedroom, Wimbledon cubicles) shown as unlabeled thumbnails. This is the single most persuasive asset a wrapping company has.
7. **Dead controls.** "Load More" in every gallery links to `#` and does nothing. Client logos are not links. "Scroll down for more" takes space in the hero.
8. **reCAPTCHA badge floats over the hero** on every page, for a form that doesn't exist.
9. **No thank-you page and no conversion tracking.** GA4 is installed but nothing is marked as a conversion, so ad spend can't be measured against leads.
10. **Performance.** 31 script tags and ~150 KB of HTML per page, 2–3 MB hero photos, WordPress emoji SVGs used for flag icons. Slow on mobile, where most local-service traffic comes from.
11. **No structured data for the business.** Yoast outputs WebPage/WebSite schema only; no LocalBusiness, opening hours, service area or FAQ schema for the map pack and rich results.
12. **Duplicate content across location pages.** Basingstoke/Guildford/Woking share the same gallery, testimonials and most copy with ugly URLs like `/commercial-vinyl-wrapping-guildford-vinyl-wrapping-guildford/`.
13. **South Africa contact details given equal weight** to the UK ones in the footer and contact page, which is confusing for a UK visitor.

## What the rebuild does

**Lead capture (the request)**
- A full quote form on every page (inline section near the bottom, plus a pop-up from every "Get a quote" button). Fields: project type, name, phone, email, postcode, rough size for kitchens, message, up to three photos, preferred contact method, consent. Photos are compressed in the browser so the request stays small.
- A 3-field "Quick quote" callback box in the homepage hero for people who won't fill in a long form.
- Sticky mobile bar with Call, WhatsApp and Get a quote; phone number and WhatsApp in the desktop header.
- Enquiries are emailed to the business with the photos attached and a reply-to set to the customer, the customer gets an automatic confirmation email, and optionally every lead is pushed to a webhook (Google Sheet / CRM). Spam is filtered with a honeypot and a timing check, no reCAPTCHA badge.
- A thank-you page that fires a `generate_lead` conversion. Call and WhatsApp taps are tracked as events too.

**Persuasion**
- Trust bar under every hero: Google rating, 15+ years, 10-year guarantee, 50–70% saving, award badge.
- Interactive before/after sliders on the home, kitchen, commercial and location pages using the business's own photos.
- Reviews rewritten as short cards with star ratings and the project type.
- FAQ answering cost, time, what can be wrapped, durability, finishes and coverage, with FAQ schema.
- Benefit-led headlines ("Your kitchen, brand new in 2–3 days") instead of "Premium Kitchen Vinyl Wrapping".

**Technical / SEO**
- Static HTML, two small scripts, no WordPress, compressed images (18 MB to 7.8 MB). Loads in a fraction of the time.
- LocalBusiness schema with address, hours, service area; FAQ schema; sitemap; robots; canonical URLs; clean location URLs with 301 redirects from the old ones.
- Unique copy per location page from a single template (`src/data/locations.json`), so adding Farnham or Windsor is a 10-line change.
- Consistent phone number everywhere, pulled from one config file.

## Suggested next steps (not built)

- Publish indicative pricing ("kitchens from £X") once the business is comfortable; it is the strongest remaining lever.
- Pull live Google review count/rating via the Places API or a review widget.
- Add a short "meet Carl and Tom" section with photos; the reviews mention them by name and people buy from people.
- Run Google Ads to the kitchen page with `generate_lead` as the conversion and the postcode field to qualify by area.
