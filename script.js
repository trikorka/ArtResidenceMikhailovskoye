document.documentElement.classList.add('motion-ready');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const scrollToTopButton = document.querySelector('.scroll-to-top');
if (scrollToTopButton) {
  let scrollUpdateQueued = false;

  const updateScrollToTopButton = () => {
    const isVisible = window.scrollY > Math.min(window.innerHeight * 0.75, 640);
    scrollToTopButton.classList.toggle('is-visible', isVisible);
    scrollToTopButton.setAttribute('aria-hidden', String(!isVisible));
    scrollToTopButton.tabIndex = isVisible ? 0 : -1;
    scrollUpdateQueued = false;
  };

  window.addEventListener('scroll', () => {
    if (scrollUpdateQueued) return;
    scrollUpdateQueued = true;
    window.requestAnimationFrame(updateScrollToTopButton);
  }, { passive: true });

  scrollToTopButton.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  });

  updateScrollToTopButton();
}

const revealElements = [
  ...document.querySelectorAll('.about-copy h2, .section-heading h2, .audience h2, .voices-heading h2'),
];
const revealCopy = [
  ...document.querySelectorAll('.about-copy > p, .section-heading > p, .audience > .shell > .lead, .voices-heading > span'),
];
const ruleElements = [...document.querySelectorAll('.about-copy hr, .contacts-grid hr')];
const staggerGroups = [
  { element: document.querySelector('.audience-grid'), items: '.audience-card' },
  { element: document.querySelector('.event-grid'), items: '.event-card' },
].filter(({ element }) => element);

revealElements.forEach((element) => element.classList.add('print-reveal'));
revealCopy.forEach((element) => element.classList.add('print-reveal', 'print-reveal-copy'));
ruleElements.forEach((element) => element.classList.add('print-rule'));
staggerGroups.forEach(({ element, items }) => {
  element.classList.add('print-stagger');
  element.querySelectorAll(items).forEach((item, index) => {
    item.classList.add('print-item');
    item.style.setProperty('--print-order', index);
  });
});

const motionTargets = [...revealElements, ...revealCopy, ...ruleElements, ...staggerGroups.map(({ element }) => element)];

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.setAttribute('data-visible', '');
      if (entry.target.classList.contains('print-stagger')) {
        window.setTimeout(
          () => entry.target.classList.add('print-settled'),
          reducedMotion.matches ? 140 : 820,
        );
      }
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -12% 0px' });

  motionTargets.forEach((target) => revealObserver.observe(target));
} else {
  motionTargets.forEach((target) => target.setAttribute('data-visible', ''));
}

const menuButton = document.querySelector('.menu-button');
const mobileMenu = document.querySelector('.mobile-menu');
const mobileMenuLinks = [...document.querySelectorAll('.mobile-menu a')];

const setMenuOpen = (open, restoreFocus = true) => {
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  mobileMenu.setAttribute('aria-hidden', String(!open));
  mobileMenu.inert = !open;
  document.body.classList.toggle('menu-open', open);

  if (open) {
    requestAnimationFrame(() => mobileMenuLinks[0]?.focus());
  } else if (restoreFocus) {
    menuButton.focus();
  }
};

menuButton?.addEventListener('click', () => {
  setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true');
});

mobileMenuLinks.forEach((link) => link.addEventListener('click', () => setMenuOpen(false, false)));

