document.documentElement.classList.add('motion-ready');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

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
  { element: document.querySelector('.gallery-grid'), items: 'figure, .gallery-note' },
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
  }, { threshold: 0.12, rootMargin: '0px 0px -12% 0px' });

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

const filterButtons = document.querySelectorAll('.filters button');
const cards = document.querySelectorAll('.event-card');

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
    card.hidden = filter !== 'all' && card.dataset.category !== filter;
  });
  [...cards].filter((card) => !card.hidden).forEach((card, index) => {
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
}));

document.querySelectorAll('.event-more').forEach((button) => button.addEventListener('click', () => {
  const details = document.getElementById(button.getAttribute('aria-controls'));
  const open = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!open));
  details.hidden = open;
  button.querySelector('span').textContent = open ? '↓' : '↑';
}));

const contactForm = document.querySelector('#contact-form');

contactForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(contactForm);
  const status = contactForm.querySelector('.form-status');
  const requestText = [
    'Заявка в арт-резиденцию «Михайловское»',
    `Имя: ${data.get('name')}`,
    `Email: ${data.get('email')}`,
    `Формат участия: ${data.get('role')}`,
    '',
    String(data.get('message')),
  ].join('\n');
  const teamEmail = document.body.dataset.contactEmail?.trim();

  if (teamEmail) {
    const subject = encodeURIComponent('Заявка в арт-резиденцию «Михайловское»');
    const body = encodeURIComponent(requestText);
    window.location.href = `mailto:${teamEmail}?subject=${subject}&body=${body}`;
    status.textContent = 'Письмо подготовлено в вашем почтовом приложении.';
    return;
  }

  try {
    await navigator.clipboard.writeText(requestText);
    status.textContent = 'Текст заявки скопирован. Сохраните его до публикации контакта команды.';
  } catch {
    status.textContent = 'Не удалось открыть буфер обмена. Скопируйте данные из заполненной формы вручную.';
  }
});

const restoration = document.querySelector('[data-restoration]');

if (restoration) {
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
  const brushRadius = canvas.width * 0.045;
  let buildingCellCount = 0;
  let paintedCellCount = 0;
  let drawing = false;
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
    if (ratio >= 0.5) finishRestoration();
  };

  const stamp = (x, y) => {
    maskContext.fillStyle = '#fff';
    maskContext.beginPath();
    maskContext.arc(x, y, brushRadius, 0, Math.PI * 2);
    maskContext.fill();
    updateCoverage(x, y, brushRadius);
  };

  const paintTo = (point) => {
    if (!lastPoint) {
      stamp(point.x, point.y);
      lastPoint = point;
      renderPaint();
      return;
    }

    const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
    const steps = Math.max(1, Math.ceil(distance / (brushRadius * 0.35)));
    for (let step = 1; step <= steps; step += 1) {
      const amount = step / steps;
      stamp(
        lastPoint.x + (point.x - lastPoint.x) * amount,
        lastPoint.y + (point.y - lastPoint.y) * amount,
      );
      if (complete) break;
    }
    lastPoint = point;
    renderPaint();
  };

  const pointFromEvent = (event) => {
    const bounds = restoration.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
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
    const pixels = sourceContext.getImageData(0, 0, canvas.width, canvas.height).data;
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
    if (!finePointer.matches || complete) return;
    restoration.classList.add('is-hovered');
    moveCursor(event);
  });
  restoration.addEventListener('pointerleave', () => {
    if (!drawing) restoration.classList.remove('is-hovered');
  });
  restoration.addEventListener('pointerdown', (event) => {
    if (!finePointer.matches || complete || event.button !== 0) return;
    drawing = true;
    lastPoint = null;
    restoration.setPointerCapture(event.pointerId);
    moveCursor(event);
    paintTo(pointFromEvent(event));
  });
  restoration.addEventListener('pointermove', (event) => {
    if (!finePointer.matches || complete) return;
    moveCursor(event);
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
