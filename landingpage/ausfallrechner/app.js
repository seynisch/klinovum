/* Klinovum Ausfall-Rechner: Oberfläche. Rechenlogik steht in rechner.js.
   Ablauf: Stufe 1 = drei Fragen und die Zahl, Stufe 2 = sechs Fragen und der Befund. */
(function () {
  'use strict';
  var C = window.AusfallRechnerCore;
  var stage = document.getElementById('rc-stage');
  if (!C || !stage) return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = new URLSearchParams(window.location.search);
  var hasPrefill = params.has('plaetze');

  var S = {
    haus: (params.get('haus') || '').slice(0, 80),
    platz: Math.max(10, Math.min(300, parseInt(params.get('plaetze'), 10) || 80)),
    tipp: null, ks: null, ksExact: null, bridge: [],
    vk: null, kosten: null,
    guess: [], answers: {}
  };
  var path = [];
  var current = null;

  // Mit vorbelegter Platzzahl (Link aus der Mail) entfällt die erste Frage
  var FLOW1 = hasPrefill ? ['tipp', 'ks', 'bridge'] : ['haus', 'tipp', 'ks', 'bridge'];
  var SEQ2 = ['guess', 'A1', 'B1', 'C1', 'D1', 'E1', 'befund'];

  /* ---------- Hilfsfunktionen ---------- */
  function h(tag, props, kids) {
    var e = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  function icon(name) {
    var d = { arrow: 'M3 8h10M9 4l4 4-4 4', back: 'M13 8H3M7 4L3 8l4 4' }[name];
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '16'); svg.setAttribute('height', '16'); svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'none'); svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '1.6');
    p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p);
    return svg;
  }
  function btn(label, cls, onclick, withArrow) {
    var b = h('button', { type: 'button', class: 'btn ' + (cls || 'btn-primary'), onclick: onclick }, [label]);
    if (withArrow) b.appendChild(icon('arrow'));
    return b;
  }
  function currentCalc() {
    return C.calc({ platz: S.platz, ks: S.ks, ksExact: S.ksExact, bridge: S.bridge, vk: S.vk, kosten: S.kosten });
  }

  /* ---------- Rahmen: Fortschritt, Zurück, Ticker ---------- */
  function progressFor(key) {
    var i1 = FLOW1.indexOf(key);
    if (i1 >= 0) return { pct: i1 / FLOW1.length, label: 'Die Zahl · Frage ' + (i1 + 1) + ' von ' + FLOW1.length };
    if (key === 'result1') return { pct: 1, label: 'Die Zahl · Ergebnis' };
    if (key === 'befund') return { pct: 1, label: 'Das Muster · Befund' };
    var i2 = SEQ2.indexOf(key);
    return { pct: i2 / (SEQ2.length - 1), label: 'Das Muster · Frage ' + (i2 + 1) + ' von ' + (SEQ2.length - 1) };
  }

  function frame(key, o) {
    var pr = progressFor(key);
    var canBack = path.length > 1 && key !== 'result1' && key !== 'befund';
    var top = h('div', { class: 'rc-top' }, [
      h('div', { class: 'rc-top-row' }, [
        canBack ? h('button', { type: 'button', class: 'rc-back', onclick: back, 'aria-label': 'Zurück' }, [icon('back'), ' Zurück']) : h('span', { class: 'rc-back-spacer' }),
        h('span', { class: 'rc-stagelabel', text: pr.label }),
        o.ticker ? tickerEl() : h('span')
      ]),
      h('div', { class: 'rc-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(pr.pct * 100) }, [
        h('i', { style: 'width:' + Math.round(pr.pct * 100) + '%' })
      ])
    ]);
    var head = h('div', { class: 'rc-head' }, [
      o.kicker ? h('h4', { text: o.kicker }) : null,
      o.title ? h('h2', { class: 'rc-title', tabindex: '-1', text: o.title }) : null,
      o.sub ? h('p', { class: 'rc-sub', text: o.sub }) : null
    ]);
    var body = h('div', { class: 'rc-body' });
    var foot = h('div', { class: 'rc-foot' });
    stage.replaceChildren(top, head, body, foot);
    return { body: body, foot: foot, head: head };
  }
  function tickerEl() {
    var c = currentCalc();
    return h('span', { class: 'rc-ticker', 'aria-live': 'polite', title: 'Laufende Schätzung, wird mit jeder Antwort genauer' }, [
      'Ticker: ' + C.eur(c.mid, 5000) + ' pro Jahr'
    ]);
  }
  function focusTitle() {
    var t = stage.querySelector('.rc-title');
    if (t) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }
  }
  function scrollToStage() {
    var r = stage.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight * 0.4) {
      window.scrollTo({ top: window.scrollY + r.top - 110, behavior: reduced ? 'auto' : 'smooth' });
    }
  }

  /* ---------- Navigation ---------- */
  function go(key, noPush) {
    current = key;
    if (!noPush) path.push(key);
    render(key);
    focusTitle();
    scrollToStage();
  }
  function back() {
    if (path.length < 2) return;
    path.pop();
    go(path[path.length - 1], true);
  }
  function nextFrom(key) {
    var i1 = FLOW1.indexOf(key);
    if (i1 >= 0) return i1 + 1 < FLOW1.length ? FLOW1[i1 + 1] : 'result1';
    if (key === 'result1') return SEQ2[0];
    var i = SEQ2.indexOf(key);
    return i >= 0 && i + 1 < SEQ2.length ? SEQ2[i + 1] : 'befund';
  }
  function next() { go(nextFrom(current)); }

  function render(key) {
    if (key === 'haus') return rHaus();
    if (key === 'tipp') return rTipp();
    if (key === 'ks') return rKs();
    if (key === 'bridge') return rBridge();
    if (key === 'result1') return rResult1();
    if (key === 'guess') return rGuess();
    if (key === 'befund') return rBefund();
    var q = C.qById(key);
    if (q) return rQuestion(q);
  }

  /* ---------- Antwortkarten ---------- */
  function optionButton(o, selected, onclick, extraClass) {
    return h('button', { type: 'button', class: 'rc-opt' + (selected ? ' is-selected' : '') + (extraClass ? ' ' + extraClass : ''), 'aria-pressed': selected ? 'true' : 'false', onclick: onclick }, [
      o.dot ? h('span', { class: 'rc-dot rc-dot-' + o.dot, 'aria-hidden': 'true' }) : null,
      h('span', { class: 'rc-opt-t', text: o.t }),
      o.sub ? h('span', { class: 'rc-opt-sub', text: o.sub }) : null
    ]);
  }
  // Einzelauswahl: Karte markieren, Antwort speichern, nach kurzer Pause weiter
  function pick(btnEl, grid, save) {
    Array.prototype.forEach.call(grid.children, function (c) { c.classList.remove('is-selected'); });
    btnEl.classList.add('is-selected');
    save();
    setTimeout(next, reduced ? 0 : 240);
  }

  /* ---------- Stufe 1 ---------- */
  function rHaus() {
    var f = frame('haus', { title: 'Wie viele Plätze hat Ihr Haus?' });
    var out = h('output', { class: 'rc-bignum', for: 'rc-platz' }, [String(S.platz)]);
    var range = h('input', { type: 'range', id: 'rc-platz', class: 'rc-range', min: '10', max: '300', step: '1', value: String(S.platz), 'aria-label': 'Anzahl Plätze' });
    range.addEventListener('input', function () { S.platz = +range.value; out.textContent = String(S.platz); });
    f.body.appendChild(h('div', { class: 'rc-field' }, [h('div', { class: 'rc-range-row' }, [out, h('span', { class: 'rc-unit', text: 'Plätze' })]), range]));
    f.foot.appendChild(btn('Weiter', 'btn-primary', next, true));
    f.foot.appendChild(h('span', { class: 'rc-note', text: 'Ihre Angaben bleiben in Ihrem Browser.' }));
  }

  function rTipp() {
    var max = Math.round(S.platz * C.CFG.tippProPlatz / 10000) * 10000;
    var f = frame('tipp', { title: 'Was schätzen Sie: Was kosten Krankheitsausfälle Ihr Haus im Jahr?', sub: 'Aus dem Bauch. Danach zeigen wir, wie nah Sie waren.' });
    var out = h('output', { class: 'rc-bignum rc-bignum-muted', for: 'rc-tipp' }, ['Bitte ziehen']);
    var range = h('input', { type: 'range', id: 'rc-tipp', class: 'rc-range', min: '0', max: String(max), step: '10000', value: String(Math.round(max / 2 / 10000) * 10000), 'aria-label': 'Ihr Tipp in Euro pro Jahr' });
    var ok = btn('Tipp abgeben', 'btn-primary', function () { S.tipp = +range.value; next(); }, true);
    ok.disabled = true;
    function upd() { out.textContent = C.eur(+range.value, 10000); out.classList.remove('rc-bignum-muted'); ok.disabled = false; }
    range.addEventListener('input', upd);
    range.addEventListener('change', upd);
    if (S.tipp != null) { range.value = String(S.tipp); upd(); }
    f.body.appendChild(h('div', { class: 'rc-field' }, [out, range, h('div', { class: 'rc-scale' }, [h('span', { text: '0 €' }), h('span', { text: C.eur(max, 10000) })])]));
    f.foot.appendChild(ok);
  }

  function rKs() {
    var f = frame('ks', { title: 'Wie fühlt sich ein normaler Monat an?', sub: 'Ein Gefühl genügt, es muss keine Zahl sein.' });
    var grid = h('div', { class: 'rc-opts rc-cols-2' });
    C.KS.forEach(function (o, i) {
      var b = optionButton(o, S.ks === i && S.ksExact == null, function () { S.ksExact = null; pick(b, grid, function () { S.ks = i; }); });
      grid.appendChild(b);
    });
    f.body.appendChild(grid);
    var inp = h('input', { type: 'number', id: 'rc-exact', class: 'rc-input rc-input-s', min: '1', max: '30', step: '0.1', placeholder: 'z. B. 8,5', inputmode: 'decimal', 'aria-label': 'Krankenstand in Prozent' });
    var ok = btn('Übernehmen', 'btn-secondary', function () {
      var v = parseFloat(String(inp.value).replace(',', '.'));
      if (!(v >= 1 && v <= 30)) { inp.classList.add('is-error'); inp.focus(); return; }
      S.ksExact = v; S.ks = null; next();
    });
    var row = h('div', { class: 'rc-exact-row', hidden: true }, [inp, h('span', { class: 'rc-unit', text: '% Krankenstand' }), ok]);
    var toggle = h('button', { type: 'button', class: 'rc-link', text: 'Ich kenne die genaue Zahl' });
    toggle.addEventListener('click', function () { row.hidden = !row.hidden; if (!row.hidden) inp.focus(); });
    if (S.ksExact != null) { inp.value = String(S.ksExact).replace('.', ','); row.hidden = false; }
    f.foot.appendChild(h('div', { class: 'rc-exact' }, [toggle, row]));
  }

  function rBridge() {
    var f = frame('bridge', { title: 'Was passiert zuerst, wenn heute früh jemand ausfällt?', ticker: true });
    var ids = Object.keys(C.BRIDGE);
    var grid = h('div', { class: 'rc-opts rc-cols-1' });
    ids.forEach(function (id) {
      var b = optionButton({ t: C.BRIDGE[id].t }, S.bridge[0] === id, function () { pick(b, grid, function () { S.bridge = [id]; }); });
      grid.appendChild(b);
    });
    f.body.appendChild(grid);
  }

  /* ---------- Ergebnis Stufe 1 ---------- */
  function countUp(el, to, dur) {
    if (reduced || !dur) { el.textContent = C.fmt(Math.round(to / 1000) * 1000); return; }
    var t0 = null;
    // Sicherheitsnetz: Browser pausieren Animationen in Hintergrund-Tabs, die Zahl soll trotzdem erscheinen
    setTimeout(function () { el.textContent = C.fmt(Math.round(to / 1000) * 1000); }, dur + 600);
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = C.fmt(Math.round(to * e / 1000) * 1000);
      if (p < 1) requestAnimationFrame(step); else el.textContent = C.fmt(Math.round(to / 1000) * 1000);
    }
    requestAnimationFrame(step);
  }

  function tippMessage(c) {
    if (S.tipp == null) return null;
    var diff = (S.tipp - c.mid) / c.mid;
    var pct = Math.round(Math.abs(diff) * 100);
    if (pct <= 15) return { cls: 'good', t: 'Gut geschätzt: Ihr Tipp lag nur ' + pct + ' Prozent daneben.' };
    return { cls: 'warn', t: 'Ihr Tipp (' + C.eur(S.tipp, 10000) + ') lag ' + pct + ' Prozent ' + (diff < 0 ? 'unter' : 'über') + ' dem Ergebnis.' };
  }
  function tile(num, label) {
    return h('div', { class: 'rc-tile' }, [h('b', { text: num }), h('span', { text: label })]);
  }

  function rResult1() {
    var c = currentCalc();
    var f = frame('result1', { kicker: S.haus ? S.haus : 'Ihr Ergebnis', title: 'Krankheitsausfälle kosten Ihr Haus im Jahr etwa' });
    var numEl = h('span', { class: 'rc-result-num', 'aria-live': 'polite' }, [reduced ? C.fmt(Math.round(c.mid / 1000) * 1000) : '…']);
    f.body.appendChild(h('div', { class: 'rc-result' }, [numEl, h('span', { class: 'rc-result-cur', text: ' €' })]));
    f.body.appendChild(h('p', { class: 'rc-result-range', text: 'Spanne: ' + C.eur(c.lo) + ' bis ' + C.eur(c.hi) + '. Eine Schätzung, ' + (c.exakt ? 'mit Ihrer Prozentangabe recht genau.' : 'eher grob.') }));
    if (!reduced) setTimeout(function () { countUp(numEl, c.mid, 1400); }, 900); else countUp(numEl, c.mid, 0);

    var tm = tippMessage(c);
    if (tm) f.body.appendChild(h('p', { class: 'rc-tipp-msg ' + tm.cls, text: tm.t }));

    f.body.appendChild(h('div', { class: 'rc-tiles rc-tiles-2' }, [
      tile(C.dec1(c.av), 'Vollkräfte, die Sie bezahlen und nicht im Dienst haben'),
      tile(C.fmt(Math.round(c.perPlatzMonat / 10) * 10) + ' €', 'je Platz und Monat')
    ]));
    f.body.appendChild(calcDetails(c));

    f.foot.appendChild(h('div', { class: 'rc-next' }, [
      h('div', {}, [h('h3', { text: 'Und woran liegt das?' }), h('p', { class: 'rc-sub', text: 'Sechs Fragen, etwa eine Minute.' })]),
      h('div', { class: 'rc-next-actions' }, [
        btn('Muster-Check starten', 'btn-primary', next, true),
        btn('Ergebnis kopieren', 'btn-secondary', function (e) { copy(summaryText(c), e.currentTarget, 'Kopiert'); })
      ])
    ]));
  }

  function summaryText(c) {
    return 'Ausfall-Rechner (Klinovum): Krankheitsausfälle kosten ' + (S.haus ? S.haus : 'das Haus') + ' im Jahr etwa ' + C.eur(c.mid) + ' (Spanne ' + C.eur(c.lo) + ' bis ' + C.eur(c.hi) + '), das entspricht ' + C.dec1(c.av) + ' Vollkräften. Ein Prozentpunkt Krankenstand ist etwa ' + C.eur(c.pp) + ' im Jahr wert. Alle Werte sind Schätzungen.';
  }

  // Alles Zusätzliche steckt hinter einem Aufklapper
  function calcDetails(c) {
    var d = h('details', { class: 'rc-assume' }, [h('summary', { text: 'So haben wir gerechnet' })]);
    var tot = c.l1 + c.l2;
    d.appendChild(h('div', { class: 'rc-stack', role: 'img', 'aria-label': 'Verteilung der Kosten' }, [
      h('i', { class: 'l1', style: 'width:' + Math.round(c.l1 / tot * 100) + '%' }),
      h('i', { class: 'l2', style: 'width:' + Math.round(c.l2 / tot * 100) + '%' })
    ]));
    d.appendChild(h('ul', { class: 'rc-legend' }, [
      h('li', null, [h('i', { class: 'l1' }), ' Entgeltfortzahlung: ' + C.eur(c.l1)]),
      h('li', null, [h('i', { class: 'l2' }), ' Einspringen, Prämien, Springer, Zeitarbeit: ' + C.eur(c.l2)])
    ]));
    d.appendChild(h('p', { class: 'rc-note', text: 'Ein Prozentpunkt Krankenstand ist etwa ' + C.eur(c.pp) + ' im Jahr wert. Nicht enthalten sind Folgekosten durch Folgeausfälle und Fluktuation, geschätzt bis zu ' + C.eur(c.folge) + ' zusätzlich.' + ((S.bridge[0] === 'unter' || S.bridge[0] === 'verschieben') ? ' Was Sie nicht ersetzen, kostet kein Geld, aber Belastung.' : '') }));
    var vk = h('input', { type: 'number', id: 'rc-vk', class: 'rc-input rc-input-s', min: '5', max: '500', step: '0.5', value: String(Math.round(c.vk * 10) / 10) });
    var ko = h('input', { type: 'number', id: 'rc-ko', class: 'rc-input rc-input-s', min: '30000', max: '120000', step: '1000', value: String(c.kosten) });
    d.appendChild(h('div', { class: 'rc-assume-grid' }, [
      h('div', { class: 'rc-field' }, [h('label', { for: 'rc-vk', text: 'Vollkräfte Pflege und Betreuung' }), vk]),
      h('div', { class: 'rc-field' }, [h('label', { for: 'rc-ko', text: 'Arbeitgeberkosten je Vollkraft und Jahr (€)' }), ko])
    ]));
    d.appendChild(h('p', { class: 'rc-note', text: 'Vorgabe: ' + C.CFG.vkProPlatz + ' Vollkräfte je Platz und ' + C.fmt(C.CFG.kostenJeVk) + ' € je Vollkraft. Der Ersatz kostet je nach Weg ein Vielfaches der Normalstunde (Einspringen am freien Tag rund das 1,15-Fache, Springer das 1,05-Fache, Zeitarbeit das 1,8-Fache). Das sind Annahmen, keine Messwerte.' }));
    d.appendChild(btn('Neu rechnen', 'btn-secondary', function () {
      var v = parseFloat(vk.value), k = parseFloat(ko.value);
      S.vk = v > 0 ? v : null; S.kosten = k > 0 ? k : null;
      render('result1');
    }));
    return d;
  }

  function copy(text, btnEl, doneLabel) {
    var old = btnEl.textContent;
    function done() { btnEl.textContent = doneLabel; setTimeout(function () { btnEl.textContent = old; }, 1800); }
    function fallback() {
      var ta = h('textarea', { style: 'position:fixed;left:-9999px' }); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* ignorieren */ }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }

  /* ---------- Stufe 2 ---------- */
  function rGuess() {
    var f = frame('guess', { title: 'Woran liegt es bei Ihnen vor allem?', sub: 'Erst Ihr Bauchgefühl. Am Ende legen wir es neben den Befund.' });
    var grid = h('div', { class: 'rc-opts rc-cols-2' });
    C.GUESS.forEach(function (g) {
      var b = optionButton({ t: g.t }, S.guess[0] === g.id, function () { pick(b, grid, function () { S.guess = [g.id]; }); });
      grid.appendChild(b);
    });
    var dk = optionButton({ t: 'Weiß ich nicht' }, S.guess[0] === 'dk', function () { pick(dk, grid, function () { S.guess = ['dk']; }); }, 'rc-opt-dk');
    grid.appendChild(dk);
    f.body.appendChild(grid);
  }

  function rQuestion(q) {
    var f = frame(q.id, { kicker: C.FIELDS.filter(function (x) { return x.id === q.f; })[0].name, title: q.text, sub: q.sub });
    var cur = S.answers[q.id];
    var grid = h('div', { class: 'rc-opts ' + (q.opts.length === 3 ? 'rc-cols-3' : 'rc-cols-2') });
    q.opts.forEach(function (o, i) {
      var b = optionButton(o, Array.isArray(cur) && cur[0] === i, function () { pick(b, grid, function () { S.answers[q.id] = [i]; }); });
      grid.appendChild(b);
    });
    var dk = optionButton({ t: 'Weiß ich nicht' }, C.isDk(cur), function () { pick(dk, grid, function () { S.answers[q.id] = 'dk'; }); }, 'rc-opt-dk');
    grid.appendChild(dk);
    f.body.appendChild(grid);
  }

  /* ---------- Befund ---------- */
  function guessMessage(F, tops) {
    var top = tops[0];
    var g = C.GUESS.filter(function (x) { return x.id === S.guess[0]; })[0];
    if (F[top.id] < 60) return 'Ihre Antworten zeigen in keinem Feld deutlichen Druck.' + (g ? ' Sie vermuteten „' + g.t + '“.' : '');
    if (!g) return 'Sie hatten keine Vermutung. Jetzt haben Sie eine Richtung: Am stärksten ist bei Ihnen „' + top.short + '“.';
    if (g.field === top.id) return 'Sie vermuteten „' + g.t + '“ und lagen richtig: Das ist Ihr stärkstes Feld.';
    if (!g.field) return 'Sie vermuteten „' + g.t + '“, das lässt sich schwer beeinflussen. Ihre Antworten zeigen „' + top.short + '“ als stärkstes Feld, und dort können Sie ansetzen.';
    return 'Sie vermuteten „' + g.t + '“. Ihre Antworten zeigen „' + top.short + '“ als stärkstes Feld.';
  }

  function rBefund() {
    var c = currentCalc();
    var F = C.fieldScores(S.answers);
    var det = C.detect(F, S.answers);
    var P = C.PATTERNS[det.haupt.id];
    var tops = C.topFields(F);
    var f = frame('befund', { kicker: S.haus ? S.haus : null, title: 'Ihr Befund' });

    // 1. Muster
    f.body.appendChild(h('section', { class: 'rc-typ' }, [
      h('span', { class: 'badge badge-blue', text: 'Ihr Muster' }),
      h('h3', { text: P.name }),
      h('p', { class: 'rc-typ-sub', text: P.typ }),
      h('p', { text: P.kern })
    ]));
    f.body.appendChild(h('p', { class: 'rc-summary' }, [
      'Die Ausfälle kosten Sie etwa ', h('b', { text: C.eur(c.mid) }), ' im Jahr, das entspricht ', h('b', { text: C.dec1(c.av) + ' Vollkräften' }), '. Ein Prozentpunkt Krankenstand ist ', h('b', { text: C.eur(c.pp) }), ' wert.'
    ]));

    // 2. Fieberkurve
    var thermo = h('section', { class: 'rc-section-in' }, [h('h3', { text: 'Wo der Druck sitzt' })]);
    C.FIELDS.forEach(function (fl) {
      var v = F[fl.id], b = C.band(v);
      thermo.appendChild(h('div', { class: 'rc-thermo-row' }, [
        h('span', { class: 'rc-thermo-name', text: fl.name }),
        h('div', { class: 'rc-thermo-bar' }, [h('i', { class: b, style: 'width:' + Math.max(4, v) + '%' })]),
        h('span', { class: 'rc-thermo-tag ' + b, text: C.BAND_LABEL[b] })
      ]));
    });
    thermo.appendChild(h('p', { class: 'rc-tipp-msg', text: guessMessage(F, tops) }));
    f.body.appendChild(thermo);

    // 3. Ein Hebel
    f.body.appendChild(h('section', { class: 'rc-section-in' }, [
      h('h3', { text: 'Ihr nächster Schritt' }),
      h('p', { class: 'rc-lever-main', text: P.allein }),
      h('p', { class: 'rc-note', text: 'Ob es wirkt: ' + P.mess })
    ]));

    // 4. Träger-Brief nur auf Wunsch
    var letter = C.buildLetter(S, c, F, det);
    f.body.appendChild(h('details', { class: 'rc-assume' }, [
      h('summary', { text: 'Entwurf für Ihren Träger anzeigen' }),
      h('pre', { class: 'rc-letter', tabindex: '0' }, [letter]),
      h('div', { class: 'rc-actions-row' }, [
        btn('Brief kopieren', 'btn-primary', function (e) { copy(letter, e.currentTarget, 'Kopiert'); }),
        btn('Befund drucken', 'btn-secondary', function () { window.print(); })
      ])
    ]));

    f.body.appendChild(h('p', { class: 'rc-note', text: 'Orientierung auf Basis Ihrer Angaben, keine Diagnose. Alle Werte sind Schätzungen.' }));

    f.foot.appendChild(h('div', { class: 'rc-cta' }, [
      h('div', {}, [h('h3', { text: 'Befund gemeinsam durchsprechen' }), h('p', { text: '30 Minuten, vertraulich, ohne Verkaufsdruck.' })]),
      h('a', { class: 'btn btn-secondary is-white', href: '../erstgesprach' }, ['Erstgespräch vereinbaren', icon('arrow')])
    ]));
    f.foot.appendChild(h('button', { type: 'button', class: 'rc-link rc-restart', text: 'Neu starten', onclick: restart }));
  }

  function restart() {
    S.tipp = null; S.ks = null; S.ksExact = null; S.bridge = []; S.vk = null; S.kosten = null; S.guess = []; S.answers = {};
    path = [FLOW1[0]]; current = FLOW1[0]; render(current); focusTitle(); scrollToStage();
  }

  /* ---------- Start ---------- */
  document.querySelectorAll('[data-rc-start]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      var sec = document.getElementById('rechner');
      if (sec) sec.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
  });
  // Erster Bildschirm ohne Scrollen und ohne Fokus-Wechsel
  path = [FLOW1[0]]; current = FLOW1[0]; render(current);
})();
