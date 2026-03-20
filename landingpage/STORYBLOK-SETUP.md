# Storyblok CMS Setup — Klinovum Landingpage

## 1. Storyblok Space erstellen

1. Gehe zu https://app.storyblok.com und erstelle einen Account (Free Tier reicht)
2. Erstelle einen neuen Space: "Klinovum"
3. Gehe zu **Settings > Access Tokens** und kopiere den **Public** Token (Preview oder Published)
4. Trage den Token in `cms.js` ein:

```js
const CMS_CONFIG = {
  accessToken: 'DEIN_TOKEN_HIER',
  storySlug: 'landingpage',
  version: 'published', // oder 'draft' für Preview
};
```

## 2. Content Model erstellen

Erstelle eine neue Story "landingpage" mit folgenden Feldern (alle als **Text** oder **Textarea**, Bilder als **Asset**):

### Hero
| Feld | Typ | Storyblok-Name |
|---|---|---|
| Badge Text | Text | `hero_badge` |
| Headline | Text | `hero_headline` |
| Akzent-Text 1 | Text | `hero_accent_1` |
| Akzent-Text 2 | Text | `hero_accent_2` |
| Subline | Textarea | `hero_subline` |
| CTA Text | Text | `hero_cta_text` |
| CTA Hinweis | Text | `hero_cta_note` |
| Bild Hauptbild | Asset | `hero_image_main` |
| Bild Sekundär | Asset | `hero_image_secondary` |
| Stat Zahl | Text | `hero_stat_number` |
| Stat Label | Text | `hero_stat_label` |
| Proof Items | Multi-Option (Text-Blöcke) | `hero_proof_items` |

### Logos
| Feld | Typ | Storyblok-Name |
|---|---|---|
| Label | Text | `logos_label` |
| Logo-Namen | Multi-Option (Text-Blöcke) | `logos_items` |

### Problem
| Feld | Typ | Storyblok-Name |
|---|---|---|
| Badge | Text | `problem_badge` |
| Headline | Text | `problem_headline` |
| Schmerzpunkte | Multi-Option (Text-Blöcke) | `problem_items` |
| Zitat | Textarea | `problem_quote` |
| Closing-Text | Textarea | `problem_closing` |
| Bild | Asset | `problem_image` |

### Lösung
| Feld | Typ | Storyblok-Name |
|---|---|---|
| Badge | Text | `solution_badge` |
| Headline | Text | `solution_headline` |
| Intro-Text | Textarea | `solution_intro` |
| Schritte | Blöcke (title, description, image) | `solution_steps` |
| Differenzierer | Textarea | `solution_differentiator` |

### Zahlen
| Feld | Typ | Storyblok-Name |
|---|---|---|
| Zahlen | Blöcke (value, label, count) | `numbers` |

### Cases
| Feld | Typ | Storyblok-Name |
|---|---|---|
| Badge | Text | `cases_badge` |
| Headline | Text | `cases_headline` |
| Case Studies | Blöcke (tag, name, subtitle, image, problem, results[]) | `cases_items` |

### Testimonial
| Feld | Typ | Storyblok-Name |
|---|---|---|
| Zitat | Textarea | `testimonial_quote` |
| Autor | Text | `testimonial_author` |
| Hinweis | Text | `testimonial_note` |

### Video
| Feld | Typ | Storyblok-Name |
|---|---|---|
| Badge | Text | `video_badge` |
| Headline | Text | `video_headline` |
| Beschreibung | Textarea | `video_description` |
| Thumbnail | Asset | `video_thumbnail` |
| Video-URL | Text | `video_url` |

### Über uns
| Feld | Typ | Storyblok-Name |
|---|---|---|
| Badge | Text | `about_badge` |
| Headline | Text | `about_headline` |
| Lead-Text | Textarea | `about_lead` |
| Body-Text | Textarea | `about_body` |
| Bild 1 | Asset | `about_image_1` |
| Bild 2 | Asset | `about_image_2` |
| USPs | Multi-Option (Text-Blöcke) | `about_usps` |

### FAQ
| Feld | Typ | Storyblok-Name |
|---|---|---|
| Badge | Text | `faq_badge` |
| Headline | Text | `faq_headline` |
| Intro | Textarea | `faq_intro` |
| Fragen | Blöcke (question, answer) | `faq_items` |

### Kontakt
| Feld | Typ | Storyblok-Name |
|---|---|---|
| Headline | Text | `contact_headline` |
| Subline | Textarea | `contact_subline` |
| Portrait | Asset | `contact_portrait` |
| Name | Text | `contact_portrait_name` |
| Rolle | Text | `contact_portrait_role` |
| Telefon | Text | `contact_phone` |

### Footer
| Feld | Typ | Storyblok-Name |
|---|---|---|
| Adresse | Textarea | `footer_address` |
| Telefon | Text | `footer_phone` |
| E-Mail | Text | `footer_email` |

## 3. So funktioniert es

- Die Seite lädt immer mit dem **hardcoded HTML** als Fallback
- `cms.js` versucht dann Content von Storyblok zu laden
- Wenn ein Token konfiguriert ist und die API erreichbar, werden alle `data-cms="..."` Elemente mit dem CMS-Content überschrieben
- Listen-Elemente (Cases, FAQ, USPs etc.) werden komplett neu gerendert
- Ohne Token / bei API-Fehler: Seite zeigt den lokalen Content aus `content.json`

## 4. Für den Kunden

Der Kunde loggt sich auf https://app.storyblok.com ein und sieht:
- Alle Texte als editierbare Felder
- Bilder per Drag & Drop austauschbar
- Sofortige Vorschau
- "Publish" Button zum Live-Schalten

## 5. Deployment

Die Seite kann auf jeder Plattform gehostet werden:
- **Netlify** (empfohlen): Einfach den `/landingpage` Ordner deployen
- **Vercel**, **GitHub Pages**, oder jeder beliebige Webserver
- Kein Build-Schritt nötig — alles läuft client-side
