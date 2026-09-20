import { OCR_DEMO_ITEMS } from './data.js';
import { buildQuestions, calculateXp, evaluateAnswer, updateDirectionStats } from './learning.js';
import {
  addVocabItem,
  addVocabList,
  addXpToProfile,
  createInitialState,
  deleteVocabItem,
  deleteVocabList,
  loadState,
  saveState,
  updateVocabItem,
  updateVocabList,
} from './store.js';

const main = document.querySelector('#app-main');
const toast = document.querySelector('#toast');
const networkStatus = document.querySelector('#network-status');
let state = loadState();
let route = 'home';
let practice = null;
let deferredInstallPrompt = null;

const icons = {
  write: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',
  choice: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 11 3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  listen: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4ZM15.5 8.5a5 5 0 0 1 0 7M18 5a9 9 0 0 1 0 14"/></svg>',
  mix: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  back: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  sound: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4ZM15.5 8.5a5 5 0 0 1 0 7M18 5a9 9 0 0 1 0 14"/></svg>',
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function today() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function persist() {
  saveState(localStorage, state);
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 2600);
}

function setRoute(nextRoute) {
  route = nextRoute;
  practice = null;
  render();
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setNavigation() {
  document.querySelectorAll('[data-route]').forEach((button) => {
    const activeRoute = route === 'list-detail' ? 'lists' : route;
    const isActive = button.dataset.route === activeRoute;
    button.classList.toggle('active', isActive);
    if (isActive) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.querySelector('.bottom-nav').hidden = Boolean(practice);
}

function activeList() {
  return state.lists.find((list) => list.id === state.activeListId) ?? state.lists[0] ?? null;
}

function listItems(listId) {
  return state.items.filter((item) => item.listId === listId);
}

function mastery(items) {
  let correct = 0;
  let total = 0;
  for (const item of items) {
    for (const stats of Object.values(item.stats ?? {})) {
      correct += stats.correct ?? 0;
      total += (stats.correct ?? 0) + (stats.wrong ?? 0);
    }
  }
  return total ? Math.round(correct / total * 100) : 0;
}

function rankData() {
  const members = state.classPreview.members.map((member) => member.id === 'self'
    ? { ...member, name: state.profile.name || 'Du', xp: state.profile.weeklyXp }
    : member);
  return members.sort((a, b) => b.xp - a.xp).map((member, index) => ({ ...member, rank: index + 1 }));
}

function pageHeader(title, subtitle, action = '') {
  return `<header class="page-header"><div><p class="eyebrow">Soleil</p><h1 class="page-title">${title}</h1>${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ''}</div>${action}</header>`;
}

function homeView() {
  const list = activeList();
  const items = list ? listItems(list.id) : [];
  const rank = rankData().find((member) => member.id === 'self')?.rank ?? '–';
  const classXp = rankData().reduce((sum, member) => sum + member.xp, 0);
  const goal = state.classPreview.weeklyGoal;
  const dailyProgress = Math.min(100, Math.round(state.profile.dailyXp / state.profile.dailyGoal * 100));

  return `
    <header class="hero">
      <p class="eyebrow">Bonjour, ${escapeHtml(state.profile.name)}</p>
      <h1 class="hero-greeting">On commence?</h1>
      <p class="hero-copy">Heute fehlen dir noch ${Math.max(0, state.profile.dailyGoal - state.profile.dailyXp)} XP bis zum Tagesziel.</p>
      <div class="stats-row">
        <div class="stat-card"><span class="stat-label">Deine Woche</span><span class="stat-value">${state.profile.weeklyXp.toLocaleString('de-DE')} XP</span></div>
        <div class="stat-card"><span class="stat-label">Klassenrang</span><span class="stat-value">Platz ${rank}</span></div>
      </div>
    </header>
    <div class="content">
      <section class="section" aria-labelledby="daily-heading">
        <div class="section-head"><h2 id="daily-heading">Dein Tagesziel</h2><span class="section-note">${state.profile.dailyXp}/${state.profile.dailyGoal} XP</span></div>
        <div class="progress-track" aria-label="Tagesziel zu ${dailyProgress} Prozent erreicht"><div class="progress-fill" style="width:${dailyProgress}%"></div></div>
        <div class="progress-meta"><span>${state.profile.streak} Tage Lernserie</span><span>${dailyProgress}%</span></div>
      </section>
      <section class="section" aria-labelledby="class-goal-heading">
        <div class="section-head"><h2 id="class-goal-heading">Gemeinsames Wochenziel</h2><span class="section-note">Französisch 7b</span></div>
        <div class="progress-track" aria-label="Klassenziel"><div class="progress-fill" style="width:${Math.min(100, classXp / goal * 100)}%"></div></div>
        <div class="progress-meta"><span>${classXp.toLocaleString('de-DE')} von ${goal.toLocaleString('de-DE')} XP</span><span class="preview-badge">Vorschau</span></div>
      </section>
      <section class="section" aria-labelledby="continue-heading">
        <div class="section-head"><h2 id="continue-heading">Heute weitermachen</h2></div>
        ${list ? `<button class="card card-solar card-action list-card" data-action="open-list" data-id="${list.id}">
          <span><span class="card-title">${escapeHtml(list.name)}</span><span class="card-copy">${items.length} Wörter · ${mastery(items)} % sicher</span></span><span class="chevron" aria-hidden="true">›</span>
        </button>` : '<div class="empty">Lege zuerst eine Vokabelliste an.</div>'}
      </section>
      <section class="section" aria-labelledby="mode-heading">
        <div class="section-head"><h2 id="mode-heading">Wie möchtest du lernen?</h2></div>
        <div class="mode-grid">
          ${modeButton('write', 'Schreiben', 'Wörter eintippen')}
          ${modeButton('choice', 'Auswahl', 'Richtige Antwort wählen')}
          ${modeButton('listen', 'Hören', 'Französisch verstehen')}
          ${modeButton('mix', 'Mix', 'Alles im Wechsel')}
        </div>
      </section>
      <section class="section">
        <button class="card card-action list-card" data-route="class"><span><span class="card-title">Diese Woche in deiner Klasse</span><span class="card-copy">Du bist auf Platz ${rank}. Öffne die Rangliste.</span></span><span class="chevron" aria-hidden="true">›</span></button>
      </section>
      <section id="install-section" class="section" hidden>
        <div class="card install-banner"><img src="./icon.svg" alt=""><div><h2 class="card-title">App installieren</h2><p class="card-copy">Soleil direkt vom Startbildschirm öffnen.</p></div><button class="button" data-action="install">Installieren</button></div>
      </section>
    </div>`;
}

function modeButton(mode, name, hint) {
  return `<button class="mode-button" data-action="setup-practice" data-mode="${mode}"><span class="mode-icon">${icons[mode]}</span><span class="mode-name">${name}</span><span class="mode-hint">${hint}</span></button>`;
}

function listsView() {
  const cards = state.lists.map((list) => {
    const items = listItems(list.id);
    return `<button class="card card-action list-card" data-action="open-list" data-id="${list.id}"><span><span class="card-title">${escapeHtml(list.name)}</span><span class="card-copy">${items.length} Wörter · ${mastery(items)} % sicher</span></span><span class="chevron" aria-hidden="true">›</span></button>`;
  }).join('');
  return `${pageHeader('Deine Listen', 'Eigene Themen sammeln und gezielt üben.', '<button class="button" data-route="add">Neue Liste</button>')}<div class="content">${cards || '<div class="empty">Noch keine Listen vorhanden.</div>'}</div>`;
}

function listDetailView() {
  const list = activeList();
  if (!list) return listsView();
  const items = listItems(list.id);
  return `
    ${pageHeader(escapeHtml(list.name), `${items.length} Wörter · ${mastery(items)} % sicher`, `<button class="icon-button" data-route="lists" aria-label="Zurück zu Listen">${icons.back}</button>`)}
    <div class="content">
      <section class="section"><div class="button-row"><button class="button" data-action="setup-practice" data-mode="mix">Lernrunde starten</button><button class="button button-secondary" data-route="add">Wort hinzufügen</button><button class="button button-ghost" data-action="edit-list" data-id="${list.id}">Liste bearbeiten</button></div></section>
      <section class="section card">
        ${items.length ? items.map((item) => `<article class="vocab-row"><div><div class="vocab-french" lang="fr">${escapeHtml(item.french)}</div><div class="vocab-german">${escapeHtml(item.german)}</div>${item.example ? `<div class="vocab-example" lang="fr">${escapeHtml(item.example)}</div>` : ''}</div><div class="vocab-actions"><button class="mini-button" data-action="edit-item" data-id="${item.id}">Ändern</button><button class="mini-button danger" data-action="delete-item" data-id="${item.id}">Löschen</button></div></article>`).join('') : '<div class="empty">Diese Liste ist noch leer.</div>'}
      </section>
      <button class="button button-danger" data-action="delete-list" data-id="${list.id}">Liste löschen</button>
    </div>`;
}

function addView() {
  const options = state.lists.map((list) => `<option value="${list.id}" ${list.id === state.activeListId ? 'selected' : ''}>${escapeHtml(list.name)}</option>`).join('');
  return `${pageHeader('Hinzufügen', 'Neue Liste, einzelnes Wort oder Scanner-Vorschau.')}
    <div class="content">
      <section class="section form-card"><h2>Neue Vokabelliste</h2><form id="list-form"><div class="field"><label for="list-name">Name der Liste</label><input class="input" id="list-name" name="name" required placeholder="Zum Beispiel: Unité 3"></div><div class="field"><label for="list-description">Beschreibung <span class="section-note">optional</span></label><textarea class="textarea" id="list-description" name="description" placeholder="Worum geht es in dieser Liste?"></textarea></div><button class="button button-wide" type="submit">Liste erstellen</button></form></section>
      <section class="section form-card"><h2>Ein Wort hinzufügen</h2>${state.lists.length ? `<form id="vocab-form"><div class="field"><label for="vocab-list">Liste</label><select class="select" id="vocab-list" name="listId">${options}</select></div><div class="field"><label for="french">Französisch</label><input class="input" id="french" name="french" lang="fr" required autocomplete="off" placeholder="la maison"></div><div class="field"><label for="german">Deutsch</label><input class="input" id="german" name="german" required autocomplete="off" placeholder="das Haus"></div><div class="field"><label for="example">Beispielsatz <span class="section-note">optional</span></label><input class="input" id="example" name="example" lang="fr" placeholder="Voici la maison."></div><button class="button button-wide" type="submit">Vokabel speichern</button></form>` : '<div class="notice">Erstelle zuerst eine Vokabelliste.</div>'}</section>
      <section class="section form-card"><div class="section-head"><h2>Vokabelliste scannen</h2><span class="preview-badge">Demo</span></div><div class="scanner-frame"><div><div class="scanner-lines" aria-hidden="true"><span></span><span></span><span></span></div><p>Im Prototyp wird ein erkannter Beispieltext vorbereitet. Du kannst alle Wörter danach bearbeiten.</p><button class="button" data-action="scan-demo">Demo-Scan starten</button></div></div></section>
    </div>`;
}

function classView() {
  const members = rankData();
  const total = members.reduce((sum, member) => sum + member.xp, 0);
  const goal = state.classPreview.weeklyGoal;
  return `${pageHeader('Deine Klasse', 'Gemeinsam lernen und das Wochenziel erreichen.', '<span class="preview-badge">Vorschau</span>')}
    <div class="content">
      <div class="notice section">Der Klassenraum nutzt im Prototyp Beispieldaten. Es werden noch keine Daten mit anderen Geräten ausgetauscht.</div>
      <section class="section card card-solar"><div class="section-head"><h2>Gemeinsames Wochenziel</h2><strong>${Math.round(total / goal * 100)} %</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, total / goal * 100)}%"></div></div><div class="progress-meta"><span>${total.toLocaleString('de-DE')} XP</span><span>${goal.toLocaleString('de-DE')} XP</span></div></section>
      <section class="section card"><div class="section-head"><h2>Wochenrangliste</h2><span class="section-note">endet Sonntag</span></div><ol class="rank-list">${members.map((member) => `<li class="rank-item ${member.id === 'self' ? 'is-user' : ''}"><span class="rank-number">${member.rank}</span><strong>${escapeHtml(member.name)}</strong><span class="rank-xp">${member.xp.toLocaleString('de-DE')} XP</span></li>`).join('')}</ol></section>
      <section class="section card"><div class="section-head"><h2>Einladungscode</h2><span class="preview-badge">Vorschau</span></div><p class="card-copy">Nur Personen mit diesem Code können dem geschlossenen Klassenraum beitreten.</p><div class="code-box">${state.classPreview.inviteCode}</div><button class="button button-secondary button-wide" data-action="copy-code">Code kopieren</button></section>
    </div>`;
}

function profileView() {
  const answered = state.items.reduce((sum, item) => sum + Object.values(item.stats ?? {}).reduce((part, entry) => part + entry.correct + entry.wrong, 0), 0);
  return `${pageHeader('Dein Profil', 'Dein Lernfortschritt auf diesem Gerät.')}
    <div class="content">
      <section class="section form-card"><form id="profile-form"><div class="field"><label for="profile-name">Lernname</label><input class="input" id="profile-name" name="name" maxlength="24" required value="${escapeHtml(state.profile.name)}"></div><div class="field"><label for="daily-goal">Tagesziel</label><select class="select" id="daily-goal" name="dailyGoal">${[50,100,150,200,300].map((value) => `<option value="${value}" ${value === state.profile.dailyGoal ? 'selected' : ''}>${value} XP</option>`).join('')}</select></div><button class="button" type="submit">Profil speichern</button></form></section>
      <section class="section metric-grid"><div class="metric"><strong>${state.profile.totalXp.toLocaleString('de-DE')}</strong><span>XP insgesamt</span></div><div class="metric"><strong>${state.profile.streak}</strong><span>Tage Lernserie</span></div><div class="metric"><strong>${state.lists.length}</strong><span>Vokabellisten</span></div><div class="metric"><strong>${answered}</strong><span>Antworten</span></div></section>
      <section class="section card"><h2 class="card-title">Lokale Daten</h2><p class="card-copy">Alle Vokabeln und Fortschritte liegen nur auf diesem Gerät. Beim Zurücksetzen werden sie unwiderruflich gelöscht.</p><button class="button button-danger" data-action="reset-data">Alle Daten zurücksetzen</button></section>
    </div>`;
}

function practiceSetupView(mode = 'mix') {
  const list = activeList();
  if (!list || !listItems(list.id).length) return `${pageHeader('Lernrunde', 'Du brauchst zuerst mindestens eine Vokabel.')}<div class="content"><div class="empty">Lege Wörter an und versuche es erneut.</div><button class="button button-wide" data-route="add">Wort hinzufügen</button></div>`;
  return `${pageHeader('Lernrunde planen', 'Wähle Abfragerichtung und Umfang.', `<button class="icon-button" data-route="home" aria-label="Zurück">${icons.back}</button>`)}<div class="content"><form id="practice-form" class="form-card"><input type="hidden" name="mode" value="${mode}"><div class="field"><label for="practice-list">Vokabelliste</label><select class="select" id="practice-list" name="listId">${state.lists.map((entry) => `<option value="${entry.id}" ${entry.id === list.id ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('')}</select></div><div class="field"><span class="field-label">Richtung</span><div class="segmented"><label><input type="radio" name="direction" value="fr-de"><span>FR → DE</span></label><label><input type="radio" name="direction" value="de-fr"><span>DE → FR</span></label><label><input type="radio" name="direction" value="mixed" checked><span>Gemischt</span></label></div></div><div class="field"><label for="question-count">Anzahl der Fragen</label><select class="select" id="question-count" name="count"><option value="5">5 Fragen</option><option value="10" selected>10 Fragen</option><option value="20">Bis zu 20 Fragen</option></select></div><button class="button button-wide" type="submit">Lernrunde starten</button></form></div>`;
}

function practiceView() {
  if (practice.complete) return resultsView();
  const question = practice.questions[practice.index];
  const directionLabel = question.direction === 'fr-de' ? 'Übersetze ins Deutsche' : 'Übersetze ins Französische';
  const progress = Math.round(practice.index / practice.questions.length * 100);
  const answerArea = question.mode === 'choice'
    ? `<div class="choice-list">${question.options.map((option) => `<button class="choice-button" data-action="answer-choice" data-value="${escapeHtml(option)}" ${practice.answered ? 'disabled' : ''}>${escapeHtml(option)}</button>`).join('')}</div>`
    : `<form id="answer-form"><div class="field"><label for="answer">Deine Antwort</label><input class="input" id="answer" name="answer" required autocomplete="off" autocapitalize="none" ${practice.answered ? 'disabled' : ''}></div><button class="button button-wide" type="submit" ${practice.answered ? 'disabled' : ''}>Prüfen</button></form>`;
  return `<div class="practice"><div class="practice-top"><button class="icon-button" data-action="quit-practice" aria-label="Lernrunde beenden">${icons.back}</button><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><span class="practice-counter">${practice.index + 1}/${practice.questions.length}</span></div><div class="practice-body"><p class="question-label">${directionLabel}</p><h1 class="question-word" ${question.direction === 'fr-de' ? 'lang="fr"' : ''}>${escapeHtml(question.prompt)}</h1>${question.mode === 'listen' ? `<button class="button button-secondary" data-action="speak" data-text="${escapeHtml(question.direction === 'fr-de' ? question.prompt : question.answer)}">${icons.sound} Französisch anhören</button>` : `<p class="question-hint">${question.mode === 'choice' ? 'Wähle die passende Antwort.' : 'Tippe die passende Übersetzung ein.'}</p>`}<div style="margin-top:24px">${answerArea}</div>${practice.feedback ? feedbackView(question) : ''}</div></div>`;
}

function feedbackView(question) {
  const feedback = practice.feedback;
  return `<div class="feedback ${feedback.correct ? 'correct' : 'incorrect'}"><h3>${feedback.correct ? 'Richtig' : feedback.close ? 'Fast richtig – achte auf die Akzente' : 'Noch nicht ganz'}</h3><p>Die richtige Antwort lautet: <strong>${escapeHtml(question.answer)}</strong>${question.example ? `<br><span lang="fr">${escapeHtml(question.example)}</span>` : ''}</p></div><button class="button button-wide" style="margin-top:14px" data-action="next-question">${practice.index + 1 === practice.questions.length ? 'Ergebnis ansehen' : 'Weiter'}</button>`;
}

function resultsView() {
  const total = practice.questions.length;
  const percent = Math.round(practice.correct / total * 100);
  return `<div class="results"><p class="eyebrow">Runde geschafft</p><h1 class="page-title">Très bien, ${escapeHtml(state.profile.name)}!</h1><div class="results-score"><div><strong>${practice.correct}/${total}</strong><br><span>richtig</span></div></div><div class="metric-grid"><div class="metric"><strong>+${practice.xp}</strong><span>XP verdient</span></div><div class="metric"><strong>${percent} %</strong><span>Trefferquote</span></div></div><p class="page-subtitle">Unsichere Wörter werden in der nächsten Runde früher wiederholt.</p><div class="button-row" style="justify-content:center;margin-top:26px"><button class="button" data-action="repeat-practice">Noch eine Runde</button><button class="button button-secondary" data-route="home">Zur Startseite</button></div></div>`;
}

function render() {
  if (practice) main.innerHTML = practiceView();
  else {
    const views = { home: homeView, lists: listsView, 'list-detail': listDetailView, add: addView, class: classView, profile: profileView };
    main.innerHTML = route === 'practice-setup' ? practiceSetupView(main.dataset.practiceMode ?? 'mix') : (views[route] ?? homeView)();
  }
  setNavigation();
  const installSection = document.querySelector('#install-section');
  if (installSection && deferredInstallPrompt) installSection.hidden = false;
}

function beginPractice(formData) {
  const listId = formData.get('listId');
  const items = listItems(listId);
  const mode = formData.get('mode') || 'mix';
  const direction = formData.get('direction') || 'mixed';
  const questions = buildQuestions(items, direction, mode, Number(formData.get('count') || 10));
  if (!questions.length) return showToast('Diese Liste enthält noch keine Wörter.');
  state.activeListId = listId;
  practice = { questions, index: 0, correct: 0, wrong: 0, xp: 0, answered: false, feedback: null, correctStreak: 0, mode, direction, listId, complete: false };
  persist();
  render();
}

function submitAnswer(value) {
  if (!practice || practice.answered) return;
  const question = practice.questions[practice.index];
  const result = evaluateAnswer(value, question.answer);
  const xp = calculateXp({ correct: result.correct, awarded: false, streak: practice.correctStreak });
  practice.answered = true;
  practice.feedback = result;
  practice.xp += xp;
  practice.correct += result.correct ? 1 : 0;
  practice.wrong += result.correct ? 0 : 1;
  practice.correctStreak = result.correct ? practice.correctStreak + 1 : 0;
  state.items = state.items.map((item) => item.id === question.itemId ? updateDirectionStats(item, question.direction, result.correct) : item);
  state.profile = addXpToProfile(state.profile, xp, today());
  persist();
  render();
}

function nextQuestion() {
  if (practice.index + 1 >= practice.questions.length) {
    practice.complete = true;
    state.sessions = [...state.sessions, { id: `session-${Date.now()}`, listId: practice.listId, mode: practice.mode, direction: practice.direction, correct: practice.correct, wrong: practice.wrong, xp: practice.xp, completedAt: new Date().toISOString() }].slice(-30);
    persist();
  } else {
    practice.index += 1;
    practice.answered = false;
    practice.feedback = null;
  }
  render();
}

function speakFrench(text) {
  if (!('speechSynthesis' in window)) return showToast('Auf diesem Gerät ist keine Sprachausgabe verfügbar.');
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'fr-FR';
  utterance.rate = .86;
  speechSynthesis.speak(utterance);
}

document.addEventListener('click', async (event) => {
  const routeButton = event.target.closest('[data-route]');
  if (routeButton) return setRoute(routeButton.dataset.route);
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;

  if (action === 'open-list') { state.activeListId = id; persist(); return setRoute('list-detail'); }
  if (action === 'setup-practice') { main.dataset.practiceMode = button.dataset.mode; return setRoute('practice-setup'); }
  if (action === 'answer-choice') return submitAnswer(button.dataset.value);
  if (action === 'next-question') return nextQuestion();
  if (action === 'quit-practice') { if (confirm('Möchtest du die Lernrunde wirklich beenden?')) setRoute('home'); return; }
  if (action === 'repeat-practice') {
    const data = new FormData(); data.set('listId', practice.listId); data.set('mode', practice.mode); data.set('direction', practice.direction); data.set('count', String(practice.questions.length)); return beginPractice(data);
  }
  if (action === 'speak') return speakFrench(button.dataset.text);
  if (action === 'delete-item') {
    const item = state.items.find((entry) => entry.id === id);
    if (item && confirm(`„${item.french}“ wirklich löschen?`)) { state = deleteVocabItem(state, id); persist(); render(); showToast('Vokabel gelöscht.'); }
    return;
  }
  if (action === 'edit-item') {
    const item = state.items.find((entry) => entry.id === id); if (!item) return;
    const french = prompt('Französisch:', item.french); if (french === null) return;
    const german = prompt('Deutsch:', item.german); if (german === null) return;
    const example = prompt('Beispielsatz:', item.example) ?? item.example;
    try { state = updateVocabItem(state, id, { french, german, example }); persist(); render(); showToast('Vokabel aktualisiert.'); } catch (error) { showToast(error.message); }
    return;
  }
  if (action === 'edit-list') {
    const list = state.lists.find((entry) => entry.id === id); if (!list) return;
    const name = prompt('Name der Liste:', list.name); if (name === null) return;
    const description = prompt('Beschreibung:', list.description) ?? list.description;
    try { state = updateVocabList(state, id, { name, description }); persist(); render(); showToast('Liste aktualisiert.'); } catch (error) { showToast(error.message); }
    return;
  }
  if (action === 'delete-list') {
    const list = state.lists.find((entry) => entry.id === id);
    if (list && confirm(`Liste „${list.name}“ und alle enthaltenen Wörter löschen?`)) { state = deleteVocabList(state, id); persist(); setRoute('lists'); showToast('Liste gelöscht.'); }
    return;
  }
  if (action === 'scan-demo') {
    try {
      state = addVocabList(state, { name: 'Ma famille – Scan', description: 'Aus der Scanner-Demo übernommen' });
      const listId = state.activeListId;
      OCR_DEMO_ITEMS.forEach((item) => { state = addVocabItem(state, listId, item); });
      persist(); setRoute('list-detail'); showToast('4 erkannte Wörter wurden übernommen.');
    } catch (error) { showToast(error.message); }
    return;
  }
  if (action === 'copy-code') {
    try { await navigator.clipboard.writeText(state.classPreview.inviteCode); showToast('Einladungscode kopiert.'); } catch { showToast(`Code: ${state.classPreview.inviteCode}`); }
    return;
  }
  if (action === 'reset-data') {
    if (confirm('Wirklich alle lokalen Vokabeln und Fortschritte zurücksetzen?')) { state = createInitialState(); persist(); setRoute('home'); showToast('Lokale Daten wurden zurückgesetzt.'); }
    return;
  }
  if (action === 'install' && deferredInstallPrompt) {
    deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; render();
  }
});

document.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  try {
    if (event.target.id === 'list-form') { state = addVocabList(state, Object.fromEntries(data)); persist(); setRoute('list-detail'); showToast('Liste erstellt.'); }
    if (event.target.id === 'vocab-form') { state = addVocabItem(state, data.get('listId'), Object.fromEntries(data)); persist(); event.target.reset(); showToast('Vokabel gespeichert.'); render(); }
    if (event.target.id === 'profile-form') { state.profile = { ...state.profile, name: String(data.get('name')).trim(), dailyGoal: Number(data.get('dailyGoal')) }; persist(); render(); showToast('Profil gespeichert.'); }
    if (event.target.id === 'practice-form') beginPractice(data);
    if (event.target.id === 'answer-form') submitAnswer(data.get('answer'));
  } catch (error) { showToast(error.message); }
});

function updateNetworkStatus() {
  if (navigator.onLine) { networkStatus.hidden = true; }
  else { networkStatus.textContent = 'Offline – deine lokalen Lernfunktionen bleiben verfügbar.'; networkStatus.hidden = false; }
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstallPrompt = event; render(); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => showToast('Offline-Modus konnte nicht aktiviert werden.')));
}

updateNetworkStatus();
render();
