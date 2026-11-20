/* ==========================================================================
   Scroll reveal and counters
   --------------------------------------------------------------------------
   Plain JavaScript, loaded before jQuery so content in the first screen
   appears without waiting for the jQuery download (keeps LCP fast).

     data-reveal            fade and rise into view (data-delay="1-5" staggers)
     data-count="120"       count up when visible (data-prefix, data-suffix, data-decimals)
   ========================================================================== */
(function () {
  'use strict';

  window.SITE_READY = true;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var reveals = document.querySelectorAll('[data-reveal]');
  var counters = document.querySelectorAll('[data-count]');

  function formatNumber(value, decimals) {
    var locale = (window.SITE && window.SITE.lang) || document.documentElement.lang || 'en-GB';
    return value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function runCounter(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var decimals = parseInt(el.getAttribute('data-decimals'), 10) || 0;
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var finalText = prefix + formatNumber(target, decimals) + suffix;
    if (reduceMotion) {
      el.textContent = finalText;
      return;
    }
    var duration = 1600;
    var start = null;
    function step(time) {
      if (start === null) start = time;
      var progress = Math.min((time - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 4);
      el.textContent = prefix + formatNumber(target * eased, decimals) + suffix;
      if (progress < 1) window.requestAnimationFrame(step);
      else el.textContent = finalText;
    }
    window.requestAnimationFrame(step);
  }

  function show(el) { el.classList.add('is-in'); }

  if (!('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(reveals, show);
    Array.prototype.forEach.call(counters, runCounter);
    return;
  }

  // Anything already on screen animates from the first paint (CSS keyframes)
  // instead of waiting for the observer, so the largest element shows sooner.
  var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  reveals = Array.prototype.filter.call(reveals, function (el) {
    var rect = el.getBoundingClientRect();
    if (rect.top < viewportHeight && rect.bottom > 0) {
      el.classList.add('is-in', 'is-first');
      return false;
    }
    return true;
  });

  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        show(entry.target);
        revealObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -4% 0px', threshold: 0.01 });
  Array.prototype.forEach.call(reveals, function (el) { revealObserver.observe(el); });

  // Safety net: a fast jump can carry an element from below the screen to above it
  // without it ever intersecting. Show anything that is already above the fold line.
  var pending = false;
  function sweep() {
    pending = false;
    var limit = window.innerHeight || document.documentElement.clientHeight;
    Array.prototype.forEach.call(reveals, function (el) {
      if (el.classList.contains('is-in')) return;
      if (el.getBoundingClientRect().top < limit) { show(el); revealObserver.unobserve(el); }
    });
  }
  window.addEventListener('scroll', function () { if (!pending) { pending = true; window.setTimeout(sweep, 250); } }, { passive: true });
  window.addEventListener('load', sweep);

  var countObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        runCounter(entry.target);
        countObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });
  Array.prototype.forEach.call(counters, function (el) { countObserver.observe(el); });
})();
