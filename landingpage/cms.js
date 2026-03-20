/**
 * Klinovum CMS Integration
 *
 * Connects to Storyblok headless CMS.
 * Falls back to local content.json if CMS is not configured.
 *
 * Setup:
 * 1. Create a Storyblok space at https://app.storyblok.com
 * 2. Set your public access token below
 * 3. Create a story called "landingpage" with the matching content structure
 */

const CMS_CONFIG = {
  // Set your Storyblok public access token here
  accessToken: 'pmn6Ggfn16t4kZ6NiKoErwtt',
  // Story slug in Storyblok
  storySlug: 'landingpage',
  // API version: 'draft' for preview, 'published' for live
  version: 'draft',
};

// ============================================
// CONTENT LOADER
// ============================================

async function loadContent() {
  // Always load local content.json as base
  let fallback = null;
  try {
    const res = await fetch('content.json');
    fallback = await res.json();
    console.log('[CMS] Fallback content.json loaded');
  } catch (err) {
    console.warn('[CMS] content.json not available:', err);
  }

  let cmsContent = null;

  // Try Storyblok
  if (CMS_CONFIG.accessToken) {
    try {
      cmsContent = await fetchFromStoryblok();
      console.log('[CMS] Content loaded from Storyblok');
    } catch (err) {
      console.warn('[CMS] Storyblok fetch failed:', err);
    }
  }

  // Merge: CMS wins, but fallback fills empty values (especially images)
  var content = fallback || {};
  if (cmsContent) {
    content = deepMerge(content, cmsContent);
  }

  renderContent(content);
}

/**
 * Deep merge: src overwrites target, but only for non-empty values.
 * Empty strings, null, undefined in src are skipped — target value preserved.
 */
function deepMerge(target, src) {
  if (!src) return target;
  if (!target) return src;

  var result = {};
  var keys = new Set([...Object.keys(target), ...Object.keys(src)]);

  keys.forEach(function(key) {
    var tVal = target[key];
    var sVal = src[key];

    // src value is empty — keep target
    if (sVal === '' || sVal === null || sVal === undefined) {
      result[key] = tVal;
    }
    // Both are arrays — use src if it has items, otherwise target
    else if (Array.isArray(sVal) && Array.isArray(tVal)) {
      result[key] = sVal.length > 0 ? mergeArrays(tVal, sVal) : tVal;
    }
    // Both are objects — recurse
    else if (typeof sVal === 'object' && typeof tVal === 'object' && !Array.isArray(sVal)) {
      result[key] = deepMerge(tVal, sVal);
    }
    // src has a real value — use it
    else {
      result[key] = sVal;
    }
  });

  return result;
}

/**
 * Merge arrays: use src array but fill in empty image fields from target items
 */
function mergeArrays(target, src) {
  return src.map(function(sItem, i) {
    var tItem = target[i];
    if (typeof sItem === 'object' && tItem && typeof tItem === 'object') {
      return deepMerge(tItem, sItem);
    }
    return (sItem === '' || sItem === null || sItem === undefined) ? tItem : sItem;
  });
}

async function fetchFromStoryblok() {
  const url = `https://api.storyblok.com/v2/cdn/stories/${CMS_CONFIG.storySlug}?version=${CMS_CONFIG.version}&token=${CMS_CONFIG.accessToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Storyblok API returned ${res.status}`);
  const data = await res.json();
  return transformStoryblokContent(data.story.content);
}

/**
 * Transform Storyblok's nested component structure
 * into our flat content.json format.
 *
 * Adjust this mapping based on your Storyblok content model.
 */
