/**
 * Klinovum — Storyblok Automated Setup
 *
 * Erstellt alle Components, die Story und befüllt mit initialem Content.
 *
 * Usage:
 *   node setup-storyblok.mjs <PERSONAL_ACCESS_TOKEN> <SPACE_ID>
 *
 * Voraussetzungen:
 *   - Node.js 18+
 *   - Storyblok Account mit leerem Space
 */

const TOKEN = process.argv[2];
const SPACE_ID = process.argv[3];

if (!TOKEN || !SPACE_ID) {
  console.error('Usage: node setup-storyblok.mjs <PERSONAL_ACCESS_TOKEN> <SPACE_ID>');
  process.exit(1);
}

const API = `https://mapi.storyblok.com/v1/spaces/${SPACE_ID}`;
const headers = {
  'Authorization': TOKEN,
  'Content-Type': 'application/json',
};

async function api(method, path, body) {
  const url = `${API}${path}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  // Rate limiting: Storyblok allows 3 req/sec on free tier
  await new Promise(r => setTimeout(r, 400));

  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

// ============================================
// STEP 1: Create Components (Content Models)
// ============================================

async function createComponents() {
  console.log('\n📦 Creating components...\n');

  // Helper: simple text block for repeatable text items
  const textBlockSchema = {
    text: { type: 'text', pos: 0 },
  };

  // Helper: FAQ item block
  const faqItemSchema = {
    question: { type: 'text', pos: 0 },
    answer: { type: 'textarea', pos: 1 },
  };

  // Helper: solution step block
  const solutionStepSchema = {
    title: { type: 'text', pos: 0 },
    description: { type: 'textarea', pos: 1 },
    image: { type: 'image', pos: 2 },
  };

  // Helper: number block
  const numberSchema = {
    value: { type: 'text', pos: 0 },
    label: { type: 'text', pos: 1 },
    count: { type: 'text', pos: 2, description: 'Numerischer Wert für Count-Up Animation (leer lassen wenn nicht animiert)' },
  };

  // Helper: case study block
  const caseSchema = {
    tag: { type: 'text', pos: 0, description: 'z.B. Universitätsklinikum, Klinikverbund' },
    name: { type: 'text', pos: 1 },
    subtitle: { type: 'text', pos: 2 },
    image: { type: 'image', pos: 3 },
    problem: { type: 'textarea', pos: 4 },
    results: { type: 'bloks', pos: 5, restrict_components: true, component_whitelist: ['text_item'] },
  };

  // Helper: logo item
  const logoSchema = {
    name: { type: 'text', pos: 0 },
    logo: { type: 'image', pos: 1, description: 'Optional: Logo-Bild. Wenn leer, wird der Name als Text angezeigt.' },
  };

  // Nestable components (blocks)
  const nestables = [
    { name: 'text_item', display_name: 'Text-Element', schema: textBlockSchema, is_nestable: true },
    { name: 'faq_item', display_name: 'FAQ-Eintrag', schema: faqItemSchema, is_nestable: true },
    { name: 'solution_step', display_name: 'Lösungsschritt', schema: solutionStepSchema, is_nestable: true },
    { name: 'number_item', display_name: 'Kennzahl', schema: numberSchema, is_nestable: true },
    { name: 'case_study', display_name: 'Case Study', schema: caseSchema, is_nestable: true },
    { name: 'logo_item', display_name: 'Referenz-Logo', schema: logoSchema, is_nestable: true },
  ];

  for (const comp of nestables) {
    try {
      const res = await api('POST', '/components', { component: comp });
      console.log(`  ✅ ${comp.display_name} (${comp.name})`);
    } catch (e) {
      if (e.message.includes('422')) {
        console.log(`  ⏭️  ${comp.display_name} exists already`);
      } else throw e;
    }
  }

  // Main page component
  const landingpageSchema = {
    // Meta
    meta_title: { type: 'text', pos: 0, display_name: 'SEO Titel' },
    meta_description: { type: 'textarea', pos: 1, display_name: 'SEO Beschreibung' },

    // Hero
    _hero_tab: { type: 'tab', display_name: 'Hero', pos: 10 },
    hero_badge: { type: 'text', pos: 11, display_name: 'Badge-Text', default_value: 'Für Kliniken, MVZ & Pflegeeinrichtungen' },
    hero_headline: { type: 'text', pos: 12, display_name: 'Headline (vor Akzent)' },
    hero_accent_1: { type: 'text', pos: 13, display_name: 'Akzent-Text 1 (hervorgehoben)' },
    hero_accent_2: { type: 'text', pos: 14, display_name: 'Akzent-Text 2 (hervorgehoben)' },
    hero_subline: { type: 'textarea', pos: 15, display_name: 'Subline' },
    hero_cta_text: { type: 'text', pos: 16, display_name: 'CTA Button Text' },
    hero_cta_note: { type: 'text', pos: 17, display_name: 'CTA Hinweis (unter dem Button)' },
    hero_image_main: { type: 'image', pos: 18, display_name: 'Hauptbild (rechts oben)' },
    hero_image_secondary: { type: 'image', pos: 19, display_name: 'Zweites Bild (rechts unten)' },
    hero_stat_number: { type: 'text', pos: 20, display_name: 'Stat-Zahl (z.B. 350+)' },
    hero_stat_label: { type: 'text', pos: 21, display_name: 'Stat-Label' },
    hero_proof_items: { type: 'bloks', pos: 22, display_name: 'Proof-Punkte', restrict_components: true, component_whitelist: ['text_item'] },

    // Logos
    _logos_tab: { type: 'tab', display_name: 'Referenz-Logos', pos: 30 },
    logos_label: { type: 'text', pos: 31, display_name: 'Überschrift' },
    logos_items: { type: 'bloks', pos: 32, display_name: 'Logos / Namen', restrict_components: true, component_whitelist: ['logo_item'] },

    // Problem
    _problem_tab: { type: 'tab', display_name: 'Problem', pos: 40 },
    problem_badge: { type: 'text', pos: 41, display_name: 'Badge' },
    problem_headline: { type: 'text', pos: 42, display_name: 'Headline' },
    problem_items: { type: 'bloks', pos: 43, display_name: 'Schmerzpunkte', restrict_components: true, component_whitelist: ['text_item'] },
    problem_quote: { type: 'textarea', pos: 44, display_name: 'Zitat' },
    problem_closing: { type: 'textarea', pos: 45, display_name: 'Abschluss-Text' },
    problem_image: { type: 'image', pos: 46, display_name: 'Bild' },

    // Solution
    _solution_tab: { type: 'tab', display_name: 'Lösung / Ansatz', pos: 50 },
    solution_badge: { type: 'text', pos: 51, display_name: 'Badge' },
    solution_headline: { type: 'text', pos: 52, display_name: 'Headline' },
    solution_intro: { type: 'textarea', pos: 53, display_name: 'Intro-Text' },
    solution_steps: { type: 'bloks', pos: 54, display_name: '3 Schritte', restrict_components: true, component_whitelist: ['solution_step'] },
    solution_differentiator: { type: 'textarea', pos: 55, display_name: 'Differenzierer-Text' },

    // Numbers
    _numbers_tab: { type: 'tab', display_name: 'Kennzahlen', pos: 60 },
    numbers: { type: 'bloks', pos: 61, display_name: 'Kennzahlen', restrict_components: true, component_whitelist: ['number_item'] },

    // Cases
    _cases_tab: { type: 'tab', display_name: 'Referenzen / Cases', pos: 70 },
    cases_badge: { type: 'text', pos: 71, display_name: 'Badge' },
    cases_headline: { type: 'text', pos: 72, display_name: 'Headline' },
    cases_items: { type: 'bloks', pos: 73, display_name: 'Case Studies', restrict_components: true, component_whitelist: ['case_study'] },

    // Testimonial
    _testimonial_tab: { type: 'tab', display_name: 'Testimonial', pos: 80 },
    testimonial_quote: { type: 'textarea', pos: 81, display_name: 'Zitat' },
    testimonial_author: { type: 'text', pos: 82, display_name: 'Autor' },
    testimonial_note: { type: 'text', pos: 83, display_name: 'Hinweis (z.B. Name auf Anfrage)' },

    // Video
    _video_tab: { type: 'tab', display_name: 'Video', pos: 90 },
    video_badge: { type: 'text', pos: 91, display_name: 'Badge' },
    video_headline: { type: 'text', pos: 92, display_name: 'Headline' },
    video_description: { type: 'textarea', pos: 93, display_name: 'Beschreibung' },
    video_thumbnail: { type: 'image', pos: 94, display_name: 'Thumbnail' },
    video_url: { type: 'text', pos: 95, display_name: 'Video-URL (YouTube/Vimeo)' },

    // About
    _about_tab: { type: 'tab', display_name: 'Über uns', pos: 100 },
    about_badge: { type: 'text', pos: 101, display_name: 'Badge' },
    about_headline: { type: 'text', pos: 102, display_name: 'Headline' },
    about_lead: { type: 'textarea', pos: 103, display_name: 'Lead-Text' },
    about_body: { type: 'textarea', pos: 104, display_name: 'Body-Text' },
    about_image_1: { type: 'image', pos: 105, display_name: 'Bild 1' },
    about_image_2: { type: 'image', pos: 106, display_name: 'Bild 2' },
    about_usps: { type: 'bloks', pos: 107, display_name: 'USPs / Alleinstellungsmerkmale', restrict_components: true, component_whitelist: ['text_item'] },

    // FAQ
    _faq_tab: { type: 'tab', display_name: 'FAQ', pos: 110 },
    faq_badge: { type: 'text', pos: 111, display_name: 'Badge' },
    faq_headline: { type: 'text', pos: 112, display_name: 'Headline' },
    faq_intro: { type: 'textarea', pos: 113, display_name: 'Intro-Text' },
    faq_items: { type: 'bloks', pos: 114, display_name: 'Fragen & Antworten', restrict_components: true, component_whitelist: ['faq_item'] },

    // Contact
    _contact_tab: { type: 'tab', display_name: 'Kontakt', pos: 120 },
    contact_headline: { type: 'text', pos: 121, display_name: 'Headline' },
    contact_subline: { type: 'textarea', pos: 122, display_name: 'Subline' },
    contact_portrait: { type: 'image', pos: 123, display_name: 'Portrait-Bild' },
    contact_portrait_name: { type: 'text', pos: 124, display_name: 'Name' },
    contact_portrait_role: { type: 'text', pos: 125, display_name: 'Rolle' },
    contact_phone: { type: 'text', pos: 126, display_name: 'Telefonnummer' },

    // Footer
    _footer_tab: { type: 'tab', display_name: 'Footer', pos: 130 },
    footer_address: { type: 'textarea', pos: 131, display_name: 'Adresse' },
    footer_phone: { type: 'text', pos: 132, display_name: 'Telefon' },
    footer_email: { type: 'text', pos: 133, display_name: 'E-Mail' },
  };

  try {
    const res = await api('POST', '/components', {
      component: {
        name: 'landingpage',
        display_name: 'Landingpage',
        schema: landingpageSchema,
        is_root: true,
        is_nestable: false,
      }
    });
    console.log(`  ✅ Landingpage (Haupt-Component)`);
  } catch (e) {
    if (e.message.includes('422')) {
      console.log(`  ⏭️  Landingpage exists already`);
    } else throw e;
  }
}

// ============================================
// STEP 2: Create Story with initial content
// ============================================

async function createStory() {
  console.log('\n📝 Creating story with initial content...\n');

  const content = {
    component: 'landingpage',

    // Meta
    meta_title: 'Klinovum — Organisationsentwicklung für Kliniken, MVZ und Pflegeeinrichtungen',
    meta_description: 'Klinovum begleitet Kliniken und Gesundheitseinrichtungen durch Strategie-, Führungs- und Kulturprozesse. Seit 1994, über 350 Kunden.',

    // Hero
    hero_badge: 'Für Kliniken, MVZ & Pflegeeinrichtungen',
    hero_headline: 'Veränderungsprozesse im Gesundheitswesen —',
    hero_accent_1: 'strukturiert begleitet,',
    hero_accent_2: 'nachhaltig verankert.',
    hero_subline: 'Strategie, Führung und Kultur gehören zusammen. Wir begleiten Ihre Organisation von der Analyse bis zur messbaren Wirkung im Betrieb — mit über 30 Jahren Erfahrung und 350+ abgeschlossenen Projekten.',
    hero_cta_text: 'Kostenfreies Erstgespräch vereinbaren',
    hero_cta_note: '30 Min. — vertraulich, ohne Verkaufsdruck',
    hero_stat_number: '350+',
    hero_stat_label: 'Kunden seit 1994',
    hero_proof_items: [
      { component: 'text_item', text: 'Uniklinikum Ulm: Intensivbetten von 24 auf 32 in einem Jahr' },
      { component: 'text_item', text: 'Bosch Health Campus: Strategieprozess mit 50 Führungskräften' },
      { component: 'text_item', text: '20–25% Prozesseffizienzsteigerung im Durchschnitt' },
    ],

    // Logos
    logos_label: 'Vertrauen von Entscheidern in führenden Gesundheitseinrichtungen',
    logos_items: [
      { component: 'logo_item', name: 'Universitätsklinikum Ulm' },
      { component: 'logo_item', name: 'Robert-Bosch-Krankenhaus' },
      { component: 'logo_item', name: 'Deutsches Rotes Kreuz' },
      { component: 'logo_item', name: 'Landespflegerat Baden-Württemberg' },
      { component: 'logo_item', name: 'Franziskanerinnen von Reute' },
      { component: 'logo_item', name: 'Diakonissenmutterhaus Olgaschwestern' },
    ],

    // Problem
    problem_badge: 'Die Ausgangslage',
    problem_headline: 'Transformation unter Druck',
    problem_items: [
      { component: 'text_item', text: 'Krankenhausstrukturreform, Ambulantisierung, Fachkräftemangel — der Veränderungsdruck war nie höher.' },
      { component: 'text_item', text: 'Ungelöste Konflikte zwischen Medizin, Pflege und Verwaltung blockieren strategische Entscheidungen.' },
      { component: 'text_item', text: 'Veränderungsprojekte werden gestartet, aber nicht zu Ende gebracht — weil Führungsstrukturen und Beteiligung fehlen.' },
      { component: 'text_item', text: 'Leistungsträger verlassen das Haus, Fluktuation steigt, die verbleibenden Teams arbeiten am Limit.' },
    ],
    problem_quote: 'Wir wissen, dass sich etwas ändern muss. Aber wir schaffen es nicht aus eigener Kraft.',
    problem_closing: 'Das hören wir in fast jedem Erstgespräch. Der Wille ist da — was fehlt, ist ein strukturierter Weg und Begleitung von außen.',

    // Solution
    solution_badge: 'Unser Ansatz',
    solution_headline: 'Verstehen. Verändern. Verankern.',
    solution_intro: 'Drei Phasen, ein Ziel: Veränderung, die im laufenden Betrieb funktioniert und von den Beteiligten selbst getragen wird.',
    solution_steps: [
      { component: 'solution_step', title: 'Verstehen', description: 'Strukturierte Interviews, Ist-Analysen und Stakeholder-Mapping. Wir schaffen Klarheit über Dynamiken, Blockaden und tatsächliche Handlungsoptionen.' },
      { component: 'solution_step', title: 'Verändern', description: 'Moderierte Workshops, neue Führungs- und Kommunikationsformate, begleitetes Projektmanagement — gemeinsam mit Ihren Führungskräften und Teams, nicht an ihnen vorbei.' },
      { component: 'solution_step', title: 'Verankern', description: 'Reflexionsformate, Führungskräfte-Coaching und systematische Nachbegleitung stellen sicher, dass Veränderungen im 24/7-Betrieb bestehen bleiben.' },
    ],
    solution_differentiator: 'Wir liefern keine Strategie-Folien und verschwinden. Wir begleiten die Umsetzung — auch wenn es politisch wird, Widerstände auftreten und Konflikte offen angesprochen werden müssen.',

    // Numbers
    numbers: [
      { component: 'number_item', value: '30+', label: 'Jahre aktiv', count: '30' },
      { component: 'number_item', value: '350+', label: 'Kunden begleitet', count: '350' },
      { component: 'number_item', value: '20–25%', label: 'Prozesseffizienzsteigerung', count: '' },
      { component: 'number_item', value: '22', label: 'Berater & Fachexperten', count: '22' },
    ],

    // Cases
    cases_badge: 'Referenzen',
    cases_headline: 'Ausgewählte Projekte aus dem Gesundheitswesen',
    cases_items: [
      {
        component: 'case_study',
        tag: 'Universitätsklinikum',
        name: 'Universitätsklinikum Ulm',
        subtitle: 'Neuausrichtung der interdisziplinären Intensivversorgung',
        problem: 'Hohe Belastung im Intensivbetrieb, unklare Führungsstrukturen zwischen Medizin, Pflege und Administration. Fehlende Formate für interdisziplinäre Zusammenarbeit.',
        results: [
          { component: 'text_item', text: '120+ Beteiligte aus Medizin, Pflege, Verwaltung' },
          { component: 'text_item', text: 'Intensivbetten von 24 auf 32 in einem Jahr' },
          { component: 'text_item', text: '15+ Workshops und neue Führungsformate' },
          { component: 'text_item', text: 'Neues pflegerisches Leitungsteam etabliert' },
        ],
      },
      {
        component: 'case_study',
        tag: 'Klinikverbund',
        name: 'Bosch Health Campus',
        subtitle: 'Gemeinsame Strategieentwicklung über Einrichtungsgrenzen hinweg',
        problem: 'Unterschiedliche strategische Zielbilder zwischen Medizin, Pflege und Verwaltung. Fehlende Plattform für die Abstimmung über Einrichtungen hinweg.',
        results: [
          { component: 'text_item', text: '50 Führungskräfte aktiv beteiligt' },
          { component: 'text_item', text: 'Gemeinsame Strategieplattform entwickelt' },
          { component: 'text_item', text: 'Alle Führungskräfte für Veränderung aktiviert' },
        ],
      },
      {
        component: 'case_study',
        tag: 'Kirchlicher Träger',
        name: 'Franziskanerinnen von Reute',
        subtitle: 'Zukunftsvision und Reorganisation einer Ordensgemeinschaft',
        problem: 'Tiefgreifender struktureller Wandel. Unterschiedliche Interessen von Orden, Mitarbeitenden und regionalen Stakeholdern. Keine gemeinsame Zukunftsvision.',
        results: [
          { component: 'text_item', text: '40+ Interviews mit Stakeholdern' },
          { component: 'text_item', text: '2 Visionsworkshops à 5 Tage' },
          { component: 'text_item', text: 'Zukunftskonzept für 35.000 m² Gebäudefläche' },
        ],
      },
    ],

    // Testimonial
    testimonial_quote: 'Die Zusammenarbeit mit der Freiburger Akademie hat bei uns einen echten Kulturwandel ausgelöst. Zum ersten Mal hatten alle Berufsgruppen das Gefühl, an einem Strang zu ziehen.',
    testimonial_author: 'Pflegedirektion, Universitätsklinikum',
    testimonial_note: 'Name auf Anfrage',

    // Video
    video_badge: 'Persönlich',
    video_headline: 'Lernen Sie uns kennen — in 2 Minuten',
    video_description: 'Leon Mast erklärt, wie Klinovum arbeitet und warum klassische Beratung im Gesundheitswesen oft scheitert.',
    video_url: '',

    // About
    about_badge: 'Über uns',
    about_headline: 'Freiburger Akademie — seit 1994',
    about_lead: 'Klinovum ist das Gesundheitswesen-Angebot der Freiburger Akademie — einem inhabergeführten Beratungsunternehmen mit Sitz in Stuttgart und über 30 Jahren Erfahrung in der Organisationsentwicklung.',
    about_body: 'Unsere Berater vereinen Hintergründe aus Sozialwirtschaft, Klinikmanagement und Industrie. Wir kennen die Realität von Schichtdienst, Budgetdruck und interdisziplinären Spannungsfeldern — nicht aus Lehrbüchern, sondern aus über 350 Kundenprojekten.',
    about_usps: [
      { component: 'text_item', text: 'Erfahrung aus Sozialwirtschaft und Industrie — wir verstehen sowohl die menschliche als auch die betriebswirtschaftliche Seite von Veränderung.' },
      { component: 'text_item', text: 'Partizipativer Ansatz: Betroffene werden zu Beteiligten. Veränderung entsteht im System, nicht am Schreibtisch des Beraters.' },
      { component: 'text_item', text: 'Spezialisiert auf hochkomplexe Umgebungen: 24/7-Betriebe, Schichtdienst, politische Gremien und interdisziplinäre Spannungsfelder.' },
    ],

    // FAQ
    faq_badge: 'Häufige Fragen',
    faq_headline: 'Das werden wir oft gefragt',
    faq_intro: 'Transparenz ist Teil unseres Ansatzes — auch schon vor dem ersten Gespräch.',
    faq_items: [
      { component: 'faq_item', question: 'Was kostet eine Zusammenarbeit?', answer: 'Das hängt vom Umfang ab. Typische Projekte bewegen sich zwischen 10.000 und 100.000 EUR. Im Erstgespräch klären wir Ihren Bedarf und geben eine realistische Einschätzung — bevor ein Angebot entsteht.' },
      { component: 'faq_item', question: 'Wie lange dauert ein Veränderungsprozess?', answer: 'Erste spürbare Ergebnisse sehen wir in der Regel nach 8–12 Wochen. Nachhaltige Verankerung braucht 6–18 Monate, je nach Komplexität und Größe der Organisation.' },
      { component: 'faq_item', question: 'Funktioniert das auch im laufenden Klinikbetrieb?', answer: 'Ja — das ist unser Spezialgebiet. Wir haben über 30 Jahre Erfahrung mit 24/7-Betrieben, Schichtdienst und Akutversorgung. Unsere Formate sind auf minimale Betriebsunterbrechung ausgelegt.' },
      { component: 'faq_item', question: 'Wir hatten schon Berater — ohne Ergebnis. Was macht ihr anders?', answer: 'Wir liefern keine PowerPoint-Strategie und gehen. Wir bleiben in der Umsetzung, arbeiten direkt mit Ihren Führungskräften und Teams, und messen Fortschritt an konkreten Ergebnissen — nicht an Workshop-Teilnehmerzahlen.' },
      { component: 'faq_item', question: 'Was passiert nach dem Erstgespräch?', answer: 'Nichts, wozu Sie nicht bereit sind. Nach dem Gespräch entscheiden Sie in Ruhe. Wenn es passt, erarbeiten wir ein konkretes Angebot. Wenn nicht, war es ein gutes Gespräch — ohne Nachfass-Telefonate.' },
    ],

    // Contact
    contact_headline: 'Kostenfreies Erstgespräch',
    contact_subline: '30 Minuten, vertraulich. Wir hören zu, ordnen Ihre Situation ein und geben eine erste fachliche Einschätzung — ohne Verkaufsdruck.',
    contact_portrait_name: 'Leon Mast',
    contact_portrait_role: 'Geschäftsführer',
    contact_phone: '+49 178 529 5565',

    // Footer
    footer_address: 'Hackländerstraße 23\n70184 Stuttgart',
    footer_phone: '+49 711 5049 6603',
    footer_email: 'verwaltung@freiburger-akademie.de',
  };

  try {
    const res = await api('POST', '/stories', {
      story: {
        name: 'Landingpage',
        slug: 'landingpage',
        content: content,
      },
      publish: 1,
    });
    console.log(`  ✅ Story "landingpage" erstellt und veröffentlicht`);
  } catch (e) {
    if (e.message.includes('422')) {
      console.log(`  ⚠️  Story existiert bereits. Versuche Update...`);
      // Get existing story
      const stories = await api('GET', '/stories?with_slug=landingpage');
      if (stories.stories && stories.stories[0]) {
        const storyId = stories.stories[0].id;
        await api('PUT', `/stories/${storyId}`, {
          story: { name: 'Landingpage', slug: 'landingpage', content: content },
          publish: 1,
        });
        console.log(`  ✅ Story "landingpage" aktualisiert und veröffentlicht`);
      }
    } else throw e;
  }
}

// ============================================
// STEP 3: Get public API token
// ============================================

async function getPublicToken() {
  console.log('\n🔑 Getting public API token...\n');

  const space = await api('GET', '');
  const previewToken = space.space?.first_token;

  if (previewToken) {
    console.log(`  ✅ Public Preview Token: ${previewToken}`);
    console.log(`\n  👉 Trage diesen Token in cms.js ein:`);
    console.log(`     accessToken: '${previewToken}'`);
  } else {
    console.log('  ⚠️  Kein Preview Token gefunden. Erstelle einen unter Settings > Access Tokens.');
  }
}

// ============================================
// RUN
// ============================================

async function main() {
  console.log('🚀 Klinovum Storyblok Setup');
  console.log(`   Space: ${SPACE_ID}`);

  await createComponents();
  await createStory();
  await getPublicToken();

  console.log('\n✅ Setup abgeschlossen!\n');
  console.log('Nächste Schritte:');
  console.log('1. Öffne https://app.storyblok.com und prüfe die Story');
  console.log('2. Trage den Public Token in cms.js ein');
  console.log('3. Deploye die Landingpage auf Netlify');
}

main().catch(err => {
  console.error('\n❌ Fehler:', err.message);
  process.exit(1);
});
