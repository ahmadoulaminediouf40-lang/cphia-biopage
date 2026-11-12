import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs';
import QRCode from 'https://esm.sh/qrcode@1.5.4';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, API_URL, ADMIN_EMAIL } from './config.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const root = document.getElementById('app');
const appState = { profile: null, slug: null, editToken: null, lang: 'en', previewMode: 'desktop', photoData: null, adminSession: null, publicProfile: null };
const $ = (selector, scope = document) => scope.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text = (value) => String(value ?? '').trim();
const bilingual = (obj) => obj && typeof obj === 'object' ? obj : { en: '', fr: '' };
const current = (obj) => bilingual(obj)[appState.lang] || '';
const adminToken = () => appState.adminSession?.access_token || null;

async function callApi(action, payload = {}, token = null) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_PUBLISHABLE_KEY,
      ...(token ? { 'Authorization': 'Bearer ' + token } : {})
    },
    body: JSON.stringify({ action, ...payload })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'La requête a échoué (' + response.status + ').');
  return result;
}

function setNotice(message, type = 'info') {
  let node = $('#notice');
  if (!node) {
    node = document.createElement('div');
    node.id = 'notice';
    node.className = 'notice';
    document.body.appendChild(node);
  }
  node.textContent = message;
  node.dataset.type = type;
  node.classList.add('visible');
  clearTimeout(setNotice.timer);
  setNotice.timer = setTimeout(() => node.classList.remove('visible'), 4800);
}

function brandBar() {
  return '<header class="topbar"><a class="brand" href="/"><span class="brand-mark">CB</span><span>CPHIA <b>BioPage</b></span></a><nav><a href="/how-it-works">How it works</a><a href="/admin" class="admin-link">Admin</a><button class="lang-toggle" data-action="global-lang">EN / FR</button></nav></header>';
}

function footer() {
  return '<footer class="footer"><span>CPHIA BioPage · Addis Ababa 2026</span><span>Independent networking tool · Not an official CPHIA or Africa CDC service</span></footer>';
}

function renderHome() {
  root.innerHTML = brandBar() +
    '<main class="home-shell">' +
      '<section class="hero-grid"><div class="hero-copy">' +
        '<div class="eyebrow"><span class="eyebrow-dot"></span> CPHIA 2026 · ADDIS ABABA</div>' +
        '<h1>Your work deserves<br><em>a stronger introduction.</em></h1>' +
        '<p class="hero-lede">Turn your CV into a polished executive portfolio, ready for meaningful conversations with researchers, health leaders and partners across Africa.</p>' +
        '<div class="hero-points"><span>EN / FR</span><i></i><span>Editable in minutes</span><i></i><span>Shareable profile</span></div>' +
      '</div><div class="hero-card"><div class="hero-card-top"><span>EXECUTIVE PORTFOLIO GENERATOR</span><span class="live-mark">● LIVE</span></div><div class="mini-profile"><div class="mini-photo">CP</div><div><b>One profile. Two languages.</b><small>Designed for the conversations that matter.</small></div></div><div class="mini-rule"></div><div class="mini-bars"><span></span><span></span><span></span><span></span></div><div class="mini-footer"><span>01 / CV</span><span>02 / PROFILE</span><span>03 / CONNECT</span></div></div></section>' +
      '<section class="generator-card"><div class="section-heading"><div><div class="eyebrow">START HERE · NO ACCOUNT REQUIRED</div><h2>Build your BioPage</h2><p>Upload your CV and portrait. Your original PDF is processed for text extraction and is not stored.</p></div><div class="free-note"><b>FREE</b><small>Generate & preview</small></div></div>' +
      '<form id="cv-form" class="cv-form"><div class="upload-grid"><label class="upload-tile" for="cv-file"><span class="upload-icon">↑</span><b>Upload your CV</b><small>PDF · max. 8 MB</small><span id="cv-file-name" class="file-name">Choose PDF</span><input id="cv-file" type="file" accept="application/pdf,.pdf" required /></label><label class="upload-tile portrait-tile" for="photo-file"><span class="upload-icon">＋</span><b>Add a portrait</b><small>JPG, PNG or WebP · max. 5 MB</small><span id="photo-file-name" class="file-name">Choose photo</span><input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp" required /></label></div>' +
      '<div class="form-grid"><label class="field"><span>WhatsApp number</span><input id="whatsapp" type="tel" placeholder="+221 77 000 00 00" required /></label><label class="field"><span>LinkedIn profile URL</span><input id="linkedin" type="url" placeholder="https://www.linkedin.com/in/..." /></label></div>' +
      '<label class="consent"><input id="consent" type="checkbox" required /><span>I confirm that I have the right to use this CV and photo, and I consent to AI-assisted processing to generate my bilingual portfolio. I understand the original PDF is not retained.</span></label>' +
      '<button class="button button-primary button-large" type="submit" id="generate-button"><span>Generate my portfolio</span><span>→</span></button><p class="form-caption">Usually takes less than a minute. Review and edit everything before publication.</p><div id="generate-status" class="status-line" aria-live="polite"></div></form></section>' +
      '<section class="value-grid"><div><span class="value-number">01</span><b>Executive positioning</b><p>Translate your experience into a clear, leadership-focused story without inventing credentials.</p></div><div><span class="value-number">02</span><b>One profile, EN + FR</b><p>Reach regional and international contacts in the language they prefer.</p></div><div><span class="value-number">03</span><b>Networking-ready</b><p>Share one link, save a contact card and display your QR code after activation.</p></div></section>' +
    '</main>' + footer();
}

