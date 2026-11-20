/* ==========================================================================
   Boutique Tours of North Wales: site behaviour (jQuery)
   --------------------------------------------------------------------------
   js/reveal.js (loaded first) runs the gentle scroll reveals.
   This file adds: the mobile menu, the day book, the enquiry form (sent by
   send.php on the server), review sliders, the tour finder, the cruise-day
   planner, the reviews filter, the video and linked questions.
   Every page is complete and readable without JavaScript.
   ========================================================================== */
window.SITE_READY = true;

(function ($, window, document) {
  'use strict';

  var SITE = window.SITE || {};
  var TOURS = window.TOURS || [];

  /* ---------- Helpers ------------------------------------------------- */
  var store = {
    get: function (key, fallback) { try { var v = window.localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set: function (key, value) { try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked: the day book lasts for this page only */ } }
  };
  function esc(text) { return $('<div>').text(text == null ? '' : String(text)).html(); }
  function icon(id) { return '<svg class="icon" aria-hidden="true" focusable="false"><use href="#' + id + '"/></svg>'; }
  function tourBySlug(slug) { for (var i = 0; i < TOURS.length; i++) if (TOURS[i].slug === slug) return TOURS[i]; return null; }

  /* ---------- Menu and current section --------------------------------- */
  function initNav() {
    var section = document.body.getAttribute('data-section');
    var map = { tours: 'tours.html', stay: 'tour-and-stay.html', cruise: 'cruise-tours.html', ancestral: 'ancestral-tours.html', about: 'about.html', contact: 'contact.html' };
    if (map[section]) {
      $('.nav__list a[href="' + map[section] + '"]').each(function () { if (!this.hasAttribute('aria-current')) this.setAttribute('aria-current', 'true'); });
    }
    var $toggle = $('[data-menu-toggle]');
    var $nav = $('#site-nav');
    $toggle.on('click', function () {
      var open = $toggle.attr('aria-expanded') !== 'true';
      $toggle.attr('aria-expanded', open ? 'true' : 'false');
      $nav.toggleClass('is-open', open);
      if (open) $nav.find('a').first().trigger('focus');
    });
    $(document).on('keydown', function (e) {
      if (e.key === 'Escape' && $nav.hasClass('is-open')) { $toggle.attr('aria-expanded', 'false'); $nav.removeClass('is-open'); $toggle.trigger('focus'); }
    });
  }

  /* ---------- Toast ---------------------------------------------------- */
  var toastTimer = null;
  function toast(message, linkHref, linkLabel) {
    var $t = $('#toast');
    if (!$t.length) $t = $('<div id="toast" class="toast" role="status" aria-live="polite"></div>').appendTo('body');
    $t.html('<p>' + esc(message) + '</p>' + (linkHref ? '<a class="btn btn--sm" href="' + linkHref + '">' + esc(linkLabel) + '</a>' : ''));
    window.requestAnimationFrame(function () { $t.addClass('is-shown'); });
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { $t.removeClass('is-shown'); }, 4500);
  }

  /* ---------- Day book: stops you'd love, kept across pages ------------ */
  var DB_KEY = 'bt-daybook-v1';
  var daybook = store.get(DB_KEY, []);
  if (!Array.isArray(daybook)) daybook = [];
  function dbHas(id) { return daybook.some(function (s) { return s.id === id; }); }
  function dbSave() { store.set(DB_KEY, daybook); renderDaybook(); }
  function dbText() {
    if (!daybook.length) return '';
    var byTour = {};
    daybook.forEach(function (s) { (byTour[s.tour] = byTour[s.tour] || []).push(s.stop); });
    return Object.keys(byTour).map(function (t) { return t + ': ' + byTour[t].join(', '); }).join('\n');
  }
  function renderDaybook() {
    var n = daybook.length;
        $('[data-daybook-count]').text(n);
    $('[data-daybook-add]').each(function () {
      var on = dbHas(this.getAttribute('data-id'));
      this.setAttribute('aria-pressed', on ? 'true' : 'false');
      $(this).find('[data-label]').text(on ? 'In my day book' : 'Add to my day');
      $(this).closest('.stop').toggleClass('is-added', on);
    });
    $('[data-daybook-mini]').prop('hidden', n === 0);
    $('[data-daybook-list]').html(daybook.map(function (s) {
      return '<li><div><strong>' + esc(s.stop) + '</strong><span>' + esc(s.tour) + '</span></div>' +
        '<button class="daybook__remove" type="button" data-daybook-remove="' + esc(s.id) + '" aria-label="Remove ' + esc(s.stop) + '">' + icon('i-close') + '</button></li>';
    }).join(''));
    $('[data-daybook-field]').val(dbText());
  }
  function initDaybook() {
    $(document).on('click', '[data-daybook-add]', function () {
      var id = this.getAttribute('data-id');
      var stop = this.getAttribute('data-stop');
      if (dbHas(id)) {
        daybook = daybook.filter(function (s) { return s.id !== id; });
        toast(stop + ' removed from your day book');
      } else {
        daybook.push({ id: id, stop: stop, tour: this.getAttribute('data-tour'), file: this.getAttribute('data-file') || '' });
        toast(stop + ' added to your day book', 'contact.html#daybook', 'Enquire');
        var $btn = $('[data-daybook-btn]').removeClass('is-bumped');
        window.requestAnimationFrame(function () { $btn.addClass('is-bumped'); });
      }
      dbSave();
    });
    $(document).on('click', '[data-daybook-remove]', function () {
      var id = this.getAttribute('data-daybook-remove');
      daybook = daybook.filter(function (s) { return s.id !== id; });
      dbSave();
      $('#daybook h2').attr('tabindex', '-1').trigger('focus');
    });
    $(document).on('click', '[data-daybook-clear]', function () { daybook = []; dbSave(); });
    renderDaybook();
  }

  /* ---------- Enquiry form: validate, then send by send.php ------------- */
  function fieldLabel(field) {
    var label = field.id ? document.querySelector('label[for="' + field.id + '"]') : null;
    return label ? $(label).text().replace(/\*/g, '').replace(/\s+/g, ' ').trim() : (field.name || '');
  }
  function setError(field, message) {
    var $wrap = $(field).closest('.field');
    var $err = $wrap.find('.field__error').first();
    if (!$err.length) { $err = $('<p class="field__error"></p>').attr('id', (field.id || field.name) + '-error'); $wrap.append($err); }
    $err.text(message || '');
    if (message) $(field).attr({ 'aria-invalid': 'true', 'aria-describedby': $err.attr('id') });
    else $(field).removeAttr('aria-invalid');
  }
  function validate($form) {
    var firstBad = null;
    $form.find('input, select, textarea').each(function () {
      if (this.disabled || this.type === 'hidden' || this.name === 'company_website') return;
      var value = $.trim($(this).val() || '');
      var message = '';
      if (this.type === 'checkbox') { if (this.required && !this.checked) message = this.getAttribute('data-error') || 'Please tick this box to continue.'; }
      else if (this.required && !value) message = this.getAttribute('data-error') || 'Please fill in ' + fieldLabel(this).toLowerCase() + '.';
      else if (value && this.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message = 'Please check this email address.';
      else if (value && this.type === 'tel' && !/^[0-9+()\-.\s]{7,40}$/.test(value)) message = 'Please enter your phone number with the country code, using numbers only.';
      setError(this, message);
      if (message && !firstBad) firstBad = this;
    });
    return firstBad;
  }
  function initForms() {
    var opened = Date.now();
    $('[data-form]').each(function () {
      var $form = $(this);
      var $status = $form.find('[data-form-status]');
      $form.on('input change', 'input, select, textarea', function () { if (this.getAttribute('aria-invalid') === 'true') setError(this, ''); });
      $form.on('submit', function (event) {
        $form.find('[name="elapsed"]').val(String(Date.now() - opened));
        $('[data-daybook-field]').val(dbText());
        var bad = validate($form);
        if (bad) { event.preventDefault(); $status.removeClass('is-ok').text('Please check the highlighted fields.'); bad.focus(); return; }
        if (!window.fetch || !window.FormData) return; // the browser posts the form normally and send.php shows the thank-you page
        event.preventDefault();
        var $btn = $form.find('[type="submit"]').prop('disabled', true).text('Sending…');
        $status.removeClass('is-ok').text('');
        window.fetch($form.attr('action') || 'send.php', { method: 'POST', body: new window.FormData($form.get(0)), headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
          .then(function (data) {
            if (data && data.ok) {
              daybook = []; dbSave();
              $form.find('.form-grid, .form-actions, .note').hide();
              $status.addClass('is-ok').attr('tabindex', '-1').text('Thank you for your enquiry. ' + (data.message || 'Your enquiry is on its way to us.') + ' We aim to reply personally within 24 hours, so please check your junk mail folder too.').trigger('focus');
            } else {
              $status.removeClass('is-ok').text((data && data.message) || 'Sorry, your enquiry could not be sent just now. Please try again in a few minutes.');
              $btn.prop('disabled', false).text('Send my enquiry');
            }
          })
          .catch(function () {
            $status.removeClass('is-ok').text('Sorry, your enquiry could not be sent just now. Please check your connection and try again.');
            $btn.prop('disabled', false).text('Send my enquiry');
          });
      });
    });
    // Prefill from links such as contact.html?tour=isle-of-anglesey or ?type=cruise
    var params = new window.URLSearchParams(window.location.search);
    var subjects = { day: 'Private day tour enquiry', stay: 'Tour and Stay enquiry', cruise: 'Cruise tour enquiry', ancestral: 'Ancestral tour enquiry', tailor: 'Tailor-made tour enquiry' };
    var tour = params.get('tour') && tourBySlug(params.get('tour'));
    if (tour) {
      $('#f-tour').val(tour.name);
      $('#f-subject').val('Enquiry about the ' + tour.name);
    } else if (params.get('type') && subjects[params.get('type')]) {
      $('#f-subject').val(subjects[params.get('type')]);
    }
    if (params.get('port')) {
      var port = params.get('port') === 'liverpool' ? 'Liverpool' : 'Holyhead';
      $('#f-tour').val(port + ' cruise tour');
      $('#f-subject').val('Cruise tour enquiry: ' + port);
      $('#f-message').val('Our ship is in ' + port + (params.get('arrive') ? ' from ' + params.get('arrive') : '') + (params.get('aboard') ? ', all aboard at ' + params.get('aboard') : '') + '.\nShip name and date: ');
    }
  }

  /* ---------- Review sliders ------------------------------------------ */
  function initSliders() {
    $('[data-slider]').each(function () {
      var $s = $(this);
      var $slides = $s.find('.slide');
      var $count = $s.find('[data-slider-count]');
      var i = 0;
      function go(n) {
        i = (n + $slides.length) % $slides.length;
        $slides.prop('hidden', true).eq(i).prop('hidden', false);
        $count.text((i + 1) + ' / ' + $slides.length);
      }
      $s.on('click', '[data-slider-prev]', function () { go(i - 1); });
      $s.on('click', '[data-slider-next]', function () { go(i + 1); });
      $s.on('keydown', function (e) { if (e.key === 'ArrowLeft') go(i - 1); if (e.key === 'ArrowRight') go(i + 1); });
    });
  }

  /* ---------- Tour finder (tours.html) --------------------------------- */
  function initFinder() {
    var $finder = $('[data-finder]');
    if (!$finder.length) return;
    var $list = $('[data-tour-list]');
    var $cards = $list.children('[data-tour]');
    var $status = $('[data-finder-status]');
    function run() {
      var interests = $finder.find('[name="interest"]:checked').map(function () { return this.value; }).get();
      var region = $finder.find('[name="region"]:checked').val() || '';
      var days = $finder.find('[name="days"]:checked').val() || '';
      var any = interests.length || region;
      var scored = $cards.get().map(function (card) {
        var tags = (card.getAttribute('data-interests') || '').split(' ');
        var regions = (card.getAttribute('data-regions') || '').split(' ');
        var score = interests.filter(function (x) { return tags.indexOf(x) !== -1; }).length * 2 + (region && regions.indexOf(region) !== -1 ? 3 : 0);
        var match = !any || (score > 0 && (!region || regions.indexOf(region) !== -1));
        return { card: card, score: score, match: match, order: parseInt(card.getAttribute('data-order'), 10) || 0 };
      });
      scored.sort(function (a, b) { return (b.match - a.match) || (b.score - a.score) || (a.order - b.order); });
      $list.find('.card__match').remove();
      var matches = 0;
      scored.forEach(function (s, n) {
        $list.append(s.card);
        $(s.card).toggleClass('is-dim', !!any && !s.match).addClass('is-in');
        if (s.match) matches++;
        if (any && n === 0 && s.match) $(s.card).prepend('<span class="card__match">Best match</span>');
      });
      var extra = '';
      if (days === 'multi') extra = ' Staying two days or more? <a href="tour-and-stay.html">See Tour and Stay</a>.';
      if (days === 'cruise') extra = ' On a cruise? <a href="cruise-tours.html#planner">Plan your port day</a>.';
      $status.html(any ? '<strong>' + matches + (matches === 1 ? ' tour matches' : ' tours match') + '</strong> your choices, best first.' + extra : 'Showing all ' + $cards.length + ' day tours.' + extra);
    }
    $finder.on('change', 'input', run);
    $finder.on('click', '[data-finder-reset]', function () { $finder.find('input').prop('checked', false); $finder.find('[name="region"][value=""], [name="days"][value="one"]').prop('checked', true); run(); });
  }

  /* ---------- Cruise-day planner --------------------------------------- */
  var PORT_TOURS = {
    holyhead: ['isle-of-anglesey', 'anglesey-and-snowdonia', 'castle-and-snowdonia', 'north-wales-in-a-nutshell'],
    liverpool: ['gateway-to-wales', 'borderlands', 'castles-cathedral-garden']
  };
  function minutes(value) { var p = (value || '').split(':'); return p.length === 2 ? parseInt(p[0], 10) * 60 + parseInt(p[1], 10) : null; }
  function initPlanner() {
    var $p = $('[data-planner]');
    if (!$p.length) return;
    var $out = $p.find('[data-planner-result]');
    function run() {
      var port = ($p.find('[name="port"]').val() || '').toLowerCase();
      var arrive = $p.find('[name="arrival"]').val();
      var aboard = $p.find('[name="allAboard"]').val();
      var a = minutes(arrive), b = minutes(aboard);
      if (!port || a === null || b === null || b <= a) {
        $out.html('<p>' + (port && a !== null && b !== null ? 'Please check the times: all aboard must be after the ship arrives.' : 'Choose your port of call to see your time ashore and the tours that suit it.') + '</p>');
        return;
      }
      var mins = b - a, hours = Math.floor(mins / 60), rest = mins % 60;
      var list = (PORT_TOURS[port] || []).map(function (slug) { var t = tourBySlug(slug); return t ? '<li><a href="' + t.file + '">' + esc(t.name) + '</a></li>' : ''; }).join('');
      var extra = port === 'liverpool' ? '<li><a href="liverpool-tours.html">Liverpool private tours</a></li><li><a href="liverpool-chester-tours.html">Liverpool and Chester tours</a></li>' : '<li><a href="holyhead-cruise-tours.html">Holyhead cruise tours</a></li>';
      var href = 'contact.html?type=cruise&port=' + port + '&arrive=' + encodeURIComponent(arrive) + '&aboard=' + encodeURIComponent(aboard);
      $out.html(
        '<p class="planner__hours">' + hours + ' h' + (rest ? ' ' + rest + ' min' : '') + '</p>' +
        '<p>in port, from arrival to all aboard. We will design a touring day around your time ashore and plan the route back to the ship. Because of the time in port, not every stop on a tour can be included.</p>' +
        '<p><strong>Tours that suit a day ashore at ' + (port === 'liverpool' ? 'Liverpool' : 'Holyhead') + ':</strong></p><ul>' + list + extra + '</ul>' +
        '<a class="btn" href="' + href + '">Enquire about this port day</a>');
    }
    $p.on('input change', 'input, select', run);
    run();
  }

  /* ---------- Reviews filter ------------------------------------------ */
  function initReviewFilter() {
    var $f = $('[data-review-filter]');
    if (!$f.length) return;
    var $cards = $('[data-review-list] [data-review]');
    $f.on('change', 'input', function () {
      var kind = this.value;
      $cards.each(function () { this.hidden = kind !== 'all' && this.getAttribute('data-review') !== kind; });
    });
  }

  /* ---------- Video: loads YouTube only when asked --------------------- */
  function initVideo() {
    $(document).on('click', '[data-video-play]', function () {
      var $v = $(this).closest('[data-video]');
      var id = $v.attr('data-video');
      $v.html('<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0" title="Touring North Wales with Boutique Tours" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>');
    });
  }

  /* ---------- Open a question linked by #anchor ------------------------ */
  function initHashDetails() {
    function open() {
      var id = window.location.hash.slice(1);
      var el = id && document.getElementById(id);
      if (el && el.tagName === 'DETAILS') { el.open = true; el.scrollIntoView(); }
    }
    open();
    $(window).on('hashchange', open);
  }

  $(function () {
    initNav();
    initDaybook();
    initForms();
    initSliders();
    initFinder();
    initPlanner();
    initReviewFilter();
    initVideo();
    initHashDetails();
  });
})(window.jQuery, window, document);
