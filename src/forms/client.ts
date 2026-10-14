import { Model, renderSurvey } from 'survey-js-ui';
import { CustomError, getLocaleStrings } from 'survey-core';
import DefaultDark from 'survey-core/themes/default-dark';
import DefaultLight from 'survey-core/themes/default-light';
import 'survey-core/i18n/simplified-chinese';
import 'survey-core/i18n/traditional-chinese';
import 'survey-core/survey-core.css';
import { copy, schema, validateAnswers, version } from './frc';
import type { Answers } from './frc';
import type { Locale } from '../i18n/locales';

const root = document.querySelector<HTMLElement>('[data-application]');
// Reviewed Taiwan UI wording replaces the library's machine-translated defaults used by this form.
Object.assign(getLocaleStrings('zh-tw'), {
  completeText: '確認送出', previewText: '核對答案', editText: '返回修改',
  progressText: '第 {0} 頁，共 {1} 頁', questionsProgressText: '已回答 {0} / {1} 題',
  requiredError: '請填寫此題。', numericError: '請輸入數字。', textMinLength: '請至少輸入 {0} 個字元。',
  textMaxLength: '請勿超過 {0} 個字元。', invalidEmail: '請輸入有效的電子郵件地址。',
  numericMin: '請輸入大於或等於 {0} 的數值。', numericMax: '請輸入小於或等於 {0} 的數值。',
});
if (root) void mount(root);

