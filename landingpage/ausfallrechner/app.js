/* Klinovum Ausfall-Rechner: Oberfläche. Rechenlogik steht in rechner.js. */
(function () {
  'use strict';
  var C = window.AusfallRechnerCore;
  var stage = document.getElementById('rc-stage');
  if (!C || !stage) return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = new URLSearchParams(window.location.search);

  var S = {
    haus: (params.get('haus') || '').slice(0, 80),
    platz: Math.max(10, Math.min(300, parseInt(params.get('plaetze'), 10) || 80)),
    tipp: null, ks: null, ksExact: null, bridge: [], lang: null,
    vk: null, kosten: null,
    guess: [], answers: {}
  };
  var path = [];
  var current = null;

  var STAGE1 = ['haus', 'tipp', 'ks', 'bridge', 'lang'];
  var SEQ2 = (function () {
    var seq = ['guess'];
    ['A', 'B', 'C', 'D', 'E'].forEach(function (f) {
      C.QUESTIONS.forEach(function (q) { if (q.f === f) seq.push(q.id); });
      seq.push('echo' + f);
    });
    C.KNOW.forEach(function (q) { seq.push(q.id); });
    seq.push('befund');
    return seq;
  })();

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
    var d = {
      arrow: 'M3 8h10M9 4l4 4-4 4',
      back: 'M13 8H3M7 4L3 8l4 4',
      check: 'M3 8.5l3.2 3.2L13 5'
    }[name];
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
  function currentCalc(extra) {
    return C.calc({
      platz: S.platz, ks: S.ks, ksExact: S.ksExact, bridge: S.bridge, lang: S.lang,
      vk: S.vk, kosten: S.kosten
    });
  }

  /* ---------- Rahmen mit Fortschritt, Zurück und Ticker ---------- */
  function progressFor(key) {
    var i1 = STAGE1.indexOf(key);
    if (i1 >= 0) return { stage: 1, pct: i1 / (STAGE1.length + 0), label: 'Stufe 1 von 2 · Die Zahl' };
    if (key === 'result1') return { stage: 1, pct: 1, label: 'Stufe 1 von 2 · Ergebnis' };
    var i2 = SEQ2.indexOf(key);
    return { stage: 2, pct: Math.max(0, i2) / (SEQ2.length - 1), label: 'Stufe 2 von 2 · Das Muster' };
  }

  function frame(key, o) {
    var pr = progressFor(key);
    var top = h('div', { class: 'rc-top' }, [
      h('div', { class: 'rc-top-row' }, [
        path.length > 1 && key !== 'result1' && key !== 'befund' ? h('button', { type: 'button', class: 'rc-back', onclick: back, 'aria-label': 'Zurück' }, [icon('back'), ' Zurück']) : h('span', { class: 'rc-back-spacer' }),
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
    var key = path[path.length - 1];
    go(key, true);
  }
  function nextFrom(key) {
    var i1 = STAGE1.indexOf(key);
    if (i1 >= 0) return i1 + 1 < STAGE1.length ? STAGE1[i1 + 1] : 'result1';
    var i = SEQ2.indexOf(key);
    for (var j = i + 1; j < SEQ2.length; j++) {
      var q = C.qById(SEQ2[j]);
      if (q && q.skipIf && q.skipIf(S.answers)) continue;
      return SEQ2[j];
    }
    return 'befund';
  }
  function next() { go(nextFrom(current)); }

  /* ---------- Bildschirme ---------- */
  function render(key) {
    if (key === 'haus') return rHaus();
    if (key === 'tipp') return rTipp();
    if (key === 'ks') return rKs();
    if (key === 'bridge') return rBridge();
    if (key === 'lang') return rLang();
    if (key === 'result1') return rResult1();
    if (key === 'guess') return rGuess();
    if (key.indexOf('echo') === 0) return rEcho(key.slice(4));
    if (key === 'befund') return rBefund();
    var q = C.qById(key);
    if (q) return rQuestion(q);
  }

  function rHaus() {
    var f = frame('haus', { kicker: 'Los geht’s', title: 'Für welches Haus rechnen wir?', sub: 'Zwei Angaben genügen. Alles Weitere sind Karten zum Antippen.' });
    var name = h('input', { type: 'text', id: 'rc-haus', class: 'rc-input', placeholder: 'z. B. Haus Sonnenhalde', value: S.haus, maxlength: '80', autocomplete: 'off' });
    name.addEventListener('input', function () { S.haus = name.value.trim(); });
    var out = h('output', { class: 'rc-bignum', for: 'rc-platz' }, [String(S.platz)]);
    var range = h('input', { type: 'range', id: 'rc-platz', class: 'rc-range', min: '10', max: '300', step: '1', value: String(S.platz), 'aria-label': 'Anzahl Plätze' });
    range.addEventListener('input', function () { S.platz = +range.value; out.textContent = String(S.platz); });
    f.body.appendChild(h('div', { class: 'rc-field' }, [h('label', { for: 'rc-haus', text: 'Name des Hauses (optional)' }), name]));
    f.body.appendChild(h('div', { class: 'rc-field' }, [
      h('label', { for: 'rc-platz', text: 'Wie viele Plätze hat Ihr Haus?' }),
      h('div', { class: 'rc-range-row' }, [out, h('span', { class: 'rc-unit', text: 'Plätze' })]),
      range
    ]));
    f.foot.appendChild(btn('Weiter', 'btn-primary', next, true));
    f.foot.appendChild(h('span', { class: 'rc-note', text: 'Ihre Angaben bleiben in Ihrem Browser. Nichts wird gesendet.' }));
  }

  function rTipp() {
    var max = Math.round(S.platz * C.CFG.tippProPlatz / 10000) * 10000;
    var f = frame('tipp', { kicker: 'Das Tippspiel', title: 'Was schätzen Sie: Was kosten Krankheitsausfälle Ihr Haus im Jahr?', sub: 'Aus dem Bauch, ohne Rechnen. Danach zeigen wir, wie nah Sie waren.' });
    var out = h('output', { class: 'rc-bignum rc-bignum-muted', for: 'rc-tipp' }, ['Bitte ziehen']);
    var range = h('input', { type: 'range', id: 'rc-tipp', class: 'rc-range', min: '0', max: String(max), step: '10000', value: String(Math.round(max / 2 / 10000) * 10000), 'aria-label': 'Ihr Tipp in Euro pro Jahr' });
    var go1 = btn('Tipp abgeben', 'btn-primary', function () { S.tipp = +range.value; next(); }, true);
    go1.disabled = true;
    function upd() {
      out.textContent = C.eur(+range.value, 10000);
      out.classList.remove('rc-bignum-muted');
      go1.disabled = false;
    }
    range.addEventListener('input', upd);
    range.addEventListener('change', upd);
    if (S.tipp != null) { range.value = String(S.tipp); upd(); }
    f.body.appendChild(h('div', { class: 'rc-field' }, [out, range, h('div', { class: 'rc-scale' }, [h('span', { text: '0 €' }), h('span', { text: C.eur(max, 10000) })])]));
    f.foot.appendChild(go1);
  }

  function optionButton(o, selected, onclick, extraClass) {
    var b = h('button', { type: 'button', class: 'rc-opt' + (selected ? ' is-selected' : '') + (extraClass ? ' ' + extraClass : ''), 'aria-pressed': selected ? 'true' : 'false', onclick: onclick }, [
      o.dot ? h('span', { class: 'rc-dot rc-dot-' + o.dot, 'aria-hidden': 'true' }) : null,
      h('span', { class: 'rc-opt-t', text: o.t }),
      o.sub ? h('span', { class: 'rc-opt-sub', text: o.sub }) : null
    ]);
    return b;
  }
  function pickAndGo(btnEl, grid, fn) {
    Array.prototype.forEach.call(grid.children, function (c) { c.classList.remove('is-selected'); });
    btnEl.classList.add('is-selected');
    fn();
    setTimeout(next, reduced ? 0 : 240);
  }

  function rKs() {
    var f = frame('ks', { kicker: 'Frage 1 von 3', title: 'Wie fühlt sich ein normaler Monat an?', sub: 'Denken Sie an die letzten Monate. Ein Gefühl genügt, es muss keine Zahl sein.' });
    var grid = h('div', { class: 'rc-opts rc-cols-2' });
    C.KS.forEach(function (o, i) {
      var b = optionButton(o, S.ks === i && S.ksExact == null, function () { S.ksExact = null; pickAndGo(b, grid, function () { S.ks = i; }); });
      grid.appendChild(b);
    });
    f.body.appendChild(grid);
    var box = h('div', { class: 'rc-exact' });
    var toggle = h('button', { type: 'button', class: 'rc-link', text: 'Ich kenne die genaue Zahl' });
    var inp = h('input', { type: 'number', id: 'rc-exact', class: 'rc-input rc-input-s', min: '1', max: '30', step: '0.1', placeholder: 'z. B. 8,5', inputmode: 'decimal', 'aria-label': 'Krankenstand in Prozent' });
    var ok = btn('Übernehmen', 'btn-secondary', function () {
      var v = parseFloat(String(inp.value).replace(',', '.'));
      if (!(v >= 1 && v <= 30)) { inp.classList.add('is-error'); inp.focus(); return; }
      S.ksExact = v; S.ks = null; next();
    });
    var row = h('div', { class: 'rc-exact-row', hidden: true }, [inp, h('span', { class: 'rc-unit', text: '% Krankenstand' }), ok]);
    toggle.addEventListener('click', function () { row.hidden = !row.hidden; if (!row.hidden) inp.focus(); });
    if (S.ksExact != null) { inp.value = String(S.ksExact).replace('.', ','); row.hidden = false; }
    box.appendChild(toggle); box.appendChild(row);
    f.foot.appendChild(box);
  }

  function rBridge() {
    var f = frame('bridge', { kicker: 'Frage 2 von 3', title: 'Was passiert zuerst, wenn heute früh jemand ausfällt?', sub: 'Wählen Sie bis zu zwei Antworten.', ticker: true });
    var grid = h('div', { class: 'rc-opts rc-cols-1' });
    var cont = btn('Weiter', 'btn-primary', next, true);
    function sync() { cont.disabled = S.bridge.length === 0; }
    Object.keys(C.BRIDGE).forEach(function (id) {
      var o = C.BRIDGE[id];
      var b = optionButton({ t: o.t }, S.bridge.indexOf(id) >= 0, function () {
        var i = S.bridge.indexOf(id);
        if (i >= 0) S.bridge.splice(i, 1);
        else { if (S.bridge.length >= 2) S.bridge.shift(); S.bridge.push(id); }
        Array.prototype.forEach.call(grid.children, function (c, idx) {
          var on = S.bridge.indexOf(Object.keys(C.BRIDGE)[idx]) >= 0;
          c.classList.toggle('is-selected', on); c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        sync();
        var t = stage.querySelector('.rc-ticker'); if (t) t.replaceWith(tickerEl());
      });
      grid.appendChild(b);
    });
    f.body.appendChild(grid);
    f.foot.appendChild(cont);
    sync();
  }

  function rLang() {
    var f = frame('lang', { kicker: 'Frage 3 von 3', title: 'Fehlt gerade jemand länger als sechs Wochen?', sub: 'Danach richtet sich, wie viel Lohn bei Ihnen weiterläuft und wie viel die Krankenkasse übernimmt.', ticker: true });
    var grid = h('div', { class: 'rc-opts rc-cols-2' });
    C.LANG.forEach(function (o, i) {
      var b = optionButton(o, S.lang === i, function () { pickAndGo(b, grid, function () { S.lang = i; }); });
      grid.appendChild(b);
    });
    f.body.appendChild(grid);
  }

  /* ---------- Ergebnis Stufe 1 ---------- */
  function countUp(el, to, dur) {
    if (reduced) { el.textContent = C.fmt(to); return; }
    var t0 = null;
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
    if (pct <= 15) return { cls: 'good', t: 'Gut geschätzt. Ihr Tipp (' + C.eur(S.tipp, 10000) + ') lag nur ' + pct + ' Prozent daneben.' };
    if (diff < 0) return { cls: 'warn', t: 'Ihr Tipp (' + C.eur(S.tipp, 10000) + ') lag ' + pct + ' Prozent unter dem Ergebnis. Diese Kosten sind schwer zu sehen, weil sie auf viele Posten verteilt sind.' };
    return { cls: 'warn', t: 'Ihr Tipp (' + C.eur(S.tipp, 10000) + ') lag ' + pct + ' Prozent über dem Ergebnis. Die Kernzahl fällt niedriger aus, als Sie erwartet haben.' };
  }

  function rResult1() {
    var c = currentCalc();
    var f = frame('result1', { kicker: S.haus ? 'Ergebnis für ' + S.haus : 'Ihr Ergebnis', title: 'Krankheitsausfälle kosten Ihr Haus im Jahr etwa' });
    var big = h('div', { class: 'rc-result' }, [
      h('span', { class: 'rc-result-num', 'aria-live': 'polite' }, [reduced ? C.fmt(Math.round(c.mid / 1000) * 1000) : '…']),
      h('span', { class: 'rc-result-cur', text: ' €' })
    ]);
    var numEl = big.firstChild;
    var range = h('p', { class: 'rc-result-range' }, ['Spanne: ' + C.eur(c.lo) + ' bis ' + C.eur(c.hi) + '. ' + (c.exakt ? 'Genauigkeit: gut, mit Ihrer Prozentangabe.' : 'Genauigkeit: Schätzung, eher grob.')]);
    f.body.appendChild(big);
    f.body.appendChild(range);
    if (!reduced) setTimeout(function () { countUp(numEl, c.mid, 1400); }, 900); else numEl.textContent = C.fmt(Math.round(c.mid / 1000) * 1000);

    var tm = tippMessage(c);
    if (tm) f.body.appendChild(h('p', { class: 'rc-tipp-msg ' + tm.cls, text: tm.t }));

    f.body.appendChild(h('div', { class: 'rc-tiles' }, [
      tile(C.dec1(c.av), 'Vollkräfte, die Sie bezahlen und nicht im Dienst haben'),
      tile(C.fmt(Math.round(c.perPlatzMonat / 10) * 10) + ' €', 'je Platz und Monat'),
      tile(C.eur(c.pp), 'ist ein Prozentpunkt Krankenstand im Jahr wert'),
      tile(C.eur(c.proMonat, 1000), 'kostet jeder Monat ohne Veränderung')
    ]));

    var tot = c.l1 + c.l2;
    f.body.appendChild(h('div', { class: 'rc-layers' }, [
      h('h4', { text: 'Woraus sich die Zahl zusammensetzt' }),
      h('div', { class: 'rc-stack', role: 'img', 'aria-label': 'Verteilung der Kosten' }, [
        h('i', { class: 'l1', style: 'width:' + Math.round(c.l1 / tot * 100) + '%' }),
        h('i', { class: 'l2', style: 'width:' + Math.round(c.l2 / tot * 100) + '%' })
      ]),
      h('ul', { class: 'rc-legend' }, [
        h('li', null, [h('i', { class: 'l1' }), ' Entgeltfortzahlung: ' + C.eur(c.l1)]),
        h('li', null, [h('i', { class: 'l2' }), ' Einspringen, Prämien, Springer, Zeitarbeit: ' + C.eur(c.l2)])
      ]),
      h('p', { class: 'rc-note', text: 'Nicht in der Zahl: Folgekosten durch Folgeausfälle und Fluktuation, geschätzt bis zu ' + C.eur(c.folge) + ' zusätzlich.' }),
      (S.bridge.indexOf('unter') >= 0 || S.bridge.indexOf('verschieben') >= 0)
        ? h('p', { class: 'rc-note', text: 'Was Sie nicht ersetzen, kostet kein Geld, aber Belastung. Sie zahlen es später beim Team.' }) : null
    ]));

    f.body.appendChild(assumptions(c));

    f.foot.appendChild(h('div', { class: 'rc-next' }, [
      h('div', {}, [h('h3', { text: 'Und woran liegt das?' }), h('p', { class: 'rc-sub', text: 'Der Muster-Check dauert etwa fünf Minuten. Jede Frage lässt sich aus dem Kopf beantworten, „weiß ich nicht“ ist immer erlaubt.' })]),
      h('div', { class: 'rc-next-actions' }, [
        btn('Muster-Check starten', 'btn-primary', next, true),
        btn('Ergebnis kopieren', 'btn-secondary', function (e) { copy(summaryText(c), e.currentTarget, 'Kopiert'); })
      ])
    ]));
  }

  function summaryText(c) {
    return 'Ausfall-Rechner (Klinovum): Krankheitsausfälle kosten ' + (S.haus ? S.haus : 'das Haus') + ' im Jahr etwa ' + C.eur(c.mid) + ' (Spanne ' + C.eur(c.lo) + ' bis ' + C.eur(c.hi) + '). Das entspricht ' + C.dec1(c.av) + ' Vollkräften. Ein Prozentpunkt Krankenstand ist etwa ' + C.eur(c.pp) + ' im Jahr wert. Alle Werte sind Schätzungen.';
  }
  function tile(num, label) {
    return h('div', { class: 'rc-tile' }, [h('b', { text: num }), h('span', { text: label })]);
  }

  function assumptions(c) {
    var d = h('details', { class: 'rc-assume' }, [h('summary', { text: 'Annahmen ansehen und anpassen' })]);
    var vk = h('input', { type: 'number', id: 'rc-vk', class: 'rc-input rc-input-s', min: '5', max: '500', step: '0.5', value: String(Math.round(c.vk * 10) / 10) });
    var ko = h('input', { type: 'number', id: 'rc-ko', class: 'rc-input rc-input-s', min: '30000', max: '120000', step: '1000', value: String(c.kosten) });
    d.appendChild(h('div', { class: 'rc-assume-grid' }, [
      h('div', { class: 'rc-field' }, [h('label', { for: 'rc-vk', text: 'Vollkräfte Pflege und Betreuung' }), vk]),
      h('div', { class: 'rc-field' }, [h('label', { for: 'rc-ko', text: 'Arbeitgeberkosten je Vollkraft und Jahr (€)' }), ko])
    ]));
    d.appendChild(h('p', { class: 'rc-note', text: 'Vorgabe: ' + C.CFG.vkProPlatz + ' Vollkräfte je Platz und ' + C.fmt(C.CFG.kostenJeVk) + ' € je Vollkraft (Mix aus Fach- und Hilfskräften). Der Ersatz kostet je nach Weg ein Vielfaches der Normalstunde: Einspringen am freien Tag rund das 1,15-Fache bei 60 Prozent Abdeckung, Springer das 1,05-Fache, Zeitarbeit das 1,8-Fache. Das sind Annahmen, keine Messwerte.' }));
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
    var f = frame('guess', { kicker: 'Erst Ihr Bauchgefühl', title: 'Woran liegt es bei Ihnen vor allem?', sub: 'Wählen Sie bis zu drei. Am Ende legen wir Ihre Vermutung neben den Befund.' });
    var grid = h('div', { class: 'rc-opts rc-cols-2' });
    var cont = btn('Weiter', 'btn-primary', next, true);
    C.GUESS.forEach(function (g) {
      var b = optionButton({ t: g.t }, S.guess.indexOf(g.id) >= 0, function () {
        var i = S.guess.indexOf(g.id);
        if (i >= 0) S.guess.splice(i, 1); else { if (S.guess.length >= 3) S.guess.shift(); S.guess.push(g.id); }
        Array.prototype.forEach.call(grid.children, function (c, idx) {
          var gg = C.GUESS[idx]; var on = S.guess.indexOf(gg.id) >= 0;
          c.classList.toggle('is-selected', on); c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      });
      grid.appendChild(b);
    });
    var dk = optionButton({ t: 'Weiß ich nicht' }, S.guess.indexOf('dk') >= 0, function () {
      S.guess = ['dk']; next();
    }, 'rc-opt-dk');
    grid.appendChild(dk);
    f.body.appendChild(grid);
    f.foot.appendChild(cont);
  }

  function rQuestion(q) {
    var inKnow = q.f === 'K';
    var fieldIdx = ['A', 'B', 'C', 'D', 'E'].indexOf(q.f);
    var fieldName = inKnow ? 'Vier kurze Wissensfragen' : 'Feld ' + q.f + ' · ' + C.FIELDS[fieldIdx].name;
    var f = frame(q.id, { kicker: fieldName, title: q.text, sub: q.sub });
    var cur = S.answers[q.id];
    var multi = q.type === 'multi';
    var grid = h('div', { class: 'rc-opts ' + (multi || q.opts.length > 4 ? 'rc-cols-1' : q.opts.length === 3 ? 'rc-cols-3' : 'rc-cols-2') });
    var cont = multi ? btn('Weiter', 'btn-primary', next, true) : null;

    function syncMulti() {
      var sel = S.answers[q.id] || [];
      Array.prototype.forEach.call(grid.querySelectorAll('.rc-opt:not(.rc-opt-dk)'), function (el, idx) {
        var on = sel.indexOf(idx) >= 0;
        el.classList.toggle('is-selected', on); el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var dkEl = grid.querySelector('.rc-opt-dk'); if (dkEl) { var d = C.isDk(S.answers[q.id]); dkEl.classList.toggle('is-selected', d); dkEl.setAttribute('aria-pressed', d ? 'true' : 'false'); }
      if (cont) cont.disabled = !(sel.length || C.isDk(S.answers[q.id]));
    }

    q.opts.forEach(function (o, i) {
      var selected = Array.isArray(cur) && cur.indexOf(i) >= 0;
      var b = optionButton(o, selected, function () {
        if (multi) {
          var sel = Array.isArray(S.answers[q.id]) ? S.answers[q.id].slice() : [];
          var idx = sel.indexOf(i);
          if (idx >= 0) sel.splice(idx, 1);
          else { if (o.none) sel = []; else sel = sel.filter(function (j) { return !q.opts[j].none; }); sel.push(i); }
          S.answers[q.id] = sel; syncMulti();
        } else {
          pickAndGo(b, grid, function () { S.answers[q.id] = [i]; });
        }
      });
      grid.appendChild(b);
    });
    var dkBtn = optionButton({ t: inKnow ? 'Keine Ahnung, auch das ist ein Ergebnis' : 'Weiß ich nicht' }, C.isDk(cur), function () {
      S.answers[q.id] = 'dk';
      if (multi) syncMulti(); else pickAndGo(dkBtn, grid, function () { S.answers[q.id] = 'dk'; });
    }, 'rc-opt-dk');
    grid.appendChild(dkBtn);
    f.body.appendChild(grid);
    if (cont) { f.foot.appendChild(cont); syncMulti(); }
  }

  function rEcho(fid) {
    var F = C.fieldScores(S.answers);
    var f = frame('echo' + fid, { kicker: fid === 'B' ? 'Halbzeit' : 'Zwischenstand', title: C.ECHO[fid][F[fid] >= 50 ? 'hi' : 'lo'] });
    if (C.FACTS[fid]) {
      f.body.appendChild(h('div', { class: 'rc-fact' }, [
        h('h4', { text: 'Wussten Sie schon?' }),
        h('p', { text: C.FACTS[fid].t }),
        h('span', { class: 'rc-note', text: 'Quelle: ' + C.FACTS[fid].src })
      ]));
    }
    if (fid === 'B') f.body.appendChild(h('p', { class: 'rc-sub', text: 'Noch drei Felder und vier kurze Fragen bis zum Befund.' }));
    f.foot.appendChild(btn('Weiter', 'btn-primary', next, true));
  }

  /* ---------- Befund ---------- */
  function rBefund() {
    var c = currentCalc();
    var F = C.fieldScores(S.answers);
    var det = C.detect(F, S.answers);
    var P = C.PATTERNS[det.haupt.id];
    var N = det.neben ? C.PATTERNS[det.neben.id] : null;
    var tops = C.topFields(F);
    var f = frame('befund', { kicker: 'Stufe 2 · Ihr Befund', title: S.haus ? 'Befund für ' + S.haus : 'Ihr Befund' });

    // Typkarte
    var typ = h('section', { class: 'rc-typ' }, [
      h('span', { class: 'badge badge-blue', text: det.haupt.soft ? 'Tendenz' : 'Ihr Muster' }),
      h('h3', { text: P.name }),
      h('p', { class: 'rc-typ-sub', text: P.typ }),
      h('p', { text: P.kern }),
      N ? h('p', { class: 'rc-typ-neben' }, ['Nebenmuster: ', h('b', { text: C.PATTERNS[det.neben.id].name })]) : null
    ]);
    f.body.appendChild(typ);

    // Zahl in Kurzform
    f.body.appendChild(h('div', { class: 'rc-tiles rc-tiles-4' }, [
      tile(C.eur(c.mid), 'Ausfallkosten pro Jahr (Spanne ' + C.eur(c.lo) + ' bis ' + C.eur(c.hi) + ')'),
      tile(C.dec1(c.av), 'Vollkräfte bezahlt und nicht im Dienst'),
      tile(C.eur(c.pp), 'ein Prozentpunkt Krankenstand pro Jahr'),
      tile(C.eur(c.proMonat), 'kostet jeder Monat ohne Veränderung')
    ]));

    // Fieberkurve
    var thermo = h('section', { class: 'rc-section-in' }, [h('h3', { text: 'Fieberkurve Ihres Hauses' }), h('p', { class: 'rc-sub', text: 'Je höher der Wert, desto mehr Druck in diesem Feld. Der Wert ist eine Orientierung, kein Urteil.' })]);
    C.FIELDS.forEach(function (fl) {
      var v = F[fl.id], b = C.band(v);
      thermo.appendChild(h('div', { class: 'rc-thermo-row' }, [
        h('span', { class: 'rc-thermo-name', text: fl.name }),
        h('div', { class: 'rc-thermo-bar' }, [h('i', { class: b, style: 'width:' + Math.max(4, v) + '%' })]),
        h('span', { class: 'rc-thermo-tag ' + b, text: C.BAND_LABEL[b] })
      ]));
    });
    f.body.appendChild(thermo);

    // Vermutung gegen Befund
    f.body.appendChild(guessVsResult(F, tops));

    // Spirale
    var sp = spiral(F);
    if (sp) f.body.appendChild(sp);

    // Nicht-Wissen
    var dkList = C.KNOW.concat(C.QUESTIONS).filter(function (q) { return C.isDk(S.answers[q.id]); });
    if (dkList.length) {
      f.body.appendChild(h('section', { class: 'rc-section-in' }, [
        h('h3', { text: 'Wo Ihnen das Instrument fehlt' }),
        h('p', { class: 'rc-sub', text: 'Bei diesen Fragen konnten Sie keine Antwort geben. Das ist kein Mangel an Ihnen, aber ein Hinweis, was Sie in einem einfachen Monatsblatt sichtbar machen könnten:' }),
        h('ul', { class: 'rc-plain' }, dkList.map(function (q) { return h('li', { text: q.text }); }))
      ]));
    }

    // Hebel
    f.body.appendChild(h('section', { class: 'rc-section-in' }, [
      h('h3', { text: 'Drei Hebel, nach Einflussbereich sortiert' }),
      lever('Sie allein, 30 Tage', P.allein),
      lever('Mit dem Team', P.team),
      lever('Mit dem Träger', P.traeger),
      h('p', { class: 'rc-measure' }, [h('b', { text: 'Woran Sie es in acht Wochen merken: ' }), P.mess])
    ]));

    // Preis des Nichtstuns
    f.body.appendChild(h('section', { class: 'rc-section-in' }, [
      h('h3', { text: 'Der Preis des Nichtstuns' }),
      h('p', { text: 'Ohne Veränderung kosten die Ausfälle etwa ' + C.eur(c.proMonat) + ' pro Monat. Senkt eine Maßnahme den Krankenstand um einen Prozentpunkt, sind das rund ' + C.eur(c.pp) + ' im Jahr. Eine Maßnahme, die weniger kostet, rechnet sich also schon bei kleiner Wirkung.' })
    ]));

    // Träger-Brief
    var letter = C.buildLetter(S, c, F, det);
    var pre = h('pre', { class: 'rc-letter', id: 'rc-letter', tabindex: '0' }, [letter]);
    f.body.appendChild(h('section', { class: 'rc-section-in rc-letter-wrap' }, [
      h('h3', { text: 'Entwurf für Ihren Träger' }),
      h('p', { class: 'rc-sub', text: 'Eine Seite, die Sie anpassen und weitergeben können. Der Befund selbst bleibt bei Ihnen, Sie entscheiden, was Sie teilen.' }),
      pre,
      h('div', { class: 'rc-actions-row' }, [
        btn('Brief kopieren', 'btn-primary', function (e) { copy(letter, e.currentTarget, 'Kopiert'); }),
        btn('Befund drucken oder als PDF speichern', 'btn-secondary', function () { window.print(); })
      ])
    ]));

    f.body.appendChild(h('p', { class: 'rc-note rc-disclaimer', text: 'Der Befund ist eine Orientierung auf Basis Ihrer Angaben, keine Diagnose und keine Aussage über einzelne Personen. Alle Werte sind Schätzungen.' }));

    f.foot.appendChild(h('div', { class: 'rc-cta' }, [
      h('div', {}, [h('h3', { text: 'Befund gemeinsam durchsprechen' }), h('p', { text: '30 Minuten, vertraulich, ohne Verkaufsdruck. Wir gehen Muster und Hebel mit Ihnen durch.' })]),
      h('a', { class: 'btn btn-secondary is-white', href: '../erstgesprach' }, ['Erstgespräch vereinbaren', icon('arrow')])
    ]));
    f.foot.appendChild(h('button', { type: 'button', class: 'rc-link rc-restart', text: 'Rechner neu starten', onclick: function () { restart(); } }));
  }

  function lever(label, text) {
    return h('div', { class: 'rc-lever' }, [h('b', { text: label }), h('span', { text: text })]);
  }

  function guessVsResult(F, tops) {
    var top = tops[0];
    var guessed = S.guess.filter(function (g) { return g !== 'dk'; });
    var fieldsGuessed = [];
    var externalGuessed = [];
    guessed.forEach(function (id) {
      var g = C.GUESS.filter(function (x) { return x.id === id; })[0];
      if (!g) return;
      if (g.field) fieldsGuessed.push(g.field); else externalGuessed.push(g.t);
    });
    var topName = top.short;
    var msg, cls = '';
    if (!guessed.length) { msg = 'Sie hatten keine Vermutung. Jetzt haben Sie eine Richtung: Am stärksten ist bei Ihnen das Feld „' + topName + '“.'; }
    else if (fieldsGuessed.indexOf(top.id) >= 0) { msg = 'Treffer. Ihre Vermutung passt zum stärksten Feld: „' + topName + '“.'; cls = 'good'; }
    else if (!fieldsGuessed.length) { msg = 'Sie vermuten vor allem Dinge, die sich schwer beeinflussen lassen (' + externalGuessed.join(', ') + '). Ihre Antworten zeigen „' + topName + '“ als stärkstes Feld, und das lässt sich beeinflussen.'; cls = 'warn'; }
    else { msg = 'Sie vermuten vor allem ' + fieldsGuessed.map(function (id) { return C.FIELDS.filter(function (x) { return x.id === id; })[0].short; }).join(' und ') + '. Ihre Antworten zeigen „' + topName + '“ als stärkstes Feld.'; cls = 'warn'; }
    if (F[top.id] < 40) msg += ' Der Wert liegt allerdings im normalen Bereich, deutlicher Druck ist nirgends erkennbar.';
    return h('section', { class: 'rc-section-in' }, [
      h('h3', { text: 'Ihre Vermutung gegen Ihr Muster' }),
      h('div', { class: 'rc-versus' }, [
        h('div', {}, [h('h4', { text: 'Ihre Vermutung' }), h('div', { class: 'rc-chips' }, (guessed.length ? guessed : ['weiß ich nicht']).map(function (id) {
          var g = C.GUESS.filter(function (x) { return x.id === id; })[0]; return h('span', { text: g ? g.t : 'Weiß ich nicht' });
        }))]),
        h('div', { class: 'is-result' }, [h('h4', { text: 'Ihre Antworten zeigen' }), h('div', { class: 'rc-chips' }, tops.slice(0, 2).map(function (t, i) { return h('span', { class: i === 0 ? 'hit' : '', text: t.short }); }))])
      ]),
      h('p', { class: 'rc-tipp-msg ' + cls, text: msg })
    ]);
  }

  function spiral(F) {
    if (F.A < 40 && F.B < 40) return null;
    var a1 = S.answers.A1, b1 = S.answers.B1, e1 = S.answers.E1;
    function lab(id, a, fallback) { return a && Array.isArray(a) ? C.qById(id).opts[a[0]].t : fallback; }
    var n2 = a1 && Array.isArray(a1) ? 'Eingesprungen am freien Tag: ' + lab('A1', a1) : 'Einspringen im Team';
    var n3 = 'Mehr Last beim Stammteam' + (b1 && Array.isArray(b1) ? ' (Schicht unter Soll: ' + lab('B1', b1) + ')' : '');
    var n4 = 'Weniger Erholung: nächster Ausfall oder Kündigung' + (e1 && Array.isArray(e1) ? ' (im letzten Jahr gegangen: ' + lab('E1', e1) + ')' : '');
    var nodes = ['Ein Ausfall', n2, n3, n4];
    var chain = h('div', { class: 'rc-loop' });
    nodes.forEach(function (t, i) { chain.appendChild(h('span', { class: 'rc-node', text: t })); if (i < nodes.length - 1) chain.appendChild(h('span', { class: 'rc-arrow', 'aria-hidden': 'true', text: '→' })); });
    chain.appendChild(h('span', { class: 'rc-arrow', 'aria-hidden': 'true', text: '↺' }));
    return h('section', { class: 'rc-section-in' }, [
      h('h3', { text: 'Ihre Ausfall-Spirale' }),
      h('p', { class: 'rc-sub', text: 'Ist der Krankenstand Ursache oder Folge des Personalmangels? Bei Ihnen läuft er im Kreis: Ein Ausfall belastet die, die einspringen, und erhöht das Risiko des nächsten.' }),
      chain
    ]);
  }

  function restart() {
    S.tipp = null; S.ks = null; S.ksExact = null; S.bridge = []; S.lang = null; S.vk = null; S.kosten = null; S.guess = []; S.answers = {};
    path = ['haus']; current = 'haus'; render('haus'); focusTitle(); scrollToStage();
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
  path = ['haus']; current = 'haus'; render('haus');
})();
