import definition from '../content/docs/_data/frc-2027.json' with { type: 'json' };
import zhCN from '../content/i18n/zh-CN.json' with { type: 'json' };
import zhHant from '../content/i18n/zh-Hant.json' with { type: 'json' };
import en from '../content/i18n/en.json' with { type: 'json' };
import type { Locale } from '../i18n/locales.js';

export const version = definition.version;
export const questions = definition.questions;
export type Answers = Record<string, string | number | string[]>;
export const supportedLocales = ['zh-CN', 'zh-Hant', 'en'] as const;
export const surveyLocale = { 'zh-CN': 'zh-cn', 'zh-Hant': 'zh-tw', en: 'en' };
export const groupNames = {
  'zh-CN': ['申请资格', '队伍信息', '联系方式', '队伍发展', '产品需求', '赛事与支持', '合作意愿', '声明与签名'],
  'zh-Hant': ['申請資格', '隊伍資訊', '聯絡方式', '隊伍發展', '產品需求', '賽事與支援', '合作意願', '聲明與簽名'],
  en: ['Eligibility', 'Team information', 'Contacts', 'Team development', 'Product needs', 'Events and support', 'Partnership', 'Declarations and signature'],
};
const uiKeys = ["preview","start","loading","unavailable","loadError","retry","submitting","pending","synced","receipt","failed","invalid","closed","terminated","back","draft","clear","confirmClear","privacy","consent","stale","storage","limits","length","checking","statusError","checkStatus","required","review","submit","submitNote","label","javascript"] as const;
function dictionary(data: Record<string, string>) {
  return Object.fromEntries(uiKeys.map((key) => [key, data[`application.${key}`]])) as Record<(typeof uiKeys)[number], string>;
}
export const copy = { 'zh-CN': dictionary(zhCN), 'zh-Hant': dictionary(zhHant), en: dictionary(en) };

type SourceRule = { logic: string; conditions: [string, string, unknown][] };
function ruleFor(id: string): SourceRule | undefined {
  return questions.find((q) => q.id === id)?.sourceRule as SourceRule | undefined;
}
function sourceId(title: string): string {
  const question = questions.find((q) => q.title['zh-CN'] === title || q.fieldName === title);
  if (!question) throw new Error('Unmapped source rule');
  return question.id;
}
export function visible(id: string, a: Record<string, unknown>): boolean {
  if (id.endsWith('other')) {
    const parent = id.slice(0, -5);
    const answer = a[parent];
    return visible(parent, a) && (answer === '其他' || (Array.isArray(answer) && answer.includes('其他')));
  }
  const rule = ruleFor(id);
  if (!rule) return true;
  const matches = rule.conditions.map(([title, operator, expected]) => {
    const actual = a[sourceId(title)];
    const values = Array.isArray(expected) ? expected : [expected];
    const intersection = (Array.isArray(actual) ? actual : [actual]).some((v) => values.includes(v));
    if (operator === '==' || operator === 'intersects') return intersection;
    if (operator === '!=') return !intersection;
    throw new Error('Unsupported source operator');
  });
  return rule.logic === 'or' ? matches.some(Boolean) : matches.every(Boolean);
}

export function validateAnswers(input: unknown): { answers: Answers; errors: Record<string, string> } {
  const answers: Answers = {};
  const errors: Record<string, string> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { answers, errors: { form: 'invalid' } };
  const raw = { ...input } as Record<string, unknown>;
  // Mirror clearInvisibleValues before validating: stale answers cannot re-enable descendants.
  for (let pass = 0; pass < questions.length; pass++) {
    let changed = false;
    for (const q of questions) if (Object.prototype.hasOwnProperty.call(raw, q.id) && !visible(q.id, raw)) { delete raw[q.id]; changed = true; }
    if (!changed) break;
  }
  for (const q of questions) {
    if (!visible(q.id, raw)) continue;
    const v = raw[q.id];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
    if (empty) { if (q.required) errors[q.id] = 'required'; continue; }
    if (q.type === 'number') {
      if (typeof v !== 'number' || !Number.isSafeInteger(v)) errors[q.id] = 'limits';
      else answers[q.id] = v;
    } else if (q.type === 'checkbox' || q.type === 'ranking') {
      const allowed = (q.choices ?? []).map((c) => c.value);
      if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !allowed.includes(x)) || new Set(v).size !== v.length) errors[q.id] = 'limits';
      else if ((q.type === 'ranking' || ['q36', 'q37', 'q38'].includes(q.id)) && v.length !== allowed.length) errors[q.id] = 'consent';
      else answers[q.id] = [...v];
    } else if (q.type === 'radiogroup') {
      if (typeof v !== 'string' || !(q.choices ?? []).some((c) => c.value === v)) errors[q.id] = 'limits';
      else answers[q.id] = v;
    } else {
      if (typeof v !== 'string' || !v.trim()) { errors[q.id] = 'required'; continue; }
      if (v.length > (['q22', 'q24', 'q28', 'q35'].includes(q.id) ? 10000 : 2000)) { errors[q.id] = 'length'; continue; }
      answers[q.id] = v.trim();
    }
  }
  return { answers, errors };
}


export function visibleExpression(id: string): string {
  if (id.endsWith('other')) return `(${visibleExpression(id.slice(0, -5))}) and {${id.slice(0, -5)}} contains '其他'`;
  const rule = ruleFor(id);
  if (!rule) return 'true';
  return rule.conditions.map(([title, operator, expected]) => {
    const values = Array.isArray(expected) ? expected : [expected];
    if (!['==','!=','intersects'].includes(operator)) throw new Error('Unsupported source operator');
    const joined = values.map((v) => `{${sourceId(title)}} ${operator === '!=' ? '!=' : '='} ${JSON.stringify(v)}`);
    return `(${joined.join(operator === '!=' ? ' and ' : ' or ')})`;
  }).join(rule.logic === 'or' ? ' or ' : ' and ');
}

function localize(text: Record<string, string>) { return { default: text.en, en: text.en, 'zh-cn': text['zh-CN'], 'zh-tw': text['zh-Hant'] }; }
export function schema(locale: Locale) {
  return {
    locale: surveyLocale[locale], showProgressBar: 'top', progressBarType: 'pages', showPreviewBeforeComplete: 'showAllQuestions',
    clearInvisibleValues: 'onHiddenContainer', checkErrorsMode: 'onValueChanged', showQuestionNumbers: 'on',
    pages: groupNames.en.map((_, group) => ({
      name: `section-${group}`, title: localize(Object.fromEntries(supportedLocales.map((l) => [l, groupNames[l][group]!]))),
      elements: questions.filter((q) => q.group === group).map((q) => ({
        name: q.id, showNumber: !q.id.endsWith('other'), type: q.type === 'number' ? 'text' : q.type,
        title: localize(q.title), description: localize(q.description), isRequired: q.required,
        ...(q.id !== 'q1' ? { visibleIf: visibleExpression(q.id) } : {}),
        ...(q.type === 'number' ? { inputType: 'number', step: 1 } : {}),
        ...(q.choices ? { choices: q.choices.map((c) => ({ value: c.value, text: localize(c.text) })) } : { maxLength: ['q22', 'q24', 'q28', 'q35'].includes(q.id) ? 10000 : 2000 }),
      })),
    })),
  };
}
