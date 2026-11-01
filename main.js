/* ==========================================================
   AI-Smart Study - main script
   Each feature starts only if its elements exist on the page.
   Custom GA4 events (names are final for the measurement plan):
     prompt_copied, quiz_started, quiz_completed,
     tool_link_click, checklist_download_click, feedback_submitted
   ========================================================== */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // Safe wrapper: never breaks the page if analytics is blocked/unavailable.
  function track(name, params) {
    try {
      if (typeof window.gtag === 'function') { window.gtag('event', name, params || {}); }
    } catch (e) { /* ignore */ }
  }

  function save(key, value) { try { window.localStorage.setItem(key, value); } catch (e) { /* ignore */ } }
  function load(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function saveSession(key, value) { try { window.sessionStorage.setItem(key, value); } catch (e) { /* ignore */ } }
  function loadSession(key) { try { return window.sessionStorage.getItem(key); } catch (e) { return null; } }

  /* ---------- footer year ---------- */
  var yearEl = $('#year');
  if (yearEl) { yearEl.textContent = String(new Date().getFullYear()); }

  /* ---------- mobile navigation ---------- */
  var toggle = $('#nav-toggle');
  var nav = $('#site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------- outbound tool links + checklist download tracking ---------- */
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest ? ev.target.closest('a') : null;
    if (!a) { return; }
    if (a.hasAttribute('data-tool')) {
      track('tool_link_click', { tool_name: a.getAttribute('data-tool'), link_url: a.href });
    }
    if (a.hasAttribute('data-checklist-download')) {
      track('checklist_download_click', { file_name: 'AI-Smart-Study-Checklist.pdf' });
    }
  });

  /* ==========================================================
     PROMPT BUILDER
     ========================================================== */
  var pbForm = $('#prompt-form');
  if (pbForm) {
    var out = $('#pb-output');
    var copyBtn = $('#pb-copy');
    var resetBtn = $('#pb-reset');
    var status = $('#pb-status');

    var MODES = {
      learn: {
        label: 'Help me understand',
        text: 'Help me understand this topic. Explain step by step, then ask me 2-3 questions to check my understanding. Do not just give a final answer that I could submit as my own work.'
      },
      feedback: {
        label: 'Give feedback on my draft',
        text: 'Give me feedback on my own draft: strengths, weaknesses and specific suggestions. Do not rewrite the whole text for me.'
      },
      brainstorm: {
        label: 'Brainstorm ideas',
        text: 'Suggest several ideas or angles with pros and cons for each. I will choose one and develop it myself.'
      },
      practice: {
        label: 'Practice questions',
        text: 'Create practice questions for me. Keep the answers hidden until I try, then give feedback on my attempts.'
      }
    };

    var val = function (id) { return ($('#' + id).value || '').trim(); };

    var buildPrompt = function () {
      var task = val('pb-task');
      if (!task) { return ''; }
      var mode = MODES[val('pb-mode')] || MODES.learn;
      var lines = [];
      lines.push('Act as ' + (val('pb-role') || 'a patient, knowledgeable tutor') + '.');
      lines.push('');
      lines.push('My goal: ' + mode.text);
      lines.push('');
      lines.push('Topic / task: ' + task);
      if (val('pb-context')) { lines.push('Context: ' + val('pb-context')); }
      if (val('pb-level')) { lines.push('My level: ' + val('pb-level')); }
      if (val('pb-format')) { lines.push('Preferred answer format: ' + val('pb-format')); }
      if (val('pb-constraints')) { lines.push('Constraints: ' + val('pb-constraints')); }
      lines.push('');
      lines.push('If anything is unclear, ask me clarifying questions before answering.');
      lines.push('Tell me where you are uncertain, and suggest how I can verify the key facts using reliable sources.');
      return lines.join('\n');
    };

    var refresh = function () {
      var text = buildPrompt();
      out.value = text;
      copyBtn.disabled = !text;
      if (!text) { status.textContent = ''; }
    };

    pbForm.addEventListener('input', refresh);
    pbForm.addEventListener('change', refresh);
    pbForm.addEventListener('submit', function (e) { e.preventDefault(); });

    var fallbackCopy = function (text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    };

    var onCopied = function () {
      status.textContent = 'Prompt copied to your clipboard.';
      track('prompt_copied', { prompt_mode: val('pb-mode') });
    };

    copyBtn.addEventListener('click', function () {
      var text = out.value;
      if (!text) { return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(onCopied, function () {
          if (fallbackCopy(text)) { onCopied(); } else { status.textContent = 'Could not copy automatically. Select the text and copy it manually.'; }
        });
      } else if (fallbackCopy(text)) {
        onCopied();
      } else {
        status.textContent = 'Could not copy automatically. Select the text and copy it manually.';
      }
    });

    resetBtn.addEventListener('click', function () {
      pbForm.reset();
      refresh();
      status.textContent = 'Form cleared.';
    });

    refresh();
  }

  /* ==========================================================
     QUIZ: "Is this acceptable?"
     General scenarios only. Real rules depend on your course.
     ========================================================== */
  var quizRoot = $('#quiz-root');
  if (quizRoot) {
    var OPTIONS = [
      { id: 'ok', label: 'Generally acceptable' },
      { id: 'depends', label: 'It depends: check the rules first' },
      { id: 'no', label: 'Generally not acceptable' }
    ];

    var QUESTIONS = [
      {
        q: 'You do not understand a concept from the lecture slides, so you ask an AI tool to explain it in simpler words, then check it against your textbook.',
        a: 'ok',
        why: 'Using AI as an explainer is a learning use, and you verify the result against a trusted source. Still follow any course rule that applies.'
      },
      {
        q: 'You paste the whole assignment question into an AI tool and submit its answer as your own work.',
        a: 'no',
        why: 'This replaces the work you are meant to do and presents it as yours. It is the clearest example of misuse.'
      },
      {
        q: 'You ask an AI tool to correct grammar in a paragraph you wrote yourself.',
        a: 'depends',
        why: 'Many courses allow light language support, but some do not, and some require you to disclose it. Check the rules for the assignment.'
      },
      {
        q: 'You ask an AI tool for a list of references and paste them into your bibliography without opening any of them.',
        a: 'no',
        why: 'AI tools can produce references that look real but do not exist or do not say what is claimed. Every source must be found and read by you.'
      },
      {
        q: 'You use AI to brainstorm possible project topics, then pick one and develop it yourself.',
        a: 'ok',
        why: 'Brainstorming is a typical supporting use, and the thinking and the final work are yours. Disclose it if your course asks you to.'
      },
      {
        q: 'The instructions say a programming assignment must be done individually without outside help, but you ask an AI tool to write the code.',
        a: 'no',
        why: 'The stated rules prohibit it. Following the assignment instructions always comes first.'
      },
      {
        q: 'You upload a classmate\'s personal details or confidential unpublished research data into a public AI tool.',
        a: 'no',
        why: 'Sharing other people\'s personal or confidential information with an online tool can breach privacy and research rules.'
      },
      {
        q: 'You ask an AI tool to summarise a paper, and then you read the paper yourself to check the summary.',
        a: 'ok',
        why: 'A summary used as a reading aid, followed by your own reading and verification, supports learning rather than replacing it.'
      },
      {
        q: 'Your course has no written AI policy, and you want AI to draft a section of your report.',
        a: 'depends',
        why: 'Silence is not permission. Ask your instructor before you use it, and be ready to disclose it.'
      },
      {
        q: 'Your course requires an AI-use disclosure, but you have AI rewrite your essay paragraphs and submit them without mentioning it.',
        a: 'no',
        why: 'Hiding AI use when disclosure is required breaks the course rules, even if the ideas are yours.'
      }
    ];

    var introEl = $('#quiz-intro');
    var areaEl = $('#quiz-area');
    var resultEl = $('#quiz-result');
    var startBtn = $('#quiz-start');
    var index = 0;
    var score = 0;
    var answered = false;

    var escapeHtml = function (s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    var labelFor = function (id) {
      for (var i = 0; i < OPTIONS.length; i++) { if (OPTIONS[i].id === id) { return OPTIONS[i].label; } }
      return '';
    };

    var renderQuestion = function () {
      var item = QUESTIONS[index];
      answered = false;
      var html = '';
      html += '<p class="quiz-progress">Question ' + (index + 1) + ' of ' + QUESTIONS.length + '</p>';
      html += '<div class="progress-bar" aria-hidden="true"><span style="width:' + (index / QUESTIONS.length * 100) + '%"></span></div>';
      html += '<form id="q-form"><fieldset><legend>' + escapeHtml(item.q) + '</legend>';
      OPTIONS.forEach(function (o) {
        html += '<label class="choice"><input type="radio" name="answer" value="' + o.id + '"> <span>' + escapeHtml(o.label) + '</span></label>';
      });
      html += '</fieldset>';
      html += '<div class="quiz-actions"><button type="submit" class="btn btn-primary" id="q-check">Check answer</button>';
      html += '<button type="button" class="btn btn-outline" id="q-next" hidden>' + (index === QUESTIONS.length - 1 ? 'See my score' : 'Next question') + '</button></div>';
      html += '<div id="q-feedback" aria-live="polite"></div></form>';
      areaEl.innerHTML = html;

      var form = $('#q-form');
      var firstRadio = $('input[name="answer"]', form);
      if (firstRadio) { firstRadio.focus(); }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (answered) { return; }
        var chosen = $('input[name="answer"]:checked', form);
        var fb = $('#q-feedback');
        if (!chosen) {
          fb.innerHTML = '<div class="feedback bad">Please choose an answer first.</div>';
          return;
        }
        answered = true;
        var correct = chosen.value === item.a;
        if (correct) { score += 1; }
        $all('.choice', form).forEach(function (lab) {
          var input = $('input', lab);
          input.disabled = true;
          if (input.value === item.a) { lab.classList.add('correct'); }
          else if (input.checked) { lab.classList.add('wrong'); }
        });
        fb.innerHTML = '<div class="feedback ' + (correct ? 'good' : 'bad') + '"><strong>' +
          (correct ? 'Correct.' : 'Not quite.') + '</strong> Best answer: ' + escapeHtml(labelFor(item.a)) + '. ' + escapeHtml(item.why) + '</div>';
        $('#q-check').hidden = true;
        var next = $('#q-next');
        next.hidden = false;
        next.focus();
      });

      $('#q-next').addEventListener('click', function () {
        index += 1;
        if (index < QUESTIONS.length) { renderQuestion(); } else { showResult(); }
      });
    };

    var showResult = function () {
      areaEl.hidden = true;
      var msg;
      if (score >= 9) { msg = 'Excellent judgement. Remember that real rules differ between courses, so keep checking them.'; }
      else if (score >= 6) { msg = 'Good start. Review the guide for the cases you missed, especially the "it depends" situations.'; }
      else { msg = 'Worth revisiting. Read the guide and use the checklist before your next assignment.'; }
      resultEl.innerHTML =
        '<p class="score" tabindex="-1" id="score-line">' + score + ' / ' + QUESTIONS.length + '</p>' +
        '<p>' + escapeHtml(msg) + '</p>' +
        '<div class="quiz-actions">' +
        '<button type="button" class="btn btn-primary" id="quiz-restart">Try again</button>' +
        '<a class="btn btn-outline" href="guide.html">Read the guide</a>' +
        '<a class="btn btn-outline" href="checklist.html">Get the checklist</a></div>';
      resultEl.hidden = false;
      $('#score-line').focus();
      track('quiz_completed', { score: score, total_questions: QUESTIONS.length });
      $('#quiz-restart').addEventListener('click', startQuiz);
    };

    var startQuiz = function () {
      index = 0;
      score = 0;
      introEl.hidden = true;
      resultEl.hidden = true;
      areaEl.hidden = false;
      track('quiz_started', { total_questions: QUESTIONS.length });
      renderQuestion();
    };

    startBtn.addEventListener('click', startQuiz);
  }

  /* ==========================================================
     CHECKLIST (progress saved only in this browser)
     ========================================================== */
  var checkList = $('#check-list');
  if (checkList) {
    var boxes = $all('input[type="checkbox"]', checkList);
    var progress = $('#check-progress');
    var KEY = 'aiss_checklist_v1';

    var updateProgress = function () {
      var done = boxes.filter(function (b) { return b.checked; }).length;
      progress.textContent = done + ' of ' + boxes.length + ' items ticked';
    };

    var saved = load(KEY);
    if (saved) {
      try {
        var arr = JSON.parse(saved);
        boxes.forEach(function (b, i) { b.checked = !!arr[i]; });
      } catch (e) { /* ignore corrupt data */ }
    }
    updateProgress();

    checkList.addEventListener('change', function () {
      save(KEY, JSON.stringify(boxes.map(function (b) { return b.checked; })));
      updateProgress();
    });

    var clearBtn = $('#check-reset');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        boxes.forEach(function (b) { b.checked = false; });
        save(KEY, JSON.stringify(boxes.map(function () { return false; })));
        updateProgress();
      });
    }
  }

  /* ==========================================================
     FEEDBACK (rating buttons + optional email form)
     ========================================================== */
  var ratingRow = $('#rating-row');
  if (ratingRow) {
    var thanks = $('#rating-thanks');
    var ratingBtns = $all('button[data-rating]', ratingRow);

    if (loadSession('aiss_rated')) {
      ratingBtns.forEach(function (b) { b.disabled = true; });
      thanks.textContent = 'Thank you, your answer has already been recorded for this visit.';
    }

    ratingBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (loadSession('aiss_rated')) { return; }
        saveSession('aiss_rated', '1');
        ratingBtns.forEach(function (b) { b.disabled = true; });
        track('feedback_submitted', { rating: btn.getAttribute('data-rating') });
        thanks.textContent = 'Thank you for your feedback.';
      });
    });
  }

  var cfg = window.SITE_CONFIG || {};
  var emailWrap = $('#email-feedback');
  if (emailWrap && cfg.CONTACT_EMAIL) {
    emailWrap.hidden = false;
    var emailForm = $('#email-form');
    emailForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = ($('#fb-message').value || '').trim();
      var topic = $('#fb-topic').value;
      if (!msg) { $('#fb-status').textContent = 'Please write a message first.'; return; }
      var subject = 'AI-Smart Study feedback: ' + topic;
      window.location.href = 'mailto:' + encodeURIComponent(cfg.CONTACT_EMAIL) +
        '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(msg);
      $('#fb-status').textContent = 'Your email app should open with the message ready to send.';
    });
  }
})();
