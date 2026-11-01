/* ==========================================================
   AI-Smart Study - Google Analytics 4 loader
   - Reads settings from js/config.js
   - Loads the gtag.js tag ONCE per page (no duplicate tags)
   - Sends nothing if no valid Measurement ID is configured
   - Respects the visitor's consent choice
   ========================================================== */
(function () {
  'use strict';

  var cfg = window.SITE_CONFIG || {};
  var id = String(cfg.GA_MEASUREMENT_ID || '').trim();
  var mode = cfg.CONSENT_MODE === 'opt-out' ? 'opt-out' : 'opt-in';
  var KEY = 'aiss_analytics_consent';
  var idIsValid = /^G-[A-Z0-9]{6,}$/.test(id);
  var loaded = false;

  // gtag() is always defined so other scripts can call it safely.
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };

  function getChoice() {
    try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function setChoice(value) {
    try { window.localStorage.setItem(KEY, value); } catch (e) { /* ignore */ }
  }

function loadGA() {
  if (loaded || !idIsValid) { return; }
  loaded = true;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);

  document.head.appendChild(s);

  window.gtag('js', new Date());
  window.gtag('config', id); // sends the automatic page_view
  }

  function removeBanner() {
    var b = document.getElementById('consent-banner');
    if (b && b.parentNode) { b.parentNode.removeChild(b); }
  }

  function showBanner() {
    if (document.getElementById('consent-banner')) { return; }
    var div = document.createElement('div');
    div.className = 'consent-banner';
    div.id = 'consent-banner';
    div.setAttribute('role', 'region');
    div.setAttribute('aria-label', 'Analytics choice');
    div.innerHTML =
      '<div class="inner">' +
      '<p>' + (mode === 'opt-in'
        ? 'This site would like to use Google Analytics to count visits and see which pages and tools are used. It does not collect your name or account details.'
        : 'This site uses Google Analytics to count visits and see which pages and tools are used. It does not collect your name or account details. You can decline.') +
      ' <a href="about.html#privacy">Learn more</a></p>' +
      '<div class="btns">' +
      '<button type="button" class="btn btn-primary" id="consent-accept">Accept</button>' +
      '<button type="button" class="btn btn-outline" id="consent-decline">Decline</button>' +
      '</div></div>';
    document.body.appendChild(div);
    document.getElementById('consent-accept').addEventListener('click', function () {
      setChoice('granted'); removeBanner(); loadGA();
    });
    document.getElementById('consent-decline').addEventListener('click', function () {
      setChoice('denied'); removeBanner();
    });
  }

  function init() {
    if (!idIsValid) { return; } // nothing configured -> nothing sent

    var choice = getChoice();
    if (choice === 'granted') { loadGA(); }
    else if (choice === 'denied') { /* respect the choice */ }
    else if (mode === 'opt-out') { loadGA(); showBanner(); }
    else { showBanner(); }

    // Footer button lets visitors change their mind later.
    var reopen = document.getElementById('analytics-settings');
    if (reopen) {
      reopen.hidden = false; // only shown when analytics is actually configured
      reopen.addEventListener('click', function () {
        try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
        showBanner();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
