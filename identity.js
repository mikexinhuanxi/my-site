import { MINUTE, PEOPLE } from './domain.js?v=5';

const SAMPLE_SCORES = { lin: 718, zhou: 745, man: 692, yu: 731, wen: 683, xu: 709 };
const DEMO_DOMAIN = 'students.donghu.example';

export function demoMailbox(person) {
  return `${person}@${DEMO_DOMAIN}`;
}

function validTime(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 8.64e15;
}

function sampleStartingCredit(person, setAt) {
  return { score: SAMPLE_SCORES[person], setAt };
}

export function normalizeBindings(stored) {
  const bindings = {};
  for (const id of Object.keys(PEOPLE)) {
    const record = stored?.[id];
    if (!record) continue;
    const normalized = {};
    for (const method of ['student', 'sesame']) {
      if (validTime(record[method])) normalized[method] = record[method];
    }
    const initial = record.initialCredit;
    if (Number.isSafeInteger(initial?.score) && initial.score >= 0 && validTime(initial.setAt)) {
      normalized.initialCredit = { score: initial.score, setAt: initial.setAt };
    } else if (normalized.sesame) {
      // Prior demo versions saved the authorization time without storing a starting score.
      normalized.initialCredit = sampleStartingCredit(id, normalized.sesame);
    }
    bindings[id] = normalized;
  }
  return bindings;
}

export function studentVerified(record) {
  return Boolean(record?.student);
}

export function updateBinding(record, person, method, linked, now = Date.now()) {
  const updated = { ...record };
  if (linked) {
    updated[method] ??= now;
    if (method === 'sesame') updated.initialCredit ??= sampleStartingCredit(person, updated.sesame);
  } else {
    delete updated[method];
  }
  return updated;
}

export function bindingDetails(method, person) {
  if (method === 'student') return demoMailbox(person);
  return `样例芝麻分 ${SAMPLE_SCORES[person]}`;
}

export function requestDemoCode(person, address, now = Date.now()) {
  if (!Object.hasOwn(PEOPLE, person) || String(address).trim().toLowerCase() !== demoMailbox(person)) {
    throw new Error('请使用当前演示身份对应的学生邮箱。');
  }
  const random = globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  return { person, code: String(random % 1_000_000).padStart(6, '0'), expiresAt: now + 10 * MINUTE };
}

export function verifyDemoCode(challenge, person, entered, now = Date.now()) {
  if (!challenge || challenge.person !== person || now >= challenge.expiresAt) {
    throw new Error('验证码已失效，请获取新验证码。');
  }
  if (String(entered).trim() !== challenge.code) throw new Error('验证码有误，请核对后重试。');
}