async function extractPdf(file) {
  if (!file || file.type !== 'application/pdf' || file.size > 8 * 1024 * 1024) throw new Error('Choisis un fichier PDF de 8 MB maximum.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  if (pdf.numPages > 35) throw new Error('Le CV dépasse 35 pages. Réduis le document avant de réessayer.');
  let extracted = '';
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const data = await page.getTextContent();
    extracted += data.items.map((item) => item.str).join(' ') + '\n';
    if (extracted.length > 60000) break;
  }
  extracted = extracted.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (extracted.length < 120) throw new Error('Le PDF semble être scanné ou ne contient pas assez de texte. Utilise un PDF avec texte sélectionnable.');
  return extracted.slice(0, 60000);
}

async function compressPhoto(file) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Choisis une photo JPG, PNG ou WebP de 5 MB maximum.');
  const image = await createImageBitmap(file);
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  if (!blob) throw new Error('Impossible de traiter cette photo.');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Lecture de la photo impossible.'));
    reader.readAsDataURL(blob);
  });
  return dataUrl;
}

function renderEditorFields() {
  const p = appState.profile;
  const c = p.content || {};
  const lang = appState.lang;
  const field = (label, path, value, multiline = false) => '<label class="field"><span>' + label + '</span>' + (multiline ? '<textarea data-path="' + path + '" rows="3">' + esc(value) + '</textarea>' : '<input data-path="' + path + '" value="' + esc(value) + '" />') + '</label>';
  let html = '<div class="editor-block"><div class="editor-block-title"><span>01</span><b>Executive introduction</b></div>' +
    field('Full name', 'name', c.name || p.full_name || '') +
    field('WhatsApp number', 'whatsapp', p.whatsapp || '') +
    field('LinkedIn profile URL', 'linkedin', p.linkedin_url || '') +
    field('Impact headline · ' + lang.toUpperCase(), 'headline.' + lang, bilingual(c.headline)[lang] || '', true) +
    field('Executive summary · ' + lang.toUpperCase(), 'executive_summary.' + lang, bilingual(c.executive_summary)[lang] || '', true) + '</div>';
  html += '<div class="editor-block"><div class="editor-block-title"><span>02</span><b>Value pillars</b></div>';
  (c.pillars || []).forEach((item, index) => {
    html += '<div class="repeat-card"><small>VALUE PILLAR ' + (index + 1) + '</small>' +
      field('Title · ' + lang.toUpperCase(), 'pillars.' + index + '.title.' + lang, bilingual(item.title)[lang] || '') +
      field('Description · ' + lang.toUpperCase(), 'pillars.' + index + '.description.' + lang, bilingual(item.description)[lang] || '', true) + '</div>';
  });
  html += '</div><div class="editor-block"><div class="editor-block-title"><span>03</span><b>Professional experience</b></div>';
  (c.experiences || []).forEach((item, index) => {
    html += '<div class="repeat-card"><small>EXPERIENCE ' + (index + 1) + '</small>' +
      field('Role / position · ' + lang.toUpperCase(), 'experiences.' + index + '.title.' + lang, bilingual(item.title)[lang] || '') +
      field('Organisation', 'experiences.' + index + '.company', item.company || '') +
      field('Period', 'experiences.' + index + '.period', item.period || '') +
      field('Contribution · ' + lang.toUpperCase(), 'experiences.' + index + '.description.' + lang, bilingual(item.description)[lang] || '', true) + '</div>';
  });
  html += '</div><div class="editor-block"><div class="editor-block-title"><span>04</span><b>Education & credentials</b></div>';
  (c.education || []).forEach((item, index) => {
    html += '<div class="repeat-card"><small>EDUCATION ' + (index + 1) + '</small>' +
      field('Qualification', 'education.' + index + '.qualification', item.qualification || '') +
      field('Institution', 'education.' + index + '.institution', item.institution || '') +
      field('Year', 'education.' + index + '.year', item.year || '') + '</div>';
  });
  (c.certifications || []).forEach((item, index) => {
    html += '<div class="repeat-card"><small>CERTIFICATION ' + (index + 1) + '</small>' +
      field('Certification · ' + lang.toUpperCase(), 'certifications.' + index + '.' + lang, typeof item === 'string' ? item : (item[lang] || item.en || item.fr || '')) + '</div>';
  });
  html += field('Key skills · comma separated', 'skillsText', (c.skills || []).join(', '));
  html += '</div>';
  return html;
}