function transformStoryblokContent(sb) {
  // If the Storyblok content already matches our structure, return as-is
  // Otherwise, map fields here. Example:
  return {
    meta: {
      title: sb.meta_title || '',
      description: sb.meta_description || '',
    },
    hero: {
      badge: sb.hero_badge || '',
      headline: sb.hero_headline || '',
      headline_accent_1: sb.hero_accent_1 || '',
      headline_accent_2: sb.hero_accent_2 || '',
      subline: sb.hero_subline || '',
      cta_text: sb.hero_cta_text || '',
      cta_note: sb.hero_cta_note || '',
      image_main: sb.hero_image_main?.filename || '',
      image_secondary: sb.hero_image_secondary?.filename || '',
      stat_number: sb.hero_stat_number || '',
      stat_label: sb.hero_stat_label || '',
      proof_items: (sb.hero_proof_items || []).map(function(item) { return item.text || item; }),
    },
    logos: {
      label: sb.logos_label || '',
      items: (sb.logos_items || []).map(function(item) { return item.name || item; }),
    },
    problem: {
      badge: sb.problem_badge || '',
      headline: sb.problem_headline || '',
      items: (sb.problem_items || []).map(function(item) { return item.text || item; }),
      quote: sb.problem_quote || '',
      closing: sb.problem_closing || '',
      image: sb.problem_image?.filename || '',
    },
    solution: {
      badge: sb.solution_badge || '',
      headline: sb.solution_headline || '',
      intro: sb.solution_intro || '',
      steps: (sb.solution_steps || []).map(function(step) {
        return {
          title: step.title || '',
          description: step.description || '',
          image: step.image?.filename || '',
        };
      }),
      differentiator: sb.solution_differentiator || '',
    },
    numbers: (sb.numbers || []).map(function(n) {
      return {
        value: n.value || '',
        label: n.label || '',
        count: n.count || null,
      };
    }),
    cases: {
      badge: sb.cases_badge || '',
      headline: sb.cases_headline || '',
      items: (sb.cases_items || []).map(function(c) {
        return {
          tag: c.tag || '',
          name: c.name || '',
          subtitle: c.subtitle || '',
          image: c.image?.filename || '',
          problem: c.problem || '',
          results: (c.results || []).map(function(r) { return r.text || r; }),
        };
      }),
    },
    testimonial: {
      quote: sb.testimonial_quote || '',
      author: sb.testimonial_author || '',
      note: sb.testimonial_note || '',
    },
    video: {
      badge: sb.video_badge || '',
      headline: sb.video_headline || '',
      description: sb.video_description || '',
      thumbnail: sb.video_thumbnail?.filename || '',
      video_url: sb.video_url || '',
    },
    about: {
      badge: sb.about_badge || '',
      headline: sb.about_headline || '',
      lead: sb.about_lead || '',
      body: sb.about_body || '',
      image_1: sb.about_image_1?.filename || '',
      image_2: sb.about_image_2?.filename || '',
      usps: (sb.about_usps || []).map(function(u) { return u.text || u; }),
    },
    faq: {
      badge: sb.faq_badge || '',
      headline: sb.faq_headline || '',
      intro: sb.faq_intro || '',
      items: (sb.faq_items || []).map(function(f) {
        return { question: f.question || '', answer: f.answer || '' };
      }),
    },
    contact: {
      headline: sb.contact_headline || '',
      subline: sb.contact_subline || '',
      portrait: sb.contact_portrait?.filename || '',
      portrait_name: sb.contact_portrait_name || '',
      portrait_role: sb.contact_portrait_role || '',
      phone: sb.contact_phone || '',
      process_steps: (sb.contact_process_steps || []).map(function(s) { return s.text || s; }),
    },
    footer: {
      address: sb.footer_address || '',
      phone: sb.footer_phone || '',
      email: sb.footer_email || '',
    },
  };
}

// ============================================
// RENDERER
// ============================================

