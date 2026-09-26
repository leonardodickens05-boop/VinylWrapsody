/* Vinyl Wrapsody – quote form: validation, photo compression, submission, tracking */
(function () {
  'use strict';
  var CFG = window.VW || {};
  var ENDPOINT = CFG.leadEndpoint || '/api/lead';
  var MAX_PHOTOS = 3, MAX_EDGE = 1400, JPEG_Q = 0.8;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  function readImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }
  /* Downscale + re-encode on the client so the request stays small (serverless bodies cap at ~6 MB). */
  function compress(file) {
    return readImage(file).then(function (img) {
      var s = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      var dataUrl = c.toDataURL('image/jpeg', JPEG_Q);
      return { name: (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', data: dataUrl.split(',')[1], preview: dataUrl };
    });
  }

  function setupForm(form) {
    var photos = [];
    var fileInput = $('input[type=file]', form);
    var previews = $('.upload-previews', form);
    var box = $('.upload-box', form);
    var status = $('.qf-status', form);
    var tsField = $('input[name="_t"]', form);
    if (tsField) tsField.value = String(Date.now());

    // show the kitchen-size question only for kitchens
    function syncKitchen() {
      var v = ($('input[name="project"]:checked', form) || {}).value;
      var k = $('.qf-kitchen-only', form);
      if (k) k.classList.toggle('is-hidden', v !== 'Kitchen');
    }
    $$('input[name="project"]', form).forEach(function (r) { r.addEventListener('change', syncKitchen); });
    syncKitchen();

    function renderPreviews() {
      previews.innerHTML = '';
      photos.forEach(function (p, i) {
        var fig = document.createElement('figure');
        fig.innerHTML = '<img alt="Selected photo ' + (i + 1) + '"><button type="button" aria-label="Remove photo">×</button>';
        $('img', fig).src = p.preview;
        $('button', fig).addEventListener('click', function () { photos.splice(i, 1); renderPreviews(); });
        previews.appendChild(fig);
      });
      var cta = $('.upload-cta', form);
      if (cta) cta.lastChild.textContent = photos.length ? ' Add another photo (' + photos.length + '/' + MAX_PHOTOS + ')' : ' Tap to add photos';
    }
    function addFiles(list) {
      var files = Array.prototype.slice.call(list || []).filter(function (f) { return /^image\//.test(f.type); });
      files = files.slice(0, MAX_PHOTOS - photos.length);
      if (!files.length) return;
      showStatus('Preparing photos…', '');
      Promise.all(files.map(compress)).then(function (out) {
        photos = photos.concat(out); renderPreviews(); showStatus('', '');
      }).catch(function () { showStatus('Sorry, one of those photos could not be read.', 'is-error'); });
    }
    if (fileInput) {
      fileInput.addEventListener('change', function () { addFiles(fileInput.files); fileInput.value = ''; });
      ['dragenter', 'dragover'].forEach(function (ev) { box.addEventListener(ev, function (e) { e.preventDefault(); box.classList.add('is-drag'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { box.addEventListener(ev, function (e) { e.preventDefault(); box.classList.remove('is-drag'); }); });
      box.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });
    }

    function showStatus(msg, cls) { status.textContent = msg; status.className = 'qf-status ' + (cls || ''); }

    function validate() {
      var ok = true;
      $$('[required]', form).forEach(function (el) {
        var bad = el.type === 'checkbox' ? !el.checked : !el.value.trim();
        if (el.type === 'email' && el.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value)) bad = true;
        if (el.type === 'tel' && el.value && el.value.replace(/\D/g, '').length < 10) bad = true;
        el.classList.toggle('is-invalid', bad);
        if (bad && ok) { el.focus(); ok = false; }
      });
      if (!ok) showStatus('Please check the highlighted fields.', 'is-error');
      return ok;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) return;
      var data = {};
      $$('input, select, textarea', form).forEach(function (el) {
        if (el.type === 'file' || el.type === 'radio' && !el.checked) return;
        if (el.type === 'checkbox') data[el.name] = el.checked; else data[el.name] = el.value.trim();
      });
      data.photos = photos.map(function (p) { return { name: p.name, type: p.type, data: p.data }; });
      data.page = data.page || location.href;
      data.referrer = document.referrer || '';
      data.utm = location.search.slice(1);
      submit(form, data, showStatus);
    });
  }

  function submit(form, data, showStatus) {
    form.classList.add('is-busy');
    showStatus('Sending…', '');
    var done = function () {
      window.vwTrack('generate_lead', { event_category: 'lead', event_label: data.project || 'quote', method: 'quote_form' });
      if (CFG.thankYou && !CFG.demo) { location.href = CFG.thankYou; return; }
      form.classList.remove('is-busy'); form.classList.add('is-done');
      showStatus('Thanks ' + (data.name ? data.name.split(' ')[0] : '') + ', we\'ve got your enquiry. We\'ll be in touch within one working day.' + (CFG.demo ? ' (Preview mode: nothing was sent.)' : ''), 'is-ok');
    };
    if (CFG.demo) { setTimeout(done, 700); return; }
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, json: j }; }); })
      .then(function (res) {
        if (res.ok && res.json && res.json.ok) return done();
        throw new Error((res.json && res.json.error) || 'Request failed');
      })
      .catch(function (err) {
        form.classList.remove('is-busy');
        showStatus('Sorry, that didn\'t send (' + err.message + '). Please call ' + (CFG.phone || 'us') + ' or WhatsApp us instead.', 'is-error');
        window.vwTrack('lead_form_error', { event_label: err.message });
      });
  }

  /* hero mini form: name + phone + project -> same endpoint, then hand over to the full form for photos */
  function setupMini(form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = { name: form.name.value.trim(), phone: form.phone.value.trim(), project: form.project.value, source: 'hero_callback', page: location.href, consent: true, _t: String(Date.now() - 20000), utm: location.search.slice(1) };
      if (!data.name || data.phone.replace(/\D/g, '').length < 10) { form.phone.classList.add('is-invalid'); form.phone.focus(); return; }
      var btn = $('button', form); btn.disabled = true; btn.textContent = 'Sending…';
      var finish = function () {
        window.vwTrack('generate_lead', { event_category: 'lead', event_label: data.project, method: 'hero_callback' });
        // Pre-fill the full form and open it so they can add photos (optional).
        $$('form[data-quote-form]').forEach(function (f) {
          f.name.value = data.name; f.phone.value = data.phone;
          var r = $('input[name="project"][value="' + data.project + '"]', f); if (r) { r.checked = true; r.dispatchEvent(new Event('change')); }
        });
        form.innerHTML = '<p class="qf-status is-ok" style="margin:0">Thanks ' + data.name.split(' ')[0] + ', we\'ll call you back shortly.' + (CFG.demo ? ' (Preview mode: nothing was sent.)' : '') + '</p><p class="hero-mini-foot" style="margin-top:8px">Want a faster quote? <a href="#" data-open-quote-inline>Add photos of the space →</a></p>';
        $('[data-open-quote-inline]', form).addEventListener('click', function (ev) { ev.preventDefault(); if (window.vwOpenQuote) window.vwOpenQuote(); });
      };
      if (CFG.demo) return setTimeout(finish, 600);
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { if (!r.ok) throw new Error('failed'); return r.json(); })
        .then(finish)
        .catch(function () { btn.disabled = false; btn.textContent = 'Request a callback'; alert('Sorry, that didn\'t send. Please call us on ' + (CFG.phone || 'the number above') + '.'); });
    });
  }

  $$('form[data-quote-form]').forEach(setupForm);
  $$('form[data-mini-form]').forEach(setupMini);
})();