function setPath(target, path, value) {
  const parts = path.split('.');
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
    if (cursor[key] == null) cursor[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cursor = cursor[key];
  }
  const last = parts[parts.length - 1];
  cursor[/^\d+$/.test(last) ? Number(last) : last] = value;
}

function profilePreview(profile, publicMode = false) {
  const c = profile.content || {};
  const lang = appState.lang;
  const photo = profile.photo_url || profile.photo_path || '';
  const pillars = (c.pillars || []).map((item) => '<article class="preview-pillar"><b>' + esc(bilingual(item.title)[lang]) + '</b><p>' + esc(bilingual(item.description)[lang]) + '</p></article>').join('');
  const experiences = (c.experiences || []).map((item) => '<article class="preview-experience"><div class="preview-meta">' + esc(item.period || '') + '</div><div><b>' + esc(bilingual(item.title)[lang]) + '</b><small>' + esc(item.company || '') + '</small><p>' + esc(bilingual(item.description)[lang]) + '</p></div></article>').join('');
  const education = (c.education || []).map((item) => '<div class="preview-credential"><b>' + esc(item.qualification || '') + '</b><small>' + esc(item.institution || '') + ' · ' + esc(item.year || '') + '</small></div>').join('');
  const skills = (c.skills || []).map((skill) => '<span class="skill-tag">' + esc(skill) + '</span>').join('');
  const certs = (c.certifications || []).map((item) => '<span class="credential-tag">' + esc(typeof item === 'string' ? item : (item[lang] || item.en || item.fr)) + '</span>').join('');
  return '<div class="portfolio-paper">' +
    '<div class="portfolio-kicker">CPHIA BIOPAGE <span>·</span> ADDIS ABABA 2026</div>' +
    '<div class="portfolio-identity"><div class="portfolio-photo">' + (photo ? '<img src="' + esc(photo) + '" alt="Portrait" />' : '<span>' + esc((c.name || profile.full_name || 'P').slice(0, 1)) + '</span>') + '</div><div><div class="profile-eyebrow">EXECUTIVE PROFILE</div><h2>' + esc(c.name || profile.full_name || 'Your name') + '</h2><div class="profile-lang">' + (lang === 'en' ? 'PROFESSIONAL PROFILE' : 'PROFIL PROFESSIONNEL') + '</div></div></div>' +
    '<h1 class="portfolio-headline">' + esc(bilingual(c.headline)[lang] || (lang === 'en' ? 'Your executive headline' : 'Votre titre exécutif')) + '</h1>' +
    '<section class="portfolio-section"><div class="portfolio-section-label">' + (lang === 'en' ? 'PROFILE' : 'PROFIL') + '</div><p class="portfolio-summary">' + esc(bilingual(c.executive_summary)[lang] || '') + '</p></section>' +
    '<section class="portfolio-section"><div class="portfolio-section-label">' + (lang === 'en' ? 'VALUE PILLARS' : 'PILIERS DE VALEUR') + '</div><div class="portfolio-pillars">' + pillars + '</div></section>' +
    '<section class="portfolio-section"><div class="portfolio-section-label">' + (lang === 'en' ? 'EXPERIENCE' : 'EXPÉRIENCE') + '</div>' + experiences + '</section>' +
    '<section class="portfolio-section"><div class="portfolio-section-label">' + (lang === 'en' ? 'EDUCATION' : 'FORMATION') + '</div>' + education + '</section>' +
    (certs ? '<section class="portfolio-section"><div class="portfolio-section-label">' + (lang === 'en' ? 'CERTIFICATIONS' : 'CERTIFICATIONS') + '</div><div class="credential-list">' + certs + '</div></section>' : '') +
    (skills ? '<section class="portfolio-section"><div class="portfolio-section-label">' + (lang === 'en' ? 'CORE SKILLS' : 'COMPÉTENCES CLÉS') + '</div><div class="skill-list">' + skills + '</div></section>' : '') +
    (publicMode ? '<div class="portfolio-bottom">CPHIA BioPage · An independent professional networking profile</div>' : '<div class="portfolio-bottom">PREVIEW · ' + lang.toUpperCase() + '</div>') +
    '</div>';
}