document.addEventListener('keydown', (event) => {
  if (menuButton?.getAttribute('aria-expanded') !== 'true') return;

  if (event.key === 'Escape') {
    event.preventDefault();
    setMenuOpen(false);
    return;
  }

  if (event.key !== 'Tab') return;
  const focusable = [menuButton, ...mobileMenuLinks];
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

const filterButtons = [...document.querySelectorAll('.filters button')];
const cards = [...document.querySelectorAll('.event-card')];
const eventRail = document.querySelector('.event-rail');
const eventGrid = document.querySelector('.event-grid');
const eventsMoreButton = document.querySelector('.events-more');
const mobileEvents = window.matchMedia('(max-width: 800px)');
const MARQUEE_CYCLE_MS = 60000;
let mobileEventsExpanded = false;
let manualMarqueePause = false;
let draggingRail = false;
let railInteracting = false;
let railInView = false;
let dragStartX = 0;
let dragStartScroll = 0;
let marqueeFrame = null;
let marqueePreviousTime = 0;
let marqueePosition = 0;

const visibleEventCards = () => cards.filter((card) => !card.hidden);
const hasExpandedEvent = () => visibleEventCards().some((card) => card.querySelector('.event-more')?.getAttribute('aria-expanded') === 'true');

const removeEventLoopClones = () => {
  eventGrid?.querySelectorAll('.event-card-clone').forEach((clone) => clone.remove());
};

const syncEventLoopClones = () => {
  removeEventLoopClones();
  if (!eventGrid || !eventRail?.classList.contains('is-marquee') || reducedMotion.matches) return;

  visibleEventCards().forEach((card) => {
    const clone = card.cloneNode(true);
    clone.classList.add('event-card-clone');
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
    clone.querySelectorAll('[aria-controls]').forEach((element) => element.removeAttribute('aria-controls'));
    clone.querySelectorAll('a,button').forEach((element) => {
      element.setAttribute('tabindex', '-1');
      if (element instanceof HTMLButtonElement) element.disabled = true;
    });
    eventGrid.append(clone);
  });
};

const eventLoopWidth = () => {
  const firstCard = visibleEventCards()[0];
  const firstClone = eventGrid?.querySelector('.event-card-clone');
  if (!firstCard || !firstClone) return 0;
  return firstClone.offsetLeft - firstCard.offsetLeft;
};

const normalizeEventLoopPosition = () => {
  if (!eventRail?.classList.contains('is-marquee')) return;
  const loopWidth = eventLoopWidth();
  if (loopWidth <= 1 || eventRail.scrollLeft < loopWidth) return;
  eventRail.scrollLeft %= loopWidth;
  marqueePosition = eventRail.scrollLeft;
};

const stopMarquee = () => {
  if (marqueeFrame === null) return;
  window.cancelAnimationFrame(marqueeFrame);
  marqueeFrame = null;
};

const marqueeCanRun = () => (
  eventRail?.classList.contains('is-marquee')
  && railInView
  && !manualMarqueePause
  && !draggingRail
  && !railInteracting
  && !hasExpandedEvent()
  && !reducedMotion.matches
  && !document.hidden
);

const runMarquee = (time) => {
  if (!marqueeCanRun()) {
    marqueeFrame = null;
    return;
  }
  const loopWidth = eventLoopWidth();
  if (loopWidth > 1 && marqueePreviousTime) {
    const elapsed = time - marqueePreviousTime;
    marqueePosition += loopWidth * elapsed / MARQUEE_CYCLE_MS;
    if (marqueePosition >= loopWidth) marqueePosition %= loopWidth;
    eventRail.scrollLeft = marqueePosition;
  }
  marqueePreviousTime = time;
  marqueeFrame = window.requestAnimationFrame(runMarquee);
};

const updateMarquee = () => {
  stopMarquee();
  marqueePreviousTime = 0;
  marqueePosition = eventRail?.scrollLeft ?? 0;
  const canRun = marqueeCanRun();
  if (canRun) marqueeFrame = window.requestAnimationFrame(runMarquee);
};

const updateEventPresentation = ({ reset = false } = {}) => {
  const visibleCards = visibleEventCards();
  if (reset) {
    mobileEventsExpanded = false;
    manualMarqueePause = false;
    if (eventRail) eventRail.scrollLeft = 0;
  }

  const shouldLimitMobile = mobileEvents.matches && visibleCards.length > 4 && !mobileEventsExpanded;
  visibleCards.forEach((card, index) => card.classList.toggle('is-mobile-overflow', shouldLimitMobile && index >= 3));

  if (eventsMoreButton) {
    const canExpand = mobileEvents.matches && visibleCards.length > 4;
    eventsMoreButton.hidden = !canExpand;
    eventsMoreButton.querySelector('span').textContent = mobileEventsExpanded ? 'Свернуть' : 'Показать ещё';
    eventsMoreButton.querySelector('span:last-child').textContent = mobileEventsExpanded ? '↑' : '↓';
    eventsMoreButton.setAttribute('aria-expanded', String(mobileEventsExpanded));
  }

  const shouldMarquee = !mobileEvents.matches && visibleCards.length > 4;
  eventRail?.classList.toggle('is-marquee', shouldMarquee);
  syncEventLoopClones();
  if (!shouldMarquee && eventRail) eventRail.scrollLeft = 0;
  updateMarquee();
};

const closeEventDetails = () => {
  cards.forEach((card) => {
    const button = card.querySelector('.event-more');
    if (!button) return;
    button.setAttribute('aria-expanded', 'false');
    card.classList.remove('is-expanded');
    const label = button.querySelector('span');
    if (label) label.textContent = 'Подробнее';
    const details = document.getElementById(button.getAttribute('aria-controls'));
    if (details) details.hidden = true;
  });
};

const animateVisibleEvents = () => {
  visibleEventCards().filter((card) => !card.classList.contains('is-mobile-overflow')).forEach((card, index) => {
    if (typeof card.animate !== 'function') return;
    card.animate(
      reducedMotion.matches
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
          { opacity: 0, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
      {
        duration: reducedMotion.matches ? 120 : 240,
        delay: reducedMotion.matches ? 0 : index * 45,
        easing: 'cubic-bezier(.23,1,.32,1)',
      },
    );
  });
};

filterButtons.forEach((button) => button.addEventListener('click', () => {
  if (button.getAttribute('aria-pressed') === 'true') return;
  filterButtons.forEach((item) => {
    item.classList.remove('active');
    item.setAttribute('aria-pressed', 'false');
  });
  button.classList.add('active');
  button.setAttribute('aria-pressed', 'true');
  const filter = button.dataset.filter;
  cards.forEach((card) => {
    const categories = card.dataset.category?.split(/\s+/) ?? [];
    card.hidden = filter !== 'all' && !categories.includes(filter);
    card.classList.remove('is-mobile-overflow');
  });
  closeEventDetails();
  updateEventPresentation({ reset: true });
  animateVisibleEvents();
}));

document.querySelectorAll('.event-more').forEach((button) => button.addEventListener('click', () => {
  const details = document.getElementById(button.getAttribute('aria-controls'));
  const open = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!open));
  button.closest('.event-card')?.classList.toggle('is-expanded', !open);
  const label = button.querySelector('span');
  if (label) label.textContent = open ? 'Подробнее' : 'Свернуть';
  details.hidden = open;
  updateMarquee();
}));

eventsMoreButton?.addEventListener('click', () => {
  mobileEventsExpanded = !mobileEventsExpanded;
  updateEventPresentation();
  if (mobileEventsExpanded) {
    visibleEventCards().slice(3).forEach((card, index) => {
      if (typeof card.animate !== 'function') return;
      card.animate(
        reducedMotion.matches
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: reducedMotion.matches ? 120 : 240, delay: reducedMotion.matches ? 0 : index * 45, easing: 'cubic-bezier(.23,1,.32,1)' },
      );
    });
  }
});

