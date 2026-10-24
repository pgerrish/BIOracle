'use strict';

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.getElementById('navigation');
function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});
window.matchMedia('(min-width: 821px)').addEventListener('change', closeMenu);

const notification = document.getElementById('notification');
let notificationTimer;
function notify(message) {
  notification.textContent = message;
  notification.classList.add('visible');
  clearTimeout(notificationTimer);
  notificationTimer = setTimeout(() => notification.classList.remove('visible'), 3500);
}
async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch (_) {
    const text = document.createElement('textarea');
    text.value = value;
    text.setAttribute('readonly', '');
    text.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
    document.body.appendChild(text);
    text.select();
    const copied = document.execCommand('copy');
    text.remove();
    if (!copied) throw new Error('Copy unavailable');
  }
}
document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
  try {
    await copyText(button.dataset.copy);
    notify('Email address copied.');
  } catch (_) {
    notify('Please select and copy the email address above.');
  }
}));

const horizonButtons = [...document.querySelectorAll('[data-horizon]')];
if (horizonButtons.length) {
  const horizons = {
    near: {upper: 141, lower: 205, middle: 172, caption: 'Shorter horizons bring a narrower range of plausible outcomes.'},
    mid: {upper: 98, lower: 226, middle: 155, caption: 'More time allows alternative evolutionary paths to diverge.'},
    long: {upper: 42, lower: 245, middle: 135, caption: 'Longer horizons expose a wider range of possible futures.'}
  };
  function setHorizon(name) {
    const h = horizons[name];
    horizonButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.horizon === name)));
    const upper = `M260 181Q410 ${Math.round((181 + h.upper) / 2)} 600 ${h.upper}`;
    const lower = `M260 181Q410 ${Math.round((181 + h.lower) / 2)} 600 ${h.lower}`;
    document.getElementById('forecast-upper').setAttribute('d', upper);
    document.getElementById('forecast-lower').setAttribute('d', lower);
    document.getElementById('forecast-mid').setAttribute('d', `M260 181Q410 168 600 ${h.middle}`);
    document.getElementById('forecast-fan').setAttribute('d', `${upper}L600 ${h.lower}Q410 ${Math.round((181 + h.lower) / 2)} 260 181Z`);
    document.getElementById('forecast-caption').textContent = h.caption;
  }
  horizonButtons.forEach(button => button.addEventListener('click', () => setHorizon(button.dataset.horizon)));
  setHorizon('near');
}

const researchFilters = [...document.querySelectorAll('[data-research-filter]')];
if (researchFilters.length) {
  const rows = [...document.querySelectorAll('[data-research]')];
  const available = researchFilters.map(button => button.dataset.researchFilter);
  function filterResearch(category, updateUrl) {
    if (!available.includes(category)) category = 'all';
    researchFilters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.researchFilter === category)));
    let count = 0;
    rows.forEach(row => {
      row.hidden = category !== 'all' && row.dataset.category !== category;
      if (!row.hidden) count++;
    });
    document.getElementById('research-count').textContent = `${count} research ${count === 1 ? 'area' : 'areas'}`;
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (category === 'all') url.searchParams.delete('focus');
      else url.searchParams.set('focus', category);
      history.replaceState(null, '', url);
    }
  }
  researchFilters.forEach(button => button.addEventListener('click', () => filterResearch(button.dataset.researchFilter, true)));
  filterResearch(new URLSearchParams(location.search).get('focus') || 'all', false);
}

const publicationSearch = document.getElementById('publication-search');
if (publicationSearch) {
  const year = document.getElementById('publication-year');
  const publications = [...document.querySelectorAll('[data-publication]')];
  const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function filterPublications() {
    const terms = normalize(publicationSearch.value).trim().split(/\s+/).filter(Boolean);
    let count = 0;
    publications.forEach(article => {
      const visible = (year.value === 'all' || article.dataset.year === year.value) && terms.every(term => normalize(article.dataset.search).includes(term));
      article.hidden = !visible;
      if (visible) count++;
    });
    document.getElementById('publication-count').textContent = `${count} ${count === 1 ? 'publication' : 'publications'}`;
    document.getElementById('publication-empty').hidden = count !== 0;
  }
  publicationSearch.addEventListener('input', filterPublications);
  year.addEventListener('change', filterPublications);
  document.getElementById('publication-reset').addEventListener('click', () => {
    publicationSearch.value = '';
    year.value = 'all';
    filterPublications();
    publicationSearch.focus();
  });
}

const form = document.getElementById('inquiry-form');
if (form) {
  const status = document.getElementById('form-status');
  const type = document.getElementById('type');
  const requestedType = new URLSearchParams(location.search).get('type');
  if (requestedType && [...type.options].some(option => option.value === requestedType)) type.value = requestedType;
  function inquiry() {
    const fields = new FormData(form);
    const subject = `BIOracle — ${fields.get('type')}`;
    const body = `Hello BIOracle,\n\n${String(fields.get('message')).trim()}\n\nName: ${String(fields.get('name')).trim()}\nEmail: ${fields.get('email')}\nOrganization: ${String(fields.get('organization')).trim() || 'Not specified'}\nInterest: ${fields.get('type')}\nDesired timeline: ${fields.get('timeline') || 'Not specified'}\n`;
    return {subject, body};
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const {subject, body} = inquiry();
    if (body.length > 7000) {
      status.textContent = 'Your inquiry is long. Use “Copy inquiry” and paste it into an email to pgerrish@unm.edu.';
      return;
    }
    location.href = `mailto:pgerrish@unm.edu?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.textContent = 'Your email draft is ready to open. Review it and send it from your email app. If no draft opens, use “Copy inquiry.”';
  });
  document.getElementById('copy-inquiry').addEventListener('click', async () => {
    if (!form.reportValidity()) return;
    const {subject, body} = inquiry();
    try {
      await copyText(`To: pgerrish@unm.edu\nSubject: ${subject}\n\n${body}`);
      status.textContent = 'Inquiry copied. Paste it into an email to pgerrish@unm.edu and send it when you’re ready.';
      notify('Inquiry copied.');
    } catch (_) {
      status.textContent = 'Copy is unavailable in this browser. You can select your message and email it to pgerrish@unm.edu.';
    }
  });
}
