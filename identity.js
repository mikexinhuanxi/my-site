import { MINUTE, PEOPLE } from './domain.js';

const SAMPLE_SCORES = { lin: 718, zhou: 745, man: 692, yu: 731, wen: 683, xu: 709 };
const DEMO_DOMAIN = 'students.donghu.example';

export function demoMailbox(person) {
  return `${person}@${DEMO_DOMAIN}`;
}

export function normalizeBindings(stored) {
  const bindings = {};
  for (const id of Object.keys(PEOPLE)) {
    const record = stored?.[id];
    if (!record) continue;
    bindings[id] = {};
    for (const method of ['student', 'sesame']) {
      if (Number.isSafeInteger(record[method]) && record[method] > 0 && record[method] <= 8.64e15) {
        bindings[id][method] = record[method];
      }
    }
  }
  return bindings;
}

export function identityReady(record) {
  return Boolean(record?.student && record.sesame);
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