function renderEditor() {
  if (!appState.profile) return renderHome();
  const p = appState.profile;
  root.innerHTML = brandBar() +
    '<main class="editor-shell"><div class="editor-heading"><div><div class="eyebrow">DRAFT WORKSPACE · PRIVATE</div><h1>Shape your <em>story.</em></h1><p>Every field is editable. Switch languages and review the live portfolio before saving or publishing.</p></div><span class="draft-badge">● UNPUBLISHED</span></div>' +
    '<div class="editor-layout"><section class="editor-panel"><div class="editor-toolbar"><div><b>Content editor</b><small>Changes are saved to your private draft</small></div><div class="language-switch"><button data-action="editor-lang" data-lang="en" class="' + (appState.lang === 'en' ? 'active' : '') + '">EN</button><button data-action="editor-lang" data-lang="fr" class="' + (appState.lang === 'fr' ? 'active' : '') + '">FR</button></div></div>' +
    '<div class="editor-photo-control"><div><b>Profile portrait</b><small>Replace the photo shown on your public BioPage. Your new portrait is stored privately.</small></div><label class="upload-tile editor-photo-tile" for="photo-file"><span class="upload-icon">↑</span><b>Replace portrait</b><small>JPG, PNG or WebP · max. 5 MB</small><span id="photo-file-name" class="file-name">Choose a new photo</span><input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp" /></label></div>' +
    '<div class="editor-fields">' + renderEditorFields() + '</div><div class="editor-actions"><button class="button button-outline" data-action="save-draft">Save draft</button><button class="button button-primary" data-action="publish-open">Publish portfolio →</button></div><div class="edit-link-box"><b>Your private edit link</b><small>Keep this link to return to your draft. Anyone with the link can edit it.</small><button class="button button-quiet" data-action="copy-edit-link">Copy secure edit link</button></div></section>' +
    '<section class="preview-panel ' + (appState.previewMode === 'mobile' ? 'mobile-preview' : '') + '"><div class="preview-toolbar"><b>Live preview</b><div><button data-action="preview-device" data-mode="desktop" class="' + (appState.previewMode === 'desktop' ? 'active' : '') + '">Desktop</button><button data-action="preview-device" data-mode="mobile" class="' + (appState.previewMode === 'mobile' ? 'active' : '') + '">Mobile</button></div></div><div id="preview-frame" class="preview-frame">' + profilePreview(p) + '</div></section></div></main>' + footer();
}