async function mount(root: HTMLElement) {
  const locale = root.dataset.locale as Locale;
  const text = copy[locale];
  const message = root.querySelector<HTMLElement>('[data-application-message]')!;
  const container = root.querySelector<HTMLElement>('[data-application-survey]')!;
  const retryButton = root.querySelector<HTMLButtonElement>('[data-application-retry]')!;
  const statusButton = root.querySelector<HTMLButtonElement>('[data-application-status]')!;
  const clearButton = root.querySelector<HTMLButtonElement>('[data-application-clear]')!;
  const backButton = root.querySelector<HTMLButtonElement>('[data-application-back]')!;
  const receiptElement = root.querySelector<HTMLElement>('[data-application-receipt]')!;
  const key = 'nice-frc-2027-draft';
  const receiptKey = 'nice-frc-2027-receipt';
  let savedReceipt: { id: string; receipt: string; state: string } | undefined;
  let frozen: { id: string; version: string; locale: Locale; answers: Answers } | undefined;
  let storage = true;
  let busy = false;
  let preview = false;
  let restoring = true;
  const model = new Model(schema(locale));
  model.previewText = text.review;
  model.completeText = text.submit;
  model.requiredText = '*';
  const theme = () => {
    const preset = document.documentElement.dataset.theme === 'dark' ? DefaultDark : DefaultLight;
    model.applyTheme({ ...preset, isPanelless: true, cssVariables: { ...preset.cssVariables, '--sjs-primary-backcolor': '#d94700', '--sjs-primary-forecolor': '#ffffff', '--sjs-font-family': 'inherit', '--sjs-corner-radius': '6px', '--sjs2-color-project-brand-600': '#d94700', '--sjs2-color-project-brand-700': '#b53b00' } });
  };
  theme();
  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  function announce(value: string) { message.textContent = value; message.hidden = !value; }
  function writeSession(name: string, value: unknown) {
    try { sessionStorage.setItem(name, JSON.stringify(value)); } catch { storage = false; }
  }
  function save() {
    if (restoring || savedReceipt) return;
    writeSession(key, { version, answers: model.data, page: model.currentPageNo, frozen, savedAt: Date.now() });
  }
  function showReceipt() {
    if (!savedReceipt) return;
    container.hidden = true; retryButton.hidden = true; clearButton.hidden = true; backButton.hidden = true;
    announce(savedReceipt.state === 'synced' ? text.synced : text.pending);
    receiptElement.hidden = false;
    receiptElement.textContent = `${text.receipt}: ${savedReceipt.id}`;
    statusButton.hidden = savedReceipt.state === 'synced';
  }
  async function checkStatus() {
    if (!savedReceipt || busy) return;
    busy = true; statusButton.disabled = true; announce(text.checking);
    try {
      const res = await fetch(`/api/application-status?id=${encodeURIComponent(savedReceipt.id)}`, { headers: { Authorization: `Bearer ${savedReceipt.receipt}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error('status');
      const data = await res.json(); savedReceipt.state = data.state;
      writeSession(receiptKey, savedReceipt); showReceipt();
    } catch { announce(text.statusError); } finally { busy = false; statusButton.disabled = false; }
  }
  function setErrors(errors: Record<string, string>) {
    for (const [id, code] of Object.entries(errors)) {
      const q = model.getQuestionByName(id);
      if (q) q.addError(new CustomError(text[code as keyof typeof text] ?? text.invalid));
    }
    const first = Object.keys(errors).find((id) => model.getQuestionByName(id));
    if (first) { const q = model.getQuestionByName(first); model.currentPage = q.page; q.focus(); }
  }
  async function send() {
    if (busy || !frozen) return;
    busy = true; retryButton.disabled = true; clearButton.hidden = true;
    model.mode = 'display'; announce(text.submitting); save();
    try {
      const res = await fetch('/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(frozen), signal: AbortSignal.timeout(45000) });
      const data = await res.json();
      if (res.ok && data.id && data.receipt) {
        savedReceipt = { id: data.id, receipt: data.receipt, state: data.state };
        writeSession(receiptKey, savedReceipt);
        try { sessionStorage.removeItem(key); } catch { /* Receipt remains on screen. */ }
        showReceipt();
      } else if ([400, 403, 413, 422].includes(res.status)) {
        // These responses are definitive rejections before the durable insert.
        frozen = undefined; model.mode = 'edit'; clearButton.hidden = false; retryButton.hidden = true;
        announce(text[data.code as keyof typeof text] ?? text.invalid);
        if (data.errors) setErrors(data.errors);
        save();
      } else { throw new Error('unknown-result'); }
    } catch { announce(text.failed); retryButton.hidden = false; }
    finally { busy = false; retryButton.disabled = false; }
  }
  model.onCompleting.add((_, options) => {
    options.allow = false;
    if (preview) { announce(text.preview); message.focus(); return; }
    if (frozen) { void send(); return; }
    const checked = validateAnswers(model.data);
    if (Object.keys(checked.errors).length) { announce(text.invalid); setErrors(checked.errors); return; }
    frozen = { id: crypto.randomUUID(), version, locale, answers: checked.answers }; save(); void send();
  });
  model.onValidateQuestion.add((_, options) => {
    if (['q36', 'q37', 'q38'].includes(options.name)) {
      const expected = options.name === 'q37' ? 6 : 4;
      if (!Array.isArray(options.value) || new Set(options.value).size !== expected) options.error = text.consent;
    }
  });
  model.onValueChanged.add(() => {
    if (restoring) return;
    save();
  });
  model.onCurrentPageChanged.add(save);
  backButton.addEventListener('click', () => {
    if (model.getValue('q1') === '其他') model.clearValue('q1');
    if (model.getValue('q4') === '否') model.clearValue('q4');
    container.hidden = false; backButton.hidden = true; clearButton.hidden = false; model.currentPageNo = 0; announce(''); save();
  });
  clearButton.addEventListener('click', () => { if (!busy && !frozen && confirm(text.confirmClear)) { model.clear(); model.currentPageNo = 0; save(); announce(''); } });
  retryButton.addEventListener('click', () => void send());
  statusButton.addEventListener('click', () => void checkStatus());

  try {
    const receiptDraft = JSON.parse(sessionStorage.getItem(receiptKey) ?? 'null');
    if (receiptDraft?.id && receiptDraft?.receipt) savedReceipt = receiptDraft;
    const draft = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (draft && draft.version === version && Date.now() - draft.savedAt < 86400000) {
      model.data = draft.answers; model.currentPageNo = Math.min(draft.page ?? 0, model.visiblePages.length - 1); frozen = draft.frozen;
      announce(text.draft);
    } else if (draft) announce(text.stale);
    sessionStorage.setItem('nice-application-storage-test', '1'); sessionStorage.removeItem('nice-application-storage-test');
  } catch { storage = false; }
  restoring = false;
  // Site-wide language selection navigates between locale pages. Drafts use a shared, versioned key.
  document.addEventListener('change', (event) => {
    if (!(event.target instanceof HTMLSelectElement) || !event.target.matches('[data-language-select]')) return;
    save();
    if (!storage && (Object.keys(model.data).length || frozen || savedReceipt)) {
      event.preventDefault(); event.stopImmediatePropagation(); event.target.value = locale; announce(text.storage);
    }
  }, true);
  window.addEventListener('pagehide', save);
  if (savedReceipt) { showReceipt(); return; }
  if (frozen) {
    renderSurvey(model, container); model.mode = 'display'; announce(text.failed); retryButton.hidden = false;
    return;
  }
  try {
    const res = await fetch('/api/applications', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('availability');
    const availability = await res.json();
    preview = availability.preview === true && !availability.open;
    if (!availability.open && !preview) { announce(text.unavailable); return; }
    renderSurvey(model, container); clearButton.hidden = false;
    announce(preview ? text.preview : storage ? '' : text.storage);
  } catch { announce(text.loadError); }
}