eventRail?.addEventListener('pointerdown', (event) => {
  if (!eventRail.classList.contains('is-marquee') || event.target.closest('button,a')) return;
  draggingRail = true;
  manualMarqueePause = true;
  dragStartX = event.clientX;
  dragStartScroll = eventRail.scrollLeft;
  eventRail.classList.add('is-dragging');
  eventRail.setPointerCapture(event.pointerId);
  updateMarquee();
});
eventRail?.addEventListener('pointermove', (event) => {
  if (!draggingRail) return;
  eventRail.scrollLeft = dragStartScroll - (event.clientX - dragStartX);
  normalizeEventLoopPosition();
});
const finishRailDrag = (event) => {
  if (!draggingRail) return;
  draggingRail = false;
  eventRail.classList.remove('is-dragging');
  if (eventRail.hasPointerCapture(event.pointerId)) eventRail.releasePointerCapture(event.pointerId);
  updateMarquee();
};
eventRail?.addEventListener('pointerup', finishRailDrag);
eventRail?.addEventListener('pointercancel', finishRailDrag);
eventRail?.addEventListener('pointerenter', () => {
  railInteracting = true;
  updateMarquee();
});
eventRail?.addEventListener('pointerleave', () => {
  railInteracting = false;
  updateMarquee();
});
eventRail?.addEventListener('focusin', () => {
  railInteracting = true;
  updateMarquee();
});
eventRail?.addEventListener('focusout', (event) => {
  if (eventRail.contains(event.relatedTarget)) return;
  railInteracting = false;
  updateMarquee();
});
eventRail?.addEventListener('wheel', (event) => {
  if (!eventRail.classList.contains('is-marquee')) return;
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  event.preventDefault();
  manualMarqueePause = true;
  eventRail.scrollLeft += event.deltaY;
  normalizeEventLoopPosition();
  updateMarquee();
}, { passive: false });
eventRail?.addEventListener('keydown', (event) => {
  if (!eventRail.classList.contains('is-marquee') || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  manualMarqueePause = true;
  window.requestAnimationFrame(normalizeEventLoopPosition);
  updateMarquee();
});

if ('IntersectionObserver' in window && eventRail) {
  const railObserver = new IntersectionObserver(([entry]) => {
    railInView = entry.isIntersecting;
    updateMarquee();
  }, { threshold: 0.05 });
  railObserver.observe(eventRail);
} else {
  railInView = true;
}

mobileEvents.addEventListener('change', () => updateEventPresentation({ reset: true }));
reducedMotion.addEventListener('change', () => {
  syncEventLoopClones();
  updateMarquee();
});
document.addEventListener('visibilitychange', updateMarquee);
updateEventPresentation({ reset: true });

const merchSection = document.querySelector('.merch');
const merchRail = document.querySelector('.merch-rail');
const merchCards = [...document.querySelectorAll('.merch-card')];
const merchPreviousButton = document.querySelector('.merch-prev');
const merchNextButton = document.querySelector('.merch-next');
const merchMoreButton = document.querySelector('.merch-more');
const mobileMerch = window.matchMedia('(max-width: 800px)');
let mobileMerchExpanded = false;
let merchScrollFrame = null;

const updateMerchControls = () => {
  if (!merchRail || !merchPreviousButton || !merchNextButton) return;
  const atStart = merchRail.scrollLeft <= 2;
  const atEnd = merchRail.scrollLeft + merchRail.clientWidth >= merchRail.scrollWidth - 2;
  merchPreviousButton.disabled = mobileMerch.matches || atStart;
  merchNextButton.disabled = mobileMerch.matches || atEnd;
};

const merchStep = () => {
  const firstCard = merchCards[0];
  if (!firstCard || !merchRail) return 0;
  const gap = Number.parseFloat(window.getComputedStyle(merchRail.querySelector('.merch-grid')).columnGap) || 0;
  return firstCard.getBoundingClientRect().width + gap;
};

const scrollMerch = (direction) => {
  const distance = merchStep();
  if (!merchRail || distance <= 0) return;
  merchRail.scrollBy({ left: direction * distance, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
};

merchPreviousButton?.addEventListener('click', () => scrollMerch(-1));
merchNextButton?.addEventListener('click', () => scrollMerch(1));
merchRail?.addEventListener('scroll', () => {
  if (merchScrollFrame !== null) return;
  merchScrollFrame = window.requestAnimationFrame(() => {
    updateMerchControls();
    merchScrollFrame = null;
  });
}, { passive: true });

const updateMerchPresentation = ({ reset = false } = {}) => {
  if (reset) mobileMerchExpanded = false;
  const canExpand = mobileMerch.matches && merchCards.length > 2;

  merchCards.forEach((card, index) => {
    card.classList.toggle('is-mobile-overflow', canExpand && !mobileMerchExpanded && index >= 2);
  });

  if (merchMoreButton) {
    merchMoreButton.hidden = !canExpand;
    merchMoreButton.setAttribute('aria-expanded', String(mobileMerchExpanded));
    merchMoreButton.firstElementChild.textContent = mobileMerchExpanded
      ? '\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c'
      : '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0435\u0449\u0451';
    merchMoreButton.lastElementChild.textContent = mobileMerchExpanded ? '\u2191' : '\u2193';
  }

  if (reset && merchRail) merchRail.scrollLeft = 0;
  window.requestAnimationFrame(updateMerchControls);
};

merchMoreButton?.addEventListener('click', () => {
  mobileMerchExpanded = !mobileMerchExpanded;
  updateMerchPresentation();
  if (!mobileMerchExpanded) {
    merchSection?.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }
});

mobileMerch.addEventListener('change', () => updateMerchPresentation({ reset: true }));
window.addEventListener('resize', updateMerchControls, { passive: true });
updateMerchPresentation({ reset: true });

const gallerySection = document.querySelector('.gallery');
const galleryGroups = [...document.querySelectorAll('.gallery-group')];
const galleryCards = galleryGroups.flatMap((group) => [...group.querySelectorAll('.gallery-card')]);
const galleryMoreButton = document.querySelector('.gallery-more');
const mobileGallery = window.matchMedia('(max-width: 800px)');
let mobileGalleryExpanded = false;
let galleryResizeFrame = null;

const createGalleryLoopClone = (group) => {
  const clone = group.cloneNode(true);
  clone.classList.add('gallery-loop-clone');
  clone.setAttribute('aria-hidden', 'true');
  clone.querySelectorAll('a').forEach((link) => link.setAttribute('tabindex', '-1'));
  return clone;
};

const syncGalleryRows = () => {
  document.querySelectorAll('.gallery-loop-clone').forEach((clone) => clone.remove());
  if (mobileGallery.matches || reducedMotion.matches) return;

  galleryGroups.forEach((group) => {
    const track = group.parentElement;
    const groupWidth = group.getBoundingClientRect().width;
    if (!track || groupWidth <= 1) return;

    track.style.setProperty('--gallery-shift', `${-groupWidth}px`);
    const groupCount = Math.max(2, Math.ceil((window.innerWidth + groupWidth) / groupWidth));
    for (let index = 1; index < groupCount; index += 1) {
      track.append(createGalleryLoopClone(group));
    }
  });
};

const updateGalleryPresentation = ({ reset = false } = {}) => {
  if (reset) mobileGalleryExpanded = false;
  const canExpand = mobileGallery.matches && galleryCards.length > 3;

  galleryCards.forEach((card, index) => {
    card.classList.toggle('is-mobile-overflow', canExpand && !mobileGalleryExpanded && index >= 3);
  });

  if (!galleryMoreButton) return;
  galleryMoreButton.hidden = !canExpand;
  galleryMoreButton.setAttribute('aria-expanded', String(mobileGalleryExpanded));
  galleryMoreButton.firstElementChild.textContent = mobileGalleryExpanded
    ? '\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c'
    : '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0435\u0449\u0451';
  galleryMoreButton.lastElementChild.textContent = mobileGalleryExpanded ? '\u2191' : '\u2193';
};

galleryMoreButton?.addEventListener('click', () => {
  mobileGalleryExpanded = !mobileGalleryExpanded;
  updateGalleryPresentation();

  if (!mobileGalleryExpanded) {
    gallerySection?.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
    return;
  }

  galleryCards.slice(3).forEach((card, index) => {
    if (typeof card.animate !== 'function') return;
    card.animate(
      reducedMotion.matches
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }],
      {
        duration: reducedMotion.matches ? 120 : 240,
        delay: reducedMotion.matches ? 0 : index * 45,
        easing: 'cubic-bezier(.23,1,.32,1)',
      },
    );
  });
});

mobileGallery.addEventListener('change', () => {
  updateGalleryPresentation({ reset: true });
  syncGalleryRows();
});
reducedMotion.addEventListener('change', syncGalleryRows);
window.addEventListener('resize', () => {
  if (galleryResizeFrame !== null) window.cancelAnimationFrame(galleryResizeFrame);
  galleryResizeFrame = window.requestAnimationFrame(() => {
    syncGalleryRows();
    galleryResizeFrame = null;
  });
}, { passive: true });
syncGalleryRows();
updateGalleryPresentation({ reset: true });

const contactForm = document.querySelector('#contact-form');
const contactPurpose = document.querySelector('#contact-purpose');
const contactPanels = [...document.querySelectorAll('[data-purpose-panel]')];
const contactTitle = document.querySelector('[data-contact-title]');
const contactSubmitLabel = document.querySelector('[data-contact-submit]');

const contactPurposeConfig = {
  residency: { title: 'Стать резидентом', button: 'Подготовить заявку', subject: 'Заявка резидента' },
  event: { title: 'Запланировать визит', button: 'Подготовить запись', subject: 'Запись на визит или событие' },
  merch: { title: 'Заказать мерч', button: 'Подготовить заказ', subject: 'Запрос на мерч' },
  workshop: { title: 'Предложить программу', button: 'Подготовить предложение', subject: 'Мастер-класс или пленэр' },
  partnership: { title: 'Предложить партнёрство', button: 'Подготовить предложение', subject: 'Предложение о партнёрстве' },
  other: { title: 'Задать вопрос', button: 'Подготовить вопрос', subject: 'Вопрос в арт-резиденцию' },
};

const setContactPurpose = (purpose) => {
  const config = contactPurposeConfig[purpose];
  if (contactPurpose && contactPurpose.value !== purpose) contactPurpose.value = purpose;

  contactPanels.forEach((panel) => {
    const active = panel.dataset.purposePanel === purpose;
    panel.hidden = !active;
    panel.disabled = !active;
    panel.querySelectorAll('[data-required]').forEach((field) => {
      field.required = active;
    });
  });

  if (contactTitle) contactTitle.textContent = config?.title ?? 'Обсудить вопрос';
  if (contactSubmitLabel) contactSubmitLabel.textContent = config?.button ?? 'Подготовить запрос';
  const status = contactForm?.querySelector('.form-status');
  if (status) status.textContent = '';
};

contactPurpose?.addEventListener('change', () => setContactPurpose(contactPurpose.value));

const contactPrefillRules = [
  ['.hero-bottom .button', 'residency'],
  ['.merch-action a', 'merch'],
  ['.stay-card:not(.stay-card--guests) .stay-card-link', 'residency'],
  ['.stay-card--guests .stay-card-link', 'event'],
  ['.audience-card:nth-child(1) > a, .audience-card:nth-child(2) > a', 'residency'],
  ['.audience-card:nth-child(3) > a', 'partnership'],
  ['.audience-card:nth-child(4) > a', 'event'],
  ['.event-cta[href="#contacts"]', 'event'],
];

contactPrefillRules.forEach(([selector, purpose]) => {
  document.querySelectorAll(selector).forEach((link) => {
    link.addEventListener('click', () => setContactPurpose(purpose));
  });
});

contactForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(contactForm);
  const status = contactForm.querySelector('.form-status');
  const purpose = String(data.get('purpose') ?? '');
  const config = contactPurposeConfig[purpose];
  const activePanel = contactPanels.find((panel) => panel.dataset.purposePanel === purpose);
  const purposeLabel = contactPurpose?.selectedOptions[0]?.textContent ?? '';
  const detailRows = activePanel
    ? [...activePanel.querySelectorAll('[data-label]')].flatMap((field) => {
      const value = field instanceof HTMLSelectElement
        ? field.selectedOptions[0]?.textContent?.trim()
        : field.value.trim();
      return value ? [`${field.dataset.label}: ${value}`] : [];
    })
    : [];
  const requestText = [
    `${config?.subject ?? 'Обращение'} — «Михайловское»`,
    `Имя: ${data.get('name')}`,
    `Email: ${data.get('email')}`,
    `Цель обращения: ${purposeLabel}`,
    `Рассылка: ${data.get('newsletter') ? 'да' : 'нет'}`,
    '',
    ...detailRows,
  ].join('\n');
  const teamEmail = document.body.dataset.contactEmail?.trim();

  if (teamEmail) {
    const subject = encodeURIComponent(config?.subject ?? 'Обращение в арт-резиденцию «Михайловское»');
    const body = encodeURIComponent(requestText);
    window.location.href = `mailto:${teamEmail}?subject=${subject}&body=${body}`;
    status.textContent = 'Письмо подготовлено в вашем почтовом приложении.';
    return;
  }

  try {
    await navigator.clipboard.writeText(requestText);
    status.textContent = 'Текст обращения скопирован.';
  } catch {
    status.textContent = 'Не удалось скопировать текст. Проверьте заполненные данные и повторите попытку.';
  }
});