function renderPublic(profile) {
  const c = profile.content || {};
  const lang = appState.lang;
  const whatsapp = text(profile.whatsapp).replace(/[^\d+]/g, '').replace(/^00/, '+');
  const linkedin = text(profile.linkedin_url);
  root.innerHTML = brandBar() +
    '<main class="public-shell"><div class="public-toolbar"><span class="activation-badge">✓ ' + (lang === 'en' ? 'BioPage activated' : 'BioPage activée') + '</span><div class="language-switch"><button data-action="public-lang" data-lang="en" class="' + (lang === 'en' ? 'active' : '') + '">EN</button><button data-action="public-lang" data-lang="fr" class="' + (lang === 'fr' ? 'active' : '') + '">FR</button></div></div>' +
    '<div class="public-card">' + profilePreview(profile, true) + '</div>' +
    '<div class="network-actions"><a class="button button-contact" href="data:text/plain," id="vcf-link" download="contact.vcf">' + (lang === 'en' ? '↓ Save contact (.vcf)' : '↓ Enregistrer le contact (.vcf)') + '</a>' +
    (whatsapp ? '<a class="button button-outline" target="_blank" rel="noopener" href="https://wa.me/' + esc(whatsapp.replace(/\D/g, '')) + '">WhatsApp ↗</a>' : '') +
    (linkedin ? '<a class="button button-outline" target="_blank" rel="noopener" href="' + esc(linkedin) + '">LinkedIn ↗</a>' : '') +
    '<button class="button button-outline" data-action="show-qr">▦ ' + (lang === 'en' ? 'Show my QR code' : 'Afficher mon QR code') + '</button></div>' +
    '<p class="public-disclaimer">BioPage activation confirms platform publication only. It does not verify CPHIA delegate status or imply endorsement by CPHIA or Africa CDC.</p></main>' + footer();
  const vcf = [
    'BEGIN:VCARD','VERSION:3.0',
    'FN:' + (c.name || profile.full_name || ''),
    'TEL;TYPE=CELL:' + (profile.whatsapp || ''),
    linkedin ? 'URL:' + linkedin : '',
    'NOTE:CPHIA BioPage professional profile',
    'END:VCARD'
  ].filter(Boolean).join('\r\n');
  $('#vcf-link').href = URL.createObjectURL(new Blob([vcf], { type: 'text/vcard;charset=utf-8' }));
}

async function renderPublicRoute(slug) {
  root.innerHTML = brandBar() + '<main class="loading-shell"><div class="spinner"></div><p>Loading professional profile…</p></main>' + footer();
  try {
    const result = await callApi('public-get', { slug });
    appState.publicProfile = result.profile;
    renderPublic(result.profile);
  } catch (error) {
    root.innerHTML = brandBar() + '<main class="loading-shell"><h2>Portfolio unavailable</h2><p>' + esc(error.message) + '</p><a class="button button-primary" href="#/">Back to BioPage</a></main>' + footer();
  }
}

function openModal(title, body) {
  const layer = document.createElement('div');
  layer.className = 'modal-layer';
  layer.innerHTML = '<div class="modal-card"><button class="modal-close" data-action="close-modal">×</button><div class="eyebrow">CPHIA BIOPAGE</div><h2>' + title + '</h2>' + body + '</div>';
  document.body.appendChild(layer);
}
function closeModal() { $('.modal-layer')?.remove(); }

function renderPublishModal() {
  openModal('Ready to publish?', '<p>Your preview is free. Publication, public link and networking QR code are unlocked with a one-time activation.</p><div class="price-card"><div><b>USD 15</b><small>or 10,000 FCFA</small></div><span>One-time activation</span></div><label class="field"><span>Activation code</span><input id="activation-code" placeholder="Enter your code" autocomplete="off" /></label><button class="button button-primary button-full" data-action="activate-publish">Activate and publish →</button><a class="whatsapp-payment" target="_blank" rel="noopener" href="https://wa.me/221771018290?text=' + encodeURIComponent('Bonjour, je souhaite activer mon CPHIA BioPage pour 10 000 FCFA.') + '">Request activation via WhatsApp ↗</a><p class="small-note">The badge confirms BioPage payment activation only. It is not an official CPHIA delegate verification.</p>');
}

async function showQr() {
  const url = location.origin + '/p/' + encodeURIComponent(appState.publicProfile.slug);
  const data = await QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: '#10243a', light: '#ffffff' } });
  openModal(appState.lang === 'en' ? 'Scan to connect' : 'Scanner pour se connecter', '<div class="qr-wrap"><img src="' + data + '" alt="Portfolio QR code" /></div><p class="qr-url">' + esc(url) + '</p><button class="button button-primary button-full" data-action="download-qr">Download QR code</button>');
  appState.qrData = data;
}

function pathFromHash() {
  const path = location.pathname.split('/').filter(Boolean).join('/');
  if (path) return path.split('/').filter(Boolean);
  const raw = location.hash.startsWith('#/') ? location.hash.slice(2) : location.hash.replace('#', '');
  return raw.split('/').filter(Boolean);
}

