/* Vinyl Wrapsody – site behaviour (no dependencies) */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---- analytics helper (GA4 events; safe no-op if gtag is absent) ---- */
  window.vwTrack = function (name, params) {
    try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {}
  };
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-track]');
    if (a) window.vwTrack(a.getAttribute('data-track'), { event_category: 'contact', event_label: location.pathname });
  });

  /* ---- mobile nav ---- */
  var toggle = $('.nav-toggle'), nav = $('#main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
  }
  $$('.sub-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var li = btn.parentElement, open = li.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---- quote modal ---- */
  var modal = $('#quote-modal');
  function openQuote(e) {
    if (!modal || typeof modal.showModal !== 'function') return; // falls back to following the link
    if (e) e.preventDefault();
    modal.showModal();
    window.vwTrack('open_quote_modal', { event_label: location.pathname });
    var first = $('input[name="name"]', modal);
    if (first) setTimeout(function () { first.focus(); }, 50);
  }
  $$('[data-open-quote]').forEach(function (el) {
    // On the contact page the full form is already on screen – scroll instead of opening a modal
    if (document.body.classList.contains('page-contact')) return;
    el.addEventListener('click', openQuote);
  });
  $$('[data-close-quote]').forEach(function (el) { el.addEventListener('click', function () { modal.close(); }); });
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });
  window.vwOpenQuote = openQuote;

  /* ---- before/after sliders ---- */
  $$('[data-before-after]').forEach(function (ba) {
    var range = $('input[type=range]', ba);
    var handle = document.createElement('span');
    handle.className = 'ba-handle'; handle.setAttribute('aria-hidden', 'true'); handle.textContent = '‹ ›';
    ba.appendChild(handle);
    function set(v) { ba.style.setProperty('--pos', v + '%'); ba.style.setProperty('--pos-n', v); }
    set(range.value);
    range.addEventListener('input', function () { set(range.value); });
  });

  /* ---- gallery filters + lightbox ---- */
  $$('[data-filters]').forEach(function (bar) {
    var gallery = bar.closest('.container').querySelector('[data-gallery]');
    $$('button', bar).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('button', bar).forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        var f = b.getAttribute('data-filter');
        $$('a', gallery).forEach(function (a) { a.classList.toggle('is-hidden', f !== 'all' && a.getAttribute('data-cat') !== f); });
      });
    });
  });
  var lb = document.createElement('dialog');
  lb.className = 'lightbox';
  lb.innerHTML = '<button type="button" class="modal-close" aria-label="Close">×</button><img alt="">';
  document.body.appendChild(lb);
  $('.modal-close', lb).addEventListener('click', function () { lb.close(); });
  lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
  $$('[data-gallery] a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (typeof lb.showModal !== 'function') return;
      e.preventDefault();
      var img = $('img', lb); img.src = a.getAttribute('href'); img.alt = ($('img', a) || {}).alt || '';
      lb.showModal();
    });
  });

  /* ---- deep link: /contact/#quote or ?quote=1 opens the form ---- */
  if (location.hash === '#quote' && !document.body.classList.contains('page-contact')) {
    var target = $('#quote');
    if (target) target.scrollIntoView();
  }
})();