setContactPurpose(contactPurpose?.value ?? '');

const restoration = document.querySelector('[data-restoration]');
const mobileRestoration = window.matchMedia('(max-width: 800px)');

if (restoration && !mobileRestoration.matches) {
  const restoredImage = restoration.querySelector('.restoration-after');
  const canvas = restoration.querySelector('.restoration-paint');
  const cursor = restoration.querySelector('.restoration-cursor');
  const context = canvas.getContext('2d', { alpha: true });
  const mask = document.createElement('canvas');
  mask.width = canvas.width;
  mask.height = canvas.height;
  const maskContext = mask.getContext('2d');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const grid = { columns: 144, rows: 48 };
  const paintedCells = new Uint8Array(grid.columns * grid.rows);
  const buildingCells = new Uint8Array(grid.columns * grid.rows);
  const brushRadius = canvas.width * 0.048;
  const brushBristles = 11;
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  let buildingCellCount = 0;
  let paintedCellCount = 0;
  let drawing = false;
  let autoFilling = false;
  let complete = false;
  let lastPoint = null;

  const renderPaint = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = 'source-over';
    context.drawImage(restoredImage, 0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(mask, 0, 0);
    context.globalCompositeOperation = 'source-over';
  };

  const finishRestoration = () => {
    if (complete) return;
    complete = true;
    drawing = false;
    restoration.classList.add('is-complete');
    restoration.classList.remove('is-hovered');
    restoration.closest('.hero')?.classList.add('restoration-complete');
  };

  const updateCoverage = (x, y, radius) => {
    const cellWidth = canvas.width / grid.columns;
    const cellHeight = canvas.height / grid.rows;
    const startColumn = Math.max(0, Math.floor((x - radius) / cellWidth));
    const endColumn = Math.min(grid.columns - 1, Math.ceil((x + radius) / cellWidth));
    const startRow = Math.max(0, Math.floor((y - radius) / cellHeight));
    const endRow = Math.min(grid.rows - 1, Math.ceil((y + radius) / cellHeight));

    for (let row = startRow; row <= endRow; row += 1) {
      for (let column = startColumn; column <= endColumn; column += 1) {
        const index = row * grid.columns + column;
        if (!buildingCells[index] || paintedCells[index]) continue;
        const centerX = (column + 0.5) * cellWidth;
        const centerY = (row + 0.5) * cellHeight;
        if (Math.hypot(centerX - x, centerY - y) <= radius) {
          paintedCells[index] = 1;
          paintedCellCount += 1;
        }
      }
    }

    const ratio = buildingCellCount ? paintedCellCount / buildingCellCount : 0;
    if (ratio >= 0.25) startAutoFill();
  };

  const stamp = (x, y, radius, angle, opacity) => {
    maskContext.save();
    maskContext.translate(x, y);
    maskContext.rotate(angle);

    const wash = maskContext.createRadialGradient(0, 0, radius * 0.08, 0, 0, radius);
    wash.addColorStop(0, `rgba(255,255,255,${0.34 * opacity})`);
    wash.addColorStop(0.55, `rgba(255,255,255,${0.23 * opacity})`);
    wash.addColorStop(0.82, `rgba(255,255,255,${0.1 * opacity})`);
    wash.addColorStop(1, 'rgba(255,255,255,0)');
    maskContext.fillStyle = wash;
    maskContext.beginPath();
    maskContext.ellipse(0, 0, radius, radius * 0.72, 0, 0, Math.PI * 2);
    maskContext.fill();

    for (let index = 0; index < brushBristles; index += 1) {
      const position = brushBristles === 1 ? 0 : index / (brushBristles - 1) - 0.5;
      const offsetY = position * radius * 1.42 + (Math.random() - 0.5) * radius * 0.13;
      const bristleLength = radius * (0.72 + Math.random() * 0.55);
      const bristleWidth = radius * (0.018 + Math.random() * 0.038);
      const bristleAlpha = (0.12 + Math.random() * 0.2) * opacity;
      maskContext.fillStyle = `rgba(255,255,255,${bristleAlpha})`;
      maskContext.beginPath();
      maskContext.ellipse(
        (Math.random() - 0.5) * radius * 0.28,
        offsetY,
        bristleLength,
        bristleWidth,
        (Math.random() - 0.5) * 0.12,
        0,
        Math.PI * 2,
      );
      maskContext.fill();
    }

    for (let index = 0; index < 12; index += 1) {
      const grainAngle = Math.random() * Math.PI * 2;
      const grainDistance = Math.sqrt(Math.random()) * radius * 0.86;
      const grainSize = radius * (0.01 + Math.random() * 0.022);
      maskContext.fillStyle = `rgba(255,255,255,${(0.1 + Math.random() * 0.18) * opacity})`;
      maskContext.beginPath();
      maskContext.arc(
        Math.cos(grainAngle) * grainDistance,
        Math.sin(grainAngle) * grainDistance * 0.72,
        grainSize,
        0,
        Math.PI * 2,
      );
      maskContext.fill();
    }

    maskContext.restore();
    updateCoverage(x, y, radius * 0.7);
  };

  const spreadStamp = (x, y, radius, angle) => {
    maskContext.save();
    maskContext.translate(x, y);
    maskContext.rotate(angle);
    maskContext.fillStyle = 'rgba(255,255,255,.72)';
    maskContext.beginPath();
    maskContext.ellipse(0, 0, radius, radius * 0.64, 0, 0, Math.PI * 2);
    maskContext.fill();

    for (let index = 0; index < 3; index += 1) {
      maskContext.fillStyle = `rgba(255,255,255,${0.28 + Math.random() * 0.24})`;
      maskContext.beginPath();
      maskContext.ellipse(
        (Math.random() - 0.5) * radius * 0.45,
        (Math.random() - 0.5) * radius * 1.12,
        radius * (0.62 + Math.random() * 0.34),
        radius * (0.035 + Math.random() * 0.04),
        (Math.random() - 0.5) * 0.18,
        0,
        Math.PI * 2,
      );
      maskContext.fill();
    }
    maskContext.restore();
  };

  const startAutoFill = () => {
    if (autoFilling || complete) return;
    autoFilling = true;
    drawing = false;
    lastPoint = null;
    restoration.classList.remove('is-hovered');

    const finishImmediately = () => {
      maskContext.save();
      maskContext.globalAlpha = 1;
      maskContext.fillStyle = '#fff';
      maskContext.fillRect(0, 0, mask.width, mask.height);
      maskContext.restore();
      renderPaint();
      finishRestoration();
    };

    if (reducedMotion.matches) {
      finishImmediately();
      return;
    }

    const totalCells = grid.columns * grid.rows;
    const distances = new Int16Array(totalCells);
    distances.fill(-1);
    const queue = new Int32Array(totalCells);
    let queueStart = 0;
    let queueEnd = 0;

    for (let index = 0; index < totalCells; index += 1) {
      if (!paintedCells[index]) continue;
      distances[index] = 0;
      queue[queueEnd] = index;
      queueEnd += 1;
    }

    if (queueEnd === 0) {
      finishImmediately();
      return;
    }

    const neighborOffsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    while (queueStart < queueEnd) {
      const index = queue[queueStart];
      queueStart += 1;
      const column = index % grid.columns;
      const row = Math.floor(index / grid.columns);

      neighborOffsets.forEach(([columnOffset, rowOffset]) => {
        const nextColumn = column + columnOffset;
        const nextRow = row + rowOffset;
        if (nextColumn < 0 || nextColumn >= grid.columns || nextRow < 0 || nextRow >= grid.rows) return;
        const nextIndex = nextRow * grid.columns + nextColumn;
        if (distances[nextIndex] !== -1) return;
        distances[nextIndex] = distances[index] + 1;
        queue[queueEnd] = nextIndex;
        queueEnd += 1;
      });
    }

    const pendingCells = [];
    let maximumDistance = 1;
    for (let index = 0; index < totalCells; index += 1) {
      if (!buildingCells[index] || paintedCells[index]) continue;
      const distance = distances[index];
      maximumDistance = Math.max(maximumDistance, distance);
      pendingCells.push({ index, distance });
    }
    pendingCells.sort((first, second) => first.distance - second.distance);

    const cellWidth = canvas.width / grid.columns;
    const cellHeight = canvas.height / grid.rows;
    const spreadRadius = Math.max(cellWidth, cellHeight) * 1.55;
    const duration = 700;
    let pendingIndex = 0;
    let startTime;

    const animateSpread = (time) => {
      if (startTime === undefined) startTime = time;
      const progress = clamp((time - startTime) / duration, 0, 1);
      const distanceLimit = progress * maximumDistance;

      while (pendingIndex < pendingCells.length && pendingCells[pendingIndex].distance <= distanceLimit) {
        const { index } = pendingCells[pendingIndex];
        const column = index % grid.columns;
        const row = Math.floor(index / grid.columns);
        spreadStamp(
          (column + 0.5) * cellWidth,
          (row + 0.5) * cellHeight,
          spreadRadius * (0.88 + Math.random() * 0.22),
          (Math.random() - 0.5) * 0.34,
        );
        paintedCells[index] = 1;
        pendingIndex += 1;
      }

      renderPaint();
      if (progress < 1 && pendingIndex < pendingCells.length) {
        requestAnimationFrame(animateSpread);
        return;
      }
      finishImmediately();
    };

    requestAnimationFrame(animateSpread);
  };

  const paintTo = (point) => {
    if (!lastPoint) {
      const radius = brushRadius * (0.78 + point.pressure * 0.34);
      stamp(point.x, point.y, radius, 0, 0.72 + point.pressure * 0.2);
      if (!autoFilling) lastPoint = point;
      renderPaint();
      return;
    }

    const deltaX = point.x - lastPoint.x;
    const deltaY = point.y - lastPoint.y;
    const distance = Math.hypot(deltaX, deltaY);
    const elapsed = Math.max(1, point.time - lastPoint.time);
    const speed = distance / elapsed;
    const speedScale = clamp(1.08 - speed * 0.075, 0.68, 1.06);
    const angle = Math.atan2(deltaY, deltaX);
    const steps = Math.max(1, Math.ceil(distance / (brushRadius * 0.12)));

    for (let step = 1; step <= steps; step += 1) {
      const amount = step / steps;
      const pressure = lastPoint.pressure + (point.pressure - lastPoint.pressure) * amount;
      const radius = brushRadius * speedScale * (0.76 + pressure * 0.38);
      stamp(
        lastPoint.x + deltaX * amount,
        lastPoint.y + deltaY * amount,
        radius,
        angle,
        0.62 + pressure * 0.28,
      );
      if (complete || autoFilling) break;
    }
    if (!autoFilling) lastPoint = point;
    renderPaint();
  };

  const pointFromEvent = (event) => {
    const bounds = restoration.getBoundingClientRect();
    const pressure = event.pressure > 0 ? event.pressure : event.pointerType === 'mouse' ? 0.45 : 0.65;
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
      pressure,
      time: event.timeStamp,
    };
  };

  const moveCursor = (event) => {
    const bounds = restoration.getBoundingClientRect();
    cursor.style.left = `${event.clientX - bounds.left}px`;
    cursor.style.top = `${event.clientY - bounds.top}px`;
  };

  const prepareRestoration = () => {
    const source = document.createElement('canvas');
    source.width = canvas.width;
    source.height = canvas.height;
    const sourceContext = source.getContext('2d', { willReadFrequently: true });
    sourceContext.drawImage(restoredImage, 0, 0, canvas.width, canvas.height);
    let pixels;
    try {
      pixels = sourceContext.getImageData(0, 0, canvas.width, canvas.height).data;
    } catch {
      buildingCells.fill(1);
      buildingCellCount = buildingCells.length;
      return;
    }
    const cellWidth = canvas.width / grid.columns;
    const cellHeight = canvas.height / grid.rows;

    for (let row = 0; row < grid.rows; row += 1) {
      for (let column = 0; column < grid.columns; column += 1) {
        const x = Math.min(canvas.width - 1, Math.floor((column + 0.5) * cellWidth));
        const y = Math.min(canvas.height - 1, Math.floor((row + 0.5) * cellHeight));
        const index = row * grid.columns + column;
        if (pixels[(y * canvas.width + x) * 4 + 3] > 24) {
          buildingCells[index] = 1;
          buildingCellCount += 1;
        }
      }
    }
  };

  if (restoredImage.complete) prepareRestoration();
  else restoredImage.addEventListener('load', prepareRestoration, { once: true });

  restoration.addEventListener('pointerenter', (event) => {
    if (!finePointer.matches || complete || autoFilling) return;
    restoration.classList.add('is-hovered');
    moveCursor(event);
  });
  restoration.addEventListener('pointerleave', () => {
    if (!drawing) restoration.classList.remove('is-hovered');
  });
  restoration.addEventListener('pointerdown', (event) => {
    if (complete || autoFilling || (event.pointerType === 'mouse' && event.button !== 0)) return;
    drawing = true;
    lastPoint = null;
    restoration.setPointerCapture(event.pointerId);
    if (finePointer.matches) moveCursor(event);
    paintTo(pointFromEvent(event));
  });
  restoration.addEventListener('pointermove', (event) => {
    if (complete || autoFilling) return;
    if (finePointer.matches) moveCursor(event);
    if (drawing) paintTo(pointFromEvent(event));
  });
  restoration.addEventListener('pointerup', (event) => {
    drawing = false;
    lastPoint = null;
    if (restoration.hasPointerCapture(event.pointerId)) restoration.releasePointerCapture(event.pointerId);
  });
  restoration.addEventListener('pointercancel', () => {
    drawing = false;
    lastPoint = null;
  });
}