async function renderAdmin() {
  const { data } = await supabase.auth.getSession();
  appState.adminSession = data.session;
  if (!data.session) {
    root.innerHTML = brandBar() + '<main class="admin-auth-shell"><section class="admin-auth-card"><div class="eyebrow">RESTRICTED AREA</div><h1>Admin <em>workspace.</em></h1><p>Sign in with the authorised owner email to manage BioPage activation and portfolios.</p><form id="admin-login" class="admin-login"><label class="field"><span>Owner email</span><input id="admin-email" type="email" value="' + esc(ADMIN_EMAIL) + '" required /></label><button class="button button-primary button-full" type="submit">Send secure sign-in link →</button><div id="admin-status" class="status-line"></div></form></section></main>' + footer();
    return;
  }
  const session = data.session;
  if ((session.user.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    await supabase.auth.signOut();
    setNotice('Cette adresse n’est pas autorisée pour l’administration.', 'error');
    return renderAdmin();
  }
  root.innerHTML = brandBar() + '<main class="admin-shell"><div class="admin-heading"><div><div class="eyebrow">OWNER CONSOLE</div><h1>Platform <em>overview.</em></h1><p>Signed in as ' + esc(session.user.email) + '</p></div><button class="button button-outline" data-action="admin-logout">Sign out</button></div><div id="admin-content"><div class="spinner"></div></div></main>' + footer();
  try {
    const result = await callApi('admin-list', {}, session.access_token);
    const profiles = result.profiles || [];
    const codes = result.codes || [];
    $('#admin-content').innerHTML = '<div class="admin-stats"><div><small>PORTFOLIOS</small><b>' + profiles.length + '</b></div><div><small>PUBLISHED</small><b>' + profiles.filter(p => p.is_published).length + '</b></div><div><small>AVAILABLE CODES</small><b>' + codes.filter(c => !c.used_at).length + '</b></div><div><small>OPENAI API</small><b class="' + (result.openai_configured ? 'green-text' : 'amber-text') + '">' + (result.openai_configured ? 'Connected' : 'Needs key') + '</b></div></div>' +
      '<div class="admin-grid"><section class="admin-card"><div class="admin-card-heading"><div><div class="eyebrow">ACTIVATION</div><h2>Issue a code</h2></div><span class="code-icon">#</span></div><p>Generate a one-time code after confirming a payment. The code is shown once.</p><button class="button button-primary" data-action="admin-create-code">Generate activation code +</button><div id="new-code" class="new-code"></div><hr><b>Recent codes</b><div class="admin-code-list">' + codes.slice(0, 8).map(c => '<div><code>' + esc(c.code_prefix) + '••••</code><span class="' + (c.used_at ? 'status-used' : 'status-ready') + '">' + (c.used_at ? 'Used' : 'Available') + '</span></div>').join('') + '</div></section>' +
      '<section class="admin-card"><div class="eyebrow">CONFIGURATION</div><h2>OpenAI connection</h2><p>Model: <b>gpt-4o-mini</b>. The API key is stored as a Supabase Edge Function secret. It is never displayed in this dashboard or sent to the browser.</p><div class="key-status ' + (result.openai_configured ? 'ready' : 'missing') + '">' + (result.openai_configured ? '● API key detected on server' : '● OPENAI_API_KEY is not configured') + '</div><a class="text-link" target="_blank" rel="noopener" href="https://supabase.com/dashboard/project/vxdddtchpksfcfymirou/functions/secrets">Manage secret in Supabase →</a></section></div>' +
      '<section class="admin-card portfolio-admin"><div class="admin-card-heading"><div><div class="eyebrow">RECORDS</div><h2>Portfolios</h2></div><span class="muted-meta">' + profiles.length + ' records</span></div><div class="table-wrap"><table><thead><tr><th>Profile</th><th>Created</th><th>Status</th><th>Link</th></tr></thead><tbody>' + profiles.map(p => '<tr><td><b>' + esc(p.full_name) + '</b><small>/' + esc(p.slug) + '</small></td><td>' + new Date(p.created_at).toLocaleDateString() + '</td><td><span class="table-status ' + (p.is_published ? 'published' : 'draft') + '">' + (p.is_published ? 'Published' : 'Draft') + '</span></td><td>' + (p.is_published ? '<a href="#/p/' + encodeURIComponent(p.slug) + '">Open ↗</a>' : '—') + '</td></tr>').join('') + '</tbody></table></div></section>';
  } catch (error) {
    $('#admin-content').innerHTML = '<p class="error-text">' + esc(error.message) + '</p>';
  }
}

async function route() {
  const parts = pathFromHash();
  if (!parts.length) return renderHome();
  if (parts[0] === 'edit' && parts[1] && parts[2]) {
    appState.slug = decodeURIComponent(parts[1]);
    appState.editToken = decodeURIComponent(parts[2]);
    root.innerHTML = brandBar() + '<main class="loading-shell"><div class="spinner"></div><p>Opening your private draft…</p></main>' + footer();
    try {
      const result = await callApi('load-draft', { slug: appState.slug, editToken: appState.editToken });
      appState.profile = result.profile;
      appState.photoData = null;
      renderEditor();
    } catch (error) {
      root.innerHTML = brandBar() + '<main class="loading-shell"><h2>Private link unavailable</h2><p>' + esc(error.message) + '</p><a class="button button-primary" href="#/">Start again</a></main>' + footer();
    }
    return;
  }
  if (parts[0] === 'p' && parts[1]) return renderPublicRoute(decodeURIComponent(parts[1]));
  if (parts[0] === 'admin') return renderAdmin();
  if (parts[0] === 'how-it-works') {
    root.innerHTML = brandBar() + '<main class="how-shell"><div class="eyebrow">HOW IT WORKS</div><h1>From CV to <em>connection.</em></h1><div class="how-steps"><article><b>01 · Upload</b><p>Choose a text-based PDF CV and a professional portrait. Your original PDF is not saved.</p></article><article><b>02 · Refine</b><p>AI prepares English and French content. Review every statement, correct dates and edit your profile before publication.</p></article><article><b>03 · Publish</b><p>Use an activation code after payment to publish your page and unlock its contact card and networking QR.</p></article></div><a href="#/" class="button button-primary">Create your BioPage →</a></main>' + footer();
    return;
  }
  renderHome();
}

root.addEventListener('submit', async (event) => {
  if (event.target.id === 'cv-form') {
    event.preventDefault();
    const pdf = $('#cv-file').files[0];
    const photo = $('#photo-file').files[0];
    const status = $('#generate-status');
    const button = $('#generate-button');
    try {
      if (!$('#consent').checked) throw new Error('Confirme ton consentement pour continuer.');
      button.disabled = true;
      button.innerHTML = '<span>Reading your CV…</span><span class="spinner small-spinner"></span>';
      status.textContent = 'Extraction du texte du CV dans votre navigateur…';
      const resumeText = await extractPdf(pdf);
      status.textContent = 'Optimisation du portrait…';
      const photoData = await compressPhoto(photo);
      status.textContent = 'Creating your bilingual executive profile…';
      button.innerHTML = '<span>Creating your profile…</span><span class="spinner small-spinner"></span>';
      const result = await callApi('generate', {
        resumeText,
        photoData,
        whatsapp: text($('#whatsapp').value),
        linkedin: text($('#linkedin').value)
      });
      appState.profile = result.profile;
      appState.slug = result.slug;
      appState.editToken = result.editToken;
      appState.photoData = null;
      history.pushState({}, '', '/edit/' + encodeURIComponent(result.slug) + '/' + encodeURIComponent(result.editToken));
      renderEditor();
      setNotice('Portfolio généré. Vérifie et modifie chaque information avant publication.', 'success');
    } catch (error) {
      status.textContent = error.message;
      setNotice(error.message, 'error');
      button.disabled = false;
      button.innerHTML = '<span>Generate my portfolio</span><span>→</span>';
    }
  }
  if (event.target.id === 'admin-login') {
    event.preventDefault();
    const status = $('#admin-status');
    const email = text($('#admin-email').value).toLowerCase();
    if (email !== ADMIN_EMAIL.toLowerCase()) { status.textContent = 'Email non autorisé.'; return; }
    status.textContent = 'Sending secure sign-in link…';
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + '/admin' } });
    status.textContent = error ? error.message : 'Lien envoyé. Ouvre ta boîte email pour te connecter.';
  }
});