function renderContent(c) {
  // Helper
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }
  function setText(sel, text) {
    var el = $(sel);
    if (el && text) el.textContent = text;
  }
  function setHTML(sel, html) {
    var el = $(sel);
    if (el && html) el.innerHTML = html;
  }
  function setImg(sel, src) {
    var el = $(sel);
    if (el && src) el.src = src;
  }

  // Meta
  if (c.meta) {
    if (c.meta.title) document.title = c.meta.title;
    var metaDesc = $('meta[name="description"]');
    if (metaDesc && c.meta.description) metaDesc.content = c.meta.description;
  }

  // Hero
  if (c.hero) {
    setText('[data-cms="hero.badge"]', c.hero.badge);
    if (c.hero.headline || c.hero.headline_accent_1) {
      var h1 = $('[data-cms="hero.headline"]');
      if (h1) {
        h1.innerHTML = c.hero.headline + ' <span class="h1-accent">' + c.hero.headline_accent_1 + '</span> <span class="h1-accent">' + c.hero.headline_accent_2 + '</span>';
      }
    }
    setText('[data-cms="hero.subline"]', c.hero.subline);
    setText('[data-cms="hero.cta_text"]', c.hero.cta_text);
    setText('[data-cms="hero.cta_note"]', c.hero.cta_note);
    setImg('[data-cms="hero.image_main"]', c.hero.image_main);
    setImg('[data-cms="hero.image_secondary"]', c.hero.image_secondary);
    setText('[data-cms="hero.stat_number"]', c.hero.stat_number);
    setText('[data-cms="hero.stat_label"]', c.hero.stat_label);

    var proofContainer = $('[data-cms="hero.proof"]');
    if (proofContainer && c.hero.proof_items) {
      proofContainer.innerHTML = c.hero.proof_items.map(function(item) {
        return '<div class="hero-proof-item"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M7 10l2 2 4-4" stroke="#268ced" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="10" r="9" stroke="#268ced" stroke-width="1.5"/></svg><span>' + item + '</span></div>';
      }).join('');
    }
  }

  // Logos
  if (c.logos) {
    setText('[data-cms="logos.label"]', c.logos.label);
    var logosSlide = $('[data-cms="logos.items"]');
    if (logosSlide && c.logos.items) {
      var logosHTML = c.logos.items.map(function(name) {
        return '<div class="logo-item logo-item-text"><span>' + name + '</span></div>';
      });
      // Duplicate for seamless loop
      logosSlide.innerHTML = logosHTML.join('') + logosHTML.join('');
    }
  }

  // Problem
  if (c.problem) {
    setText('[data-cms="problem.badge"]', c.problem.badge);
    setText('[data-cms="problem.headline"]', c.problem.headline);
    setImg('[data-cms="problem.image"]', c.problem.image);
    setText('[data-cms="problem.quote"]', c.problem.quote);
    setText('[data-cms="problem.closing"]', c.problem.closing);

    var problemList = $('[data-cms="problem.items"]');
    if (problemList && c.problem.items) {
      problemList.innerHTML = c.problem.items.map(function(item) {
        return '<div class="problem-item" data-reveal><div class="problem-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#195996" stroke-width="1.5" stroke-linecap="round"/></svg></div><p>' + item + '</p></div>';
      }).join('');
    }
  }

  // Solution
  if (c.solution) {
    setText('[data-cms="solution.badge"]', c.solution.badge);
    setText('[data-cms="solution.headline"]', c.solution.headline);
    setText('[data-cms="solution.intro"]', c.solution.intro);
    setText('[data-cms="solution.differentiator"]', c.solution.differentiator);

    var stepsGrid = $('[data-cms="solution.steps"]');
    if (stepsGrid && c.solution.steps) {
      stepsGrid.innerHTML = c.solution.steps.map(function(step, i) {
        return '<div class="approach-card" data-reveal><div class="approach-card-top"><img src="' + step.image + '" alt="' + step.title + '" class="approach-img"><div class="approach-number">0' + (i + 1) + '</div></div><div class="approach-card-body"><h3>' + step.title + '</h3><p>' + step.description + '</p></div></div>';
      }).join('');
    }
  }

  // Numbers
  if (c.numbers) {
    var numbersGrid = $('[data-cms="numbers"]');
    if (numbersGrid) {
      numbersGrid.innerHTML = c.numbers.map(function(n) {
        var countAttr = n.count ? ' data-count="' + n.count + '"' : '';
        var displayValue = n.count ? '0' : n.value;
        var plus = n.value && n.value.includes('+') ? '<span class="number-plus">+</span>' : '';
        return '<div class="number-card" data-reveal><span class="number-value"' + countAttr + '>' + displayValue + '</span>' + plus + '<span class="number-label">' + n.label + '</span></div>';
      }).join('');
    }
  }

  // Cases
  if (c.cases) {
    setText('[data-cms="cases.badge"]', c.cases.badge);
    setText('[data-cms="cases.headline"]', c.cases.headline);

    var casesContainer = $('[data-cms="cases.items"]');
    if (casesContainer && c.cases.items) {
      casesContainer.innerHTML = c.cases.items.map(function(cs) {
        var resultsHTML = cs.results.map(function(r) { return '<li>' + r + '</li>'; }).join('');
        return '<div class="case-card" data-reveal><div class="case-card-image"><img src="' + cs.image + '" alt="' + cs.name + '" class="case-img"><span class="case-tag">' + cs.tag + '</span></div><div class="case-card-content"><h3>' + cs.name + '</h3><p class="case-subtitle">' + cs.subtitle + '</p><div class="case-details"><div class="case-detail"><h4>Ausgangslage</h4><p>' + cs.problem + '</p></div><div class="case-detail"><h4>Ergebnis</h4><ul>' + resultsHTML + '</ul></div></div></div></div>';
      }).join('');
    }
  }

  // Testimonial
  if (c.testimonial) {
    setText('[data-cms="testimonial.quote"]', c.testimonial.quote);
    setText('[data-cms="testimonial.author"]', c.testimonial.author);
    setText('[data-cms="testimonial.note"]', c.testimonial.note);
  }

  // Video
  if (c.video) {
    setText('[data-cms="video.badge"]', c.video.badge);
    setText('[data-cms="video.headline"]', c.video.headline);
    setText('[data-cms="video.description"]', c.video.description);
    setImg('[data-cms="video.thumbnail"]', c.video.thumbnail);
  }

  // About
  if (c.about) {
    setText('[data-cms="about.badge"]', c.about.badge);
    setText('[data-cms="about.headline"]', c.about.headline);
    setText('[data-cms="about.lead"]', c.about.lead);
    setText('[data-cms="about.body"]', c.about.body);
    setImg('[data-cms="about.image_1"]', c.about.image_1);
    setImg('[data-cms="about.image_2"]', c.about.image_2);

    var uspsGrid = $('[data-cms="about.usps"]');
    if (uspsGrid && c.about.usps) {
      uspsGrid.innerHTML = c.about.usps.map(function(usp) {
        return '<div class="usp-card" data-reveal><div class="usp-icon"><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M9 14l3 3 7-7" stroke="#195996" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="14" cy="14" r="10.5" stroke="#195996" stroke-width="1.5"/></svg></div><p>' + usp + '</p></div>';
      }).join('');
    }
  }

  // FAQ
  if (c.faq) {
    setText('[data-cms="faq.badge"]', c.faq.badge);
    setText('[data-cms="faq.headline"]', c.faq.headline);
    setText('[data-cms="faq.intro"]', c.faq.intro);

    var faqContainer = $('[data-cms="faq.items"]');
    if (faqContainer && c.faq.items) {
      faqContainer.innerHTML = c.faq.items.map(function(faq) {
        return '<div class="faq-item" data-reveal><button class="faq-question" aria-expanded="false"><span>' + faq.question + '</span><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="faq-answer"><p>' + faq.answer + '</p></div></div>';
      }).join('');

      // Re-bind FAQ accordion
      faqContainer.querySelectorAll('.faq-question').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var item = this.parentElement;
          var isOpen = item.classList.contains('open');
          faqContainer.querySelectorAll('.faq-item.open').forEach(function(el) { el.classList.remove('open'); });
          if (!isOpen) item.classList.add('open');
        });
      });
    }
  }

  // Contact
  if (c.contact) {
    setText('[data-cms="contact.headline"]', c.contact.headline);
    setText('[data-cms="contact.subline"]', c.contact.subline);
    setImg('[data-cms="contact.portrait"]', c.contact.portrait);
    setText('[data-cms="contact.portrait_name"]', c.contact.portrait_name);
    setText('[data-cms="contact.portrait_role"]', c.contact.portrait_role);
    var phoneLink = $('[data-cms="contact.phone"]');
    if (phoneLink && c.contact.phone) {
      phoneLink.textContent = c.contact.phone;
      phoneLink.href = 'tel:' + c.contact.phone.replace(/\s/g, '');
    }
  }

  // Re-init scroll reveals for dynamically added elements
  var revealObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('[data-reveal]:not(.revealed)').forEach(function(el) {
    revealObserver.observe(el);
  });

  // Re-init count-up for dynamically added numbers
  var countObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var el = entry.target;
        var target = parseInt(el.getAttribute('data-count'));
        if (!target) return;
        var duration = 1500;
        var startTime = null;
        function step(timestamp) {
          if (!startTime) startTime = timestamp;
          var progress = Math.min((timestamp - startTime) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.floor(eased * target);
          if (progress < 1) requestAnimationFrame(step);
          else el.textContent = target;
        }
        requestAnimationFrame(step);
        countObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-count]').forEach(function(el) {
    countObserver.observe(el);
  });
}

// ============================================
// STORYBLOK BRIDGE (Live Preview in Visual Editor)
// ============================================
function initStoryblokBridge() {
  if (typeof StoryblokBridge === 'undefined') return;

  var bridge = new StoryblokBridge({ accessToken: CMS_CONFIG.accessToken });

  bridge.on('input', function(event) {
    // Live preview: re-render on every keystroke in the editor
    if (event.story && event.story.content) {
      var cmsContent = transformStoryblokContent(event.story.content);
      // Merge with fallback for images
      fetch('content.json').then(function(r) { return r.json(); }).then(function(fallback) {
        renderContent(deepMerge(fallback, cmsContent));
      }).catch(function() {
        renderContent(cmsContent);
      });
    }
  });

  bridge.on('published', function() {
    // Reload on publish
    window.location.reload();
  });

  console.log('[CMS] Storyblok Bridge initialized (live preview active)');
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  loadContent();
  initStoryblokBridge();
});
