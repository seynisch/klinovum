/* ============================================
   KLINOVUM AUSFALL-RECHNER
   Stufe 1: Zahl (Kosten von Krankheitsausfällen)
   Stufe 2: Muster (Ursachen) und Befund
   Alle Berechnungen laufen im Browser. Es werden keine Angaben übertragen.
   ============================================ */
(function (root) {
  'use strict';

  /* ---------- Annahmen (sichtbar im Rechner, änderbar) ---------- */
  var CFG = {
    vkProPlatz: 0.55,      // Vollkräfte Pflege und Betreuung je Platz (Faustwert, vor Livegang prüfen)
    kostenJeVk: 55000,     // Arbeitgeberkosten je Vollkraft und Jahr (Mix aus Fach- und Hilfskräften)
    folgeAnteil: 0.35,     // Folgekosten (Fluktuation, Folgeausfälle) bis zu x Prozent der Kernzahl
    spreadLo: 0.9,         // Unschärfe der Ersatzkosten nach unten
    spreadHi: 1.1,         // Unschärfe der Ersatzkosten nach oben
    tippProPlatz: 15000    // Maximum des Tipp-Reglers je Platz
  };

  /* ---------- Stufe 1: Antwortkarten ---------- */
  var KS = [
    { t: 'Meistens sind alle da', sub: 'Ein Ausfall ist die Ausnahme', lo: 4, hi: 6 },
    { t: 'Pro Woche fehlt gefühlt jemand', sub: 'Man kommt damit zurecht', lo: 6, hi: 9 },
    { t: 'Fast jede Woche fehlen mehrere', sub: 'Der Plan wackelt regelmäßig', lo: 9, hi: 12 },
    { t: 'Der Plan brennt eigentlich dauernd', sub: 'Jede Schicht ist ein Rettungsversuch', lo: 12, hi: 15 }
  ];

  // r = Anteil der Ausfälle, der ersetzt wird; f = Kostenfaktor des Ersatzes gegenüber der Normalstunde
  var BRIDGE = {
    frei: { t: 'Ich rufe jemanden an, der eigentlich frei hat', r: 0.6, f: 1.15 },
    springer: { t: 'Ein Springer oder Springerpool übernimmt', r: 0.75, f: 1.05 },
    zeit: { t: 'Wir holen Zeitarbeit', r: 0.8, f: 1.8 },
    unter: { t: 'Wir arbeiten erst mal unterbesetzt', r: 0, f: 0 },
    verschieben: { t: 'Aufgaben werden verschoben oder gestrichen', r: 0, f: 0 }
  };

  // fz = Anteil der Ausfalltage innerhalb der Entgeltfortzahlung (bis sechs Wochen)
  var LANG = [
    { t: 'Nein', sub: 'Aktuell niemand', fz: 0.75 },
    { t: 'Ja, einer', sub: 'Eine Person länger krank', fz: 0.6 },
    { t: 'Ein paar', sub: 'Zwei bis vier Personen', fz: 0.5 },
    { t: 'Mehrere', sub: 'Mehr als vier Personen', fz: 0.4 }
  ];

  /* ---------- Rechenkern ---------- */
  function ksRange(s) {
    if (typeof s.ksExact === 'number' && s.ksExact > 0) {
      return { lo: Math.max(0.5, s.ksExact - 0.5), hi: s.ksExact + 0.5 };
    }
    var k = KS[s.ks != null ? s.ks : 1];
    return { lo: k.lo, hi: k.hi };
  }

  function bridgeFactor(ids) {
    ids = ids && ids.length ? ids : ['frei'];
    var sum = 0, share = 0;
    ids.forEach(function (id) { sum += BRIDGE[id].r * BRIDGE[id].f; share += BRIDGE[id].r; });
    return { rf: sum / ids.length, ersetzt: share / ids.length };
  }

  function calc(s) {
    var vk = s.vk || s.platz * CFG.vkProPlatz;
    var kosten = s.kosten || CFG.kostenJeVk;
    var ks = ksRange(s);
    var fz = LANG[s.lang != null ? s.lang : 0].fz;
    var b = bridgeFactor(s.bridge);
    function at(k, spread) {
      var av = vk * k / 100;
      var l1 = av * kosten * fz;
      var l2 = av * kosten * b.rf * spread;
      return { av: av, l1: l1, l2: l2, total: l1 + l2 };
    }
    var ksMid = (ks.lo + ks.hi) / 2;
    var m = at(ksMid, 1);
    var lo = at(ks.lo, CFG.spreadLo).total;
    var hi = at(ks.hi, CFG.spreadHi).total;
    return {
      vk: vk, kosten: kosten, ksLo: ks.lo, ksHi: ks.hi, ksMid: ksMid,
      av: m.av, l1: m.l1, l2: m.l2, mid: m.total, lo: lo, hi: hi,
      folge: m.total * CFG.folgeAnteil,
      perPlatzMonat: m.total / s.platz / 12,
      pp: m.total / ksMid,
      proMonat: m.total / 12,
      ersetzt: b.ersetzt,
      exakt: typeof s.ksExact === 'number' && s.ksExact > 0
    };
  }

  /* ---------- Stufe 2: Felder, Fragen, Muster ---------- */
  var FIELDS = [
    { id: 'A', name: 'Dienstplan-Verlässlichkeit', short: 'Dienstplan' },
    { id: 'B', name: 'Belastungsdichte', short: 'Belastung' },
    { id: 'C', name: 'Führung und Klima', short: 'Führung und Klima' },
    { id: 'D', name: 'Veränderungsdruck', short: 'Veränderungen' },
    { id: 'E', name: 'Teamstabilität und Einarbeitung', short: 'Teamstabilität' }
  ];

  function opts4(a, b, c, d, scores) {
    scores = scores || [0, 1, 2, 3];
    return [a, b, c, d].map(function (t, i) { return { t: t, s: scores[i] }; });
  }
  function opts3(a, b, c, dots) {
    return [a, b, c].map(function (t, i) { return { t: t, s: [0, 1.5, 3][i], dot: dots ? ['g', 'y', 'r'][i] : null }; });
  }

  var QUESTIONS = [
    { id: 'A1', f: 'A', text: 'Wann ist zuletzt jemand an seinem freien Tag eingesprungen?',
      opts: opts4('Heute', 'Diese Woche', 'Diesen Monat', 'Länger her', [3, 2, 1, 0]) },
    { id: 'A2', f: 'A', text: 'Wie lange hält Ihr Dienstplan, bevor er umgeworfen wird?',
      opts: opts4('Bis Monatsende', 'Etwa eine Woche', 'Ein paar Tage', 'Kaum bis morgen') },
    { id: 'A3', f: 'A', text: 'Wie oft klappt ein Wunschfrei?',
      opts: opts4('Fast immer', 'Meistens', 'Selten', 'Kaum') },

    { id: 'B1', f: 'B', text: 'Wie oft startet eine Schicht mit weniger Leuten als geplant?',
      opts: opts4('Nie', 'Ein paar Mal im Monat', 'Jede Woche', 'Fast jede Schicht') },
    { id: 'B2', f: 'B', type: 'multi', text: 'Was ist in den letzten zwei Jahren schwerer geworden?', sub: 'Mehrfachauswahl möglich',
      opts: [{ t: 'Mehr hohe Pflegegrade' }, { t: 'Mehr Dokumentation' }, { t: 'Mehr Menschen mit Demenz' }, { t: 'Anspruchsvollere Angehörige' }, { t: 'Nichts davon deutlich', none: true }] },
    { id: 'B3', f: 'B', text: 'Wie wohl ist Ihnen bei der Besetzung nachts und am Wochenende?',
      opts: opts3('Gut', 'Geht so', 'Schlecht', true) },

    { id: 'C1', f: 'C', text: 'Sprechen Sie mit jemandem, wenn er nach einer Krankmeldung zurück ist?',
      opts: opts4('Immer', 'Manchmal', 'Selten', 'Nie') },
    { id: 'C2', f: 'C', text: 'Wie offen sagt das Team, wenn es zu viel wird?',
      opts: opts3('Offen', 'Zögerlich', 'Eher nicht', true) },
    { id: 'C3', f: 'C', text: 'Wie oft hat die Leitungsebene in den letzten zwei Jahren gewechselt?', sub: 'Einrichtungsleitung, Pflegedienstleitung, Wohnbereichsleitungen',
      opts: opts3('Gar nicht', 'Ein Wechsel', 'Mehrere') },

    { id: 'D1', f: 'D', type: 'multi', text: 'Was hat sich im letzten Jahr verändert?', sub: 'Mehrfachauswahl möglich',
      opts: [{ t: 'Träger- oder Leitungswechsel' }, { t: 'Neue Software' }, { t: 'Umbau oder Umzug' }, { t: 'Neues Pflegekonzept' }, { t: 'Neue Personalmix-Vorgaben' }, { t: 'Fusion oder Umstrukturierung' }, { t: 'Nichts davon', none: true }] },
    { id: 'D2', f: 'D', text: 'Wie gut wurde das Team dabei mitgenommen?',
      opts: opts3('Gut', 'Teils', 'Kaum', true),
      skipIf: function (a) { return isNone(a.D1, 'D1'); } },
    { id: 'D3', f: 'D', text: 'Kommt in diesem Jahr noch mehr?',
      opts: [{ t: 'Ruhig', s: 0 }, { t: 'Etwas', s: 1.5 }, { t: 'Viel', s: 3 }] },

    { id: 'E1', f: 'E', text: 'Wie viele sind im letzten Jahr gegangen?',
      opts: opts4('Kaum jemand', 'Ein paar Einzelne', 'Etwa jede oder jeder Fünfte', 'Deutlich mehr') },
    { id: 'E2', f: 'E', text: 'Wie sehr hängt der Betrieb an Leasing, Springern und Neuen?',
      opts: opts3('Kaum', 'Etwas', 'Stark') },
    { id: 'E3', f: 'E', text: 'Wie läuft die Einarbeitung?',
      opts: [{ t: 'Fester Pate mit Plan', s: 0 }, { t: 'Ein bisschen Struktur', s: 1.5 }, { t: 'Eher mitlaufen', s: 3 }] }
  ];

  var KNOW = [
    { id: 'K1', f: 'K', dk: true, text: 'Eher viele kurze Ausfälle oder wenige lange?',
      opts: [{ t: 'Viele kurze', v: 'short' }, { t: 'Wenige lange', v: 'long' }, { t: 'Beides gemischt', v: 'mixed' }] },
    { id: 'K2', f: 'K', dk: true, text: 'Fallen Ihnen spontan Menschen ein, die immer mal kurz fehlen?', sub: 'Nur die Anzahl, bitte keine Namen',
      opts: opts4('Keine', 'Ein bis zwei', 'Drei bis fünf', 'Mehr') },
    { id: 'K3', f: 'K', dk: true, text: 'Wie viele Ihrer Leute sind über 50?',
      opts: [{ t: 'Wenige', v: 'wenige', s: 0 }, { t: 'Etwa die Hälfte', v: 'haelfte', s: 1.5 }, { t: 'Die Mehrheit', v: 'mehrheit', s: 3 }] },
    { id: 'K4', f: 'K', dk: true, text: 'Gibt es ein Eingliederungsmanagement nach langer Krankheit und eine aktuelle Gefährdungsbeurteilung psychischer Belastung?',
      opts: [{ t: 'Beides', v: 'beides', s: 0 }, { t: 'Eins davon', v: 'eins', s: 1.5 }, { t: 'Keins', v: 'keins', s: 3 }] }
  ];

  var GUESS = [
    { id: 'infekte', t: 'Infekte und Saison', field: null },
    { id: 'alter', t: 'Alter der Belegschaft', field: null },
    { id: 'einstellung', t: 'Einstellung der Mitarbeitenden', field: null },
    { id: 'ueberlastung', t: 'Überlastung', field: 'B' },
    { id: 'dienstplan', t: 'Dienstplan', field: 'A' },
    { id: 'fuehrung', t: 'Führung', field: 'C' },
    { id: 'veraenderung', t: 'Veränderungen', field: 'D' },
    { id: 'privates', t: 'Privates', field: null }
  ];

  function qById(id) {
    for (var i = 0; i < QUESTIONS.length; i++) if (QUESTIONS[i].id === id) return QUESTIONS[i];
    for (var j = 0; j < KNOW.length; j++) if (KNOW[j].id === id) return KNOW[j];
    return null;
  }

  function isDk(a) { return a === 'dk'; }
  function isNone(a, id) {
    if (!a || isDk(a)) return false;
    var q = qById(id);
    return a.every ? a.length === 1 && q.opts[a[0]].none === true : false;
  }

  // Punktwert 0..3 einer Antwort (Risiko, höher = mehr Druck); null bei Überspringen
  function score(id, a) {
    var q = qById(id);
    if (a == null) return null;
    if (isDk(a)) return 1.5;
    if (q.type === 'multi') {
      var n = a.filter(function (i) { return !q.opts[i].none; }).length;
      return Math.min(3, n);
    }
    return q.opts[a[0]].s != null ? q.opts[a[0]].s : 1.5;
  }

  function fieldScores(ans) {
    var out = {};
    FIELDS.forEach(function (f) {
      var vals = [];
      QUESTIONS.forEach(function (q) {
        if (q.f !== f.id) return;
        if (q.skipIf && q.skipIf(ans)) { vals.push(0); return; }
        var s = score(q.id, ans[q.id]);
        if (s != null) vals.push(s);
      });
      out[f.id] = vals.length ? Math.round(vals.reduce(function (x, y) { return x + y; }, 0) / vals.length / 3 * 100) : 0;
    });
    return out;
  }

  function knowCtx(ans) {
    function v(id) {
      var a = ans[id];
      if (a == null || isDk(a)) return 'dk';
      var o = qById(id).opts[a[0]];
      return o.v != null ? o.v : o.s;
    }
    var dk = 0;
    ['K1', 'K2', 'K3', 'K4'].forEach(function (id) { if (isDk(ans[id])) dk++; });
    return { k1: v('K1'), k2: v('K2'), k3: v('K3'), k4: v('K4'), dk: dk };
  }

  /* ---------- Muster ---------- */
  var PATTERNS = {
    spirale: {
      name: 'Die Einspringen-Spirale', typ: 'Jeder Ausfall erzeugt den nächsten.',
      kern: 'Ihre Decke ist dünn. Fällt jemand aus, springt ein anderer ein, und der trägt das Risiko des nächsten Ausfalls. Das ist ein Planungsmuster, keine Frage der Einstellung.',
      allein: 'Ein verbindliches Einspringe-Regelwerk: Limit pro Person und Monat, fester Ausgleich, klare Reihenfolge.',
      team: 'Planbare Springer-Schichten im Dienstplan, damit niemand am freien Tag angerufen wird.',
      traeger: 'Budget für einen kleinen Springerpool, begründet mit dem Wert eines Prozentpunkts Krankenstand.',
      mess: 'Wann ist zuletzt jemand an seinem freien Tag eingesprungen? Fragen Sie das in acht Wochen noch einmal.'
    },
    erschoepfung: {
      name: 'Das Erschöpfungs-Team', typ: 'Dauerlast zeigt sich in langen Ausfällen.',
      kern: 'Hohe Dauerbelastung und überwiegend lange Ausfälle passen zusammen. Lange Ausfälle kosten weniger Lohn, blockieren aber Stellen und lassen die Last beim Rest des Teams.',
      allein: 'Belastungsspitzen im Wochenverlauf sichtbar machen und Erholungszeiten im Dienstplan schützen.',
      team: 'Eingliederungsgespräche konsequent führen und die Rückkehr stufenweise gestalten.',
      traeger: 'Ein Stellenanteil für Entlastung in den Spitzenzeiten, begründet mit den blockierten Stellen.',
      mess: 'Wie viele Langzeitausfälle haben Sie in sechs Monaten, und wie viele Personen kehren zurück?'
    },
    klima: {
      name: 'Der Klima-Effekt', typ: 'Wiederkehrende Kurzausfälle sind oft ein Bindungssignal.',
      kern: 'Wer immer wieder kurz fehlt, sagt damit manchmal etwas über Wertschätzung und Klima, nicht nur über Gesundheit. Hier hilft Zuwendung mehr als Kontrolle.',
      allein: 'Rückkehrgespräche nach jeder Krankmeldung einführen: kurz, ohne Vorwurf, mit der Frage „Was braucht es?“.',
      team: 'Ein Teamgespräch zu Überlastung mit einer sichtbaren Rückmeldung innerhalb von zwei Wochen.',
      traeger: 'Unterstützung für Leitungskräfte im Umgang mit Konflikten und Rückkehrgesprächen.',
      mess: 'Wie viele Rückkehrgespräche wurden geführt, und sinken die Kurzausfälle bei den Wiederholern?'
    },
    umbruch: {
      name: 'Die Umbruch-Delle', typ: 'Zu viel Neues zugleich.',
      kern: 'Mehrere Veränderungen hintereinander ermüden ein Team, auch wenn jede einzelne sinnvoll ist. Es fehlt Orientierung, und Routine bricht weg.',
      allein: 'Veränderungen takten: Was bleibt, was ändert sich, was kommt als Nächstes, in einem Bild für alle.',
      team: 'Pro Veränderung eine feste Ansprechperson im Team und eine regelmäßige Fragerunde.',
      traeger: 'Termine und Neuerungen zwischen Träger und Haus abstimmen, damit nicht alles gleichzeitig kommt.',
      mess: 'Wie sicher fühlt sich das Team bei der letzten Neuerung? Eine einfache Ampelabfrage im Teamgespräch genügt.'
    },
    durchlauf: {
      name: 'Der Durchlauferhitzer', typ: 'Ständig neue Gesichter.',
      kern: 'Wenn viele gehen, kommen oder nur aushelfen, trägt das Stammteam die Einarbeitung und die Lücken. Das kostet Kraft und erzeugt Folgeausfälle.',
      allein: 'Einarbeitungsstandard mit Pate und Plan für die ersten sechs Wochen.',
      team: 'Paten im Dienstplan entlasten, damit Einarbeitung nicht nebenher läuft.',
      traeger: 'Budget für Einarbeitungszeit und eine Bindungsmaßnahme für das Stammteam.',
      mess: 'Wie viele Neue sind nach sechs Monaten noch da?'
    },
    blindflug: {
      name: 'Der Blindflug', typ: 'Es fehlt das Instrument.',
      kern: 'Sie steuern Ausfälle, ohne zu sehen, wie sie sich verteilen. Das ist keine Schwäche Ihrer Person, es fehlt schlicht eine einfache Auswertung.',
      allein: 'Ein Monatsblatt mit Ausfalltagen in kurz, mittel und lang und eine Liste der Eingliederungsverfahren.',
      team: 'Gemeinsam mit der Verwaltung festlegen, wer die Zahlen monatlich liefert.',
      traeger: 'Zugriff auf die Fehlzeitenauswertung des Trägers in einer einfachen Monatsübersicht.',
      mess: 'Können Sie die Fragen, die Sie heute nicht beantworten konnten, in acht Wochen ohne Raten beantworten?'
    },
    erreger: {
      name: 'Das Erreger-Haus', typ: 'Überwiegend Saison und Alter.',
      kern: 'Ihre Antworten zeigen in keinem Feld deutlichen Druck. Ausfälle bei Ihnen sind überwiegend Saison, Infekte und Alter, der Spielraum ist klein. Das Risiko liegt eher darin, dass wenige Schlüsselpersonen fehlen.',
      allein: 'Vertretung für Schlüsselrollen klären, etwa Wohnbereichsleitung, Nachtdienst und Wundmanagement.',
      team: 'Wissen aus Schlüsselrollen in Tandems absichern.',
      traeger: 'Kein Budget nötig. Die Zahl dient als Nachweis, dass Ihr Haus solide dasteht.',
      mess: 'Wie viele Schlüsselrollen haben eine eingearbeitete Vertretung?'
    }
  };
  var FIELD_PATTERN = { A: 'spirale', B: 'erschoepfung', C: 'klima', D: 'umbruch', E: 'durchlauf' };

  function detect(F, ans) {
    var k = knowCtx(ans);
    var c1 = score('C1', ans.C1) || 0;
    var cands = [];
    function add(id, strength, soft) { cands.push({ id: id, strength: strength, soft: !!soft }); }
    if (F.A >= 60 && F.B >= 55) add('spirale', (F.A + F.B) / 2);
    if (F.B >= 60 && (k.k1 === 'long' || k.k3 === 'mehrheit')) add('erschoepfung', F.B);
    if (F.C >= 60 && ((typeof k.k2 === 'number' && k.k2 >= 2) || c1 >= 2)) add('klima', F.C);
    if (F.D >= 60) add('umbruch', F.D);
    if (F.E >= 60) add('durchlauf', F.E);
    if (k.dk >= 3) add('blindflug', 65);
    FIELDS.forEach(function (f) {
      var pid = FIELD_PATTERN[f.id];
      var has = cands.some(function (c) { return c.id === pid; });
      if (!has && F[f.id] >= 50) add(pid, F[f.id] - 10, true);
    });
    cands.sort(function (a, b) { return b.strength - a.strength; });
    if (!cands.length) cands.push({ id: 'erreger', strength: 0, soft: false });
    return { haupt: cands[0], neben: cands[1] || null, ctx: k };
  }

  function topFields(F) {
    return FIELDS.slice().sort(function (a, b) { return F[b.id] - F[a.id]; });
  }

  function band(v) { return v >= 60 ? 'hi' : v >= 40 ? 'mid' : 'lo'; }
  var BAND_LABEL = { hi: 'Fieber', mid: 'erhöht', lo: 'normal' };

  /* ---------- Formatierung ---------- */
  var nf = new Intl.NumberFormat('de-DE');
  function fmt(n) { return nf.format(Math.round(n)); }
  function eur(n, step) { step = step || 1000; return fmt(Math.round(n / step) * step) + ' €'; }
  function dec1(n) { return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n); }

  /* ---------- Echo und Fakten zwischen den Feldern ---------- */
  var ECHO = {
    A: { hi: 'Der Dienstplan trägt bei Ihnen viel Last. Das merken wir uns.', lo: 'Ihr Dienstplan hält erstaunlich gut. Das ist nicht selbstverständlich.' },
    B: { hi: 'Die Besetzung ist knapp, das ist deutlich.', lo: 'Die Schichten sind meist stabil besetzt.' },
    C: { hi: 'Hier steckt Spielraum, und der kostet wenig Geld.', lo: 'Das Klima scheint zu tragen.' },
    D: { hi: 'Viel Neues in kurzer Zeit. Das kostet Kraft, auch wenn alles sinnvoll war.', lo: 'Wenig Umbruch, das hilft.' },
    E: { hi: 'Viel Bewegung im Team. Das Stammteam trägt es.', lo: 'Ein stabiles Team ist ein starker Puffer.' }
  };
  var FACTS = {
    A: { t: 'In der Altenpflege fehlten Beschäftigte laut einer DAK-Auswertung für Rheinland-Pfalz im ersten Halbjahr 2025 im Schnitt rund 15 Tage, über alle Berufe rund 9.', src: 'DAK-Gesundheitsreport 2025, Rheinland-Pfalz' },
    B: { t: 'Im Gesundheits- und Sozialwesen lag der Krankenstand bei der AOK Niedersachsen von Januar bis August 2025 bei 7,7 Prozent, über alle Branchen bei 6,6 Prozent.', src: 'AOK Niedersachsen, Fehlzeiten-Report 2025' },
    D: { t: 'Die Entgeltfortzahlung bei Krankheit kostete die Arbeitgeber in Deutschland 2025 geschätzt rund 85,6 Milliarden Euro.', src: 'IW Köln, Kurzbericht 2026' },
    E: { t: 'Nur rund 1,3 Prozent der Pflegekräfte arbeiten bei einem Personaldienstleister. Die Lücken werden also meist im eigenen Team gestopft.', src: 'Bundesagentur für Arbeit, Stand September 2025' }
  };

  /* ---------- Träger-Brief ---------- */
  function buildLetter(s, c, F, det) {
    var p = PATTERNS[det.haupt.id];
    var haus = s.haus ? s.haus : 'unserem Haus';
    var lines = [];
    lines.push('Betreff: Krankheitsausfälle in ' + haus + ': Kosten, Ursache und Vorschlag');
    lines.push('');
    lines.push('Sehr geehrte Damen und Herren,');
    lines.push('');
    lines.push('ich habe die Krankheitsausfälle in ' + haus + ' mit dem Ausfall-Rechner von Klinovum eingeschätzt. Alle Werte sind Schätzungen auf Basis meiner Angaben.');
    lines.push('');
    lines.push('Zur Größenordnung: Die Ausfälle kosten uns im Jahr grob ' + eur(c.mid) + ' (Spanne ' + eur(c.lo) + ' bis ' + eur(c.hi) + '). Das entspricht etwa ' + dec1(c.av) + ' Vollkräften, die wir bezahlen und nicht im Dienst haben, oder rund ' + fmt(Math.round(c.perPlatzMonat / 10) * 10) + ' € je Platz und Monat. Ein Prozentpunkt weniger Krankenstand wäre etwa ' + eur(c.pp) + ' im Jahr wert.');
    lines.push('');
    lines.push('Zur Ursache: Die Auswertung deutet auf das Muster „' + p.name.replace(/^(Der|Die|Das) /, '') + '“. ' + p.kern);
    lines.push('');
    lines.push('Mein Vorschlag: ' + p.allein + ' Dazu bitte ich um Ihre Unterstützung: ' + p.traeger);
    lines.push('');
    lines.push('Ich würde das gern in 30 Minuten mit Ihnen besprechen.');
    lines.push('');
    lines.push('Mit freundlichen Grüßen');
    return lines.join('\n');
  }

  /* ---------- Export für Tests ---------- */
  var api = {
    CFG: CFG, KS: KS, BRIDGE: BRIDGE, LANG: LANG, FIELDS: FIELDS, QUESTIONS: QUESTIONS, KNOW: KNOW, GUESS: GUESS,
    PATTERNS: PATTERNS, ECHO: ECHO, FACTS: FACTS,
    calc: calc, score: score, fieldScores: fieldScores, detect: detect, knowCtx: knowCtx, topFields: topFields,
    band: band, BAND_LABEL: BAND_LABEL, qById: qById, isDk: isDk, isNone: isNone, buildLetter: buildLetter,
    fmt: fmt, eur: eur, dec1: dec1
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AusfallRechnerCore = api;
})(typeof window !== 'undefined' ? window : this);