root.addEventListener('input', (event) => {
  const path = event.target.dataset.path;
  if (!path || !appState.profile) return;
  if (path === 'skillsText') {
    appState.profile.content.skills = event.target.value.split(',').map((v) => v.trim()).filter(Boolean);
  } else if (path === 'name') {
    appState.profile.content.name = event.target.value;
    appState.profile.full_name = event.target.value;
  } else if (path === 'whatsapp') {
    appState.profile.whatsapp = event.target.value;
  } else if (path === 'linkedin') {
    appState.profile.linkedin_url = event.target.value;
  } else {
    setPath(appState.profile.content, path, event.target.value);
  }
  const frame = $('#preview-frame');
  if (frame) frame.innerHTML = profilePreview(appState.profile);
});

root.addEventListener('change', async (event) => {
  if (event.target.id === 'cv-file') $('#cv-file-name').textContent = event.target.files[0]?.name || 'Choose PDF';
  if (event.target.id === 'photo-file') {
    const photoName = $('#photo-file-name');
    if (photoName) photoName.textContent = event.target.files[0]?.name || (appState.profile ? 'Choose a new photo' : 'Choose photo');
    if (appState.profile && event.target.files[0]) {
      try {
        appState.photoData = await compressPhoto(event.target.files[0]);
        appState.profile.photo_url = appState.photoData;
        const frame = $('#preview-frame');
        if (frame) frame.innerHTML = profilePreview(appState.profile);
      } catch (error) { setNotice(error.message, 'error'); }
    }
  }
});

root.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  try {
    if (action === 'global-lang') {
      appState.lang = appState.lang === 'en' ? 'fr' : 'en';
      if (appState.profile) renderEditor(); else if (appState.publicProfile) renderPublic(appState.publicProfile);
      return;
    }
    if (action === 'editor-lang') {
      appState.lang = btn.dataset.lang;
      renderEditor();
      return;
    }
    if (action === 'public-lang') {
      appState.lang = btn.dataset.lang;
      renderPublic(appState.publicProfile);
      return;
    }
    if (action === 'preview-device') {
      appState.previewMode = btn.dataset.mode;
      renderEditor();
      return;
    }
    if (action === 'save-draft') {
      btn.disabled = true; btn.textContent = 'Saving…';
      const result = await callApi('update-draft', { slug: appState.slug, editToken: appState.editToken, content: appState.profile.content, whatsapp: appState.profile.whatsapp, linkedin: appState.profile.linkedin_url, photoData: appState.photoData });
      if (result.photo_url) appState.profile.photo_url = result.photo_url;
      appState.photoData = null;
      setNotice('Brouillon enregistré.', 'success');
      renderEditor();
      return;
    }
    if (action === 'copy-edit-link') {
      const link = location.origin + '/edit/' + encodeURIComponent(appState.slug) + '/' + encodeURIComponent(appState.editToken);
      await navigator.clipboard.writeText(link);
      setNotice('Lien privé copié. Garde-le confidentiel.', 'success');
      return;
    }
    if (action === 'publish-open') return renderPublishModal();
    if (action === 'close-modal') return closeModal();
    if (action === 'activate-publish') {
      const code = text($('#activation-code')?.value).toUpperCase().replace(/\s+/g, '');
      if (!code) { setNotice('Saisis ton code d’activation.', 'error'); return; }
      btn.disabled = true; btn.textContent = 'Activation en cours…';
      const result = await callApi('publish', { slug: appState.slug, editToken: appState.editToken, activationCode: code });
      closeModal();
      setNotice('Portfolio publié avec succès.', 'success');
      history.pushState({}, '', '/p/' + encodeURIComponent(result.slug));
      await renderPublicRoute(result.slug);
      return;
    }
    if (action === 'show-qr') return showQr();
    if (action === 'download-qr') {
      const a = document.createElement('a'); a.href = appState.qrData; a.download = 'cphia-biopage-qr.png'; a.click(); return;
    }
    if (action === 'admin-logout') { await supabase.auth.signOut(); appState.adminSession = null; location.hash = '#/admin'; return; }
    if (action === 'admin-create-code') {
      btn.disabled = true; btn.textContent = 'Generating…';
      const result = await callApi('admin-create-code', {}, adminToken());
      $('#new-code').innerHTML = '<div class="issued-code"><b>' + esc(result.code) + '</b><button class="button button-quiet" data-action="copy-activation-code">Copy</button></div><small>This code is displayed once. Save it securely.</small>';
      btn.disabled = false; btn.textContent = 'Generate another code +';
      return;
    }
    if (action === 'copy-activation-code') {
      const code = $('.issued-code b')?.textContent || '';
      await navigator.clipboard.writeText(code);
      setNotice('Code copié.', 'success');
      return;
    }
  } catch (error) {
    setNotice(error.message, 'error');
    if (btn) { btn.disabled = false; }
  }
});

supabase.auth.onAuthStateChange((_event, session) => {
  appState.adminSession = session;
  if (pathFromHash()[0] === 'admin') setTimeout(renderAdmin, 0);
});
window.addEventListener('hashchange', route);
window.addEventListener('popstate', route);
route();
