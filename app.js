import {
  CATEGORIES, CREDIT_PER_TASK, MINUTE, PEOPLE, STATUS,
  clockLabel, createTask, creditFor, deadlineLabel, localInputValue, seedTasks,
  taskStatus, transition,
} from './domain.js?v=3';
import { icon } from './icons.js?v=2';
import {
  bindingDetails, demoMailbox, normalizeBindings, requestDemoCode, studentVerified, updateBinding, verifyDemoCode,
} from './identity.js?v=3';

const TASKS_KEY = 'dabashou.tasks.v1';
const BINDINGS_KEY = 'dabashou.bindings.v1';
const PERSON_KEY = 'dabashou.person.v1';
const PAGES = ['tasks', 'mine', 'credit'];
const BINDING_METHODS = {
  student: { label: '学生邮箱', glyph: 'mail', purpose: '通过学校邮箱验证码确认学生身份。', action: '绑定学生邮箱', state: '已验证' },
  sesame: { label: '芝麻信用', glyph: 'badge', purpose: '首次授权时按样例芝麻分设定初始信用。', action: '绑定芝麻信用', state: '已授权' },
};
const $ = (selector, root = document) => root.querySelector(selector);
const dialog = $('#dialog');
const accountButton = $('#account-button');
const accountPanel = $('#account-panel');
const search = $('#task-search');
const toast = $('#toast');
const currency = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', currencyDisplay: 'narrowSymbol' });

const ui = { page: 'tasks', category: 'all', query: '', sort: 'latest', myRole: 'taken', myStatus: 'all' };
let tasks = seedTasks();
let bindings = {};
let person = 'lin';
let modal;
let opener;
let saving = false;
let storageAvailable = true;
let toastTimer;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function restoreTasks() {
  if (!storageAvailable) return tasks;
  try {
    const stored = JSON.parse(localStorage.getItem(TASKS_KEY));
    if (Array.isArray(stored) && stored.every(task => task && Object.hasOwn(CATEGORIES, task.category) &&
      Object.hasOwn(PEOPLE, task.author) && (!task.assignee || Object.hasOwn(PEOPLE, task.assignee)) &&
      Object.hasOwn(STATUS, task.status) && Number.isFinite(task.dueAt))) return stored;
  } catch {
    return tasks;
  }
  return tasks;
}

function setTasks(updated) {
  tasks = updated;
  return persist(TASKS_KEY, updated);
}

function restoreBindings() {
  if (!storageAvailable) return bindings;
  try {
    return normalizeBindings(JSON.parse(localStorage.getItem(BINDINGS_KEY)));
  } catch {
    return bindings;
  }
}

function persist(key, value) {
  if (!storageAvailable) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    storageAvailable = false;
    return false;
  }
}

function readPerson() {
  try {
    const stored = sessionStorage.getItem(PERSON_KEY);
    if (Object.hasOwn(PEOPLE, stored)) return stored;
  } catch {
    // The selected identity is still retained in memory for this visit.
  }
  return 'lin';
}

function avatar(id) {
  const profile = PEOPLE[id];
  return `<span class="avatar avatar-${profile.tone}" aria-hidden="true">${profile.initial}</span>`;
}

function categoryMark(type) {
  const { label, icon: glyph } = CATEGORIES[type];
  return `<span class="category-mark tone-${type}"><span class="category-icon">${icon(glyph)}</span><span>${label}</span></span>`;
}

function fee(amount) {
  return amount > 0
    ? `<span class="task-fee"><small>感谢费</small><strong>${currency.format(amount)}</strong></span>`
    : '<span class="task-fee"><strong class="fee-free">无偿互助</strong></span>';
}

function statusTag(status) {
  return `<span class="tag status-${status}"><span></span>${STATUS[status]}</span>`;
}

function identityTag(id) {
  if (!studentVerified(bindings[id])) return '';
  return `<span class="identity-mark" title="学生邮箱已验证（演示）">${icon('shield')}<span class="visually-hidden">学生邮箱已验证</span></span>`;
}

function renderCard(task, surface) {
  const status = taskStatus(task);
  const isAuthor = task.author === person;
  const upcoming = surface === 'board' && task.dueAt - Date.now() < 90 * MINUTE;
  const counterpart = isAuthor ? task.assignee ?? task.author : task.author;
  const peerName = isAuthor && !task.assignee ? '我发布的' : PEOPLE[counterpart].name;
  const path = escapeHtml(task.origin) +
    (task.destination ? ` ${icon('arrow')} ${escapeHtml(task.destination)}` : '');
  return `
    <article class="task-card">
      <div class="task-card-top">${categoryMark(task.category)}${fee(task.reward)}</div>
      <h3>${escapeHtml(task.title)}</h3>
      <div class="task-meta">
        <div class="meta-row">${icon('pin')}<span class="route-text">${path}</span></div>
        <div class="meta-row">${icon('clock')}<time datetime="${new Date(task.dueAt).toISOString()}">${deadlineLabel(task.dueAt)}</time>
          ${upcoming ? '<span class="urgency">即将截止</span>' : ''}${surface === 'mine' ? statusTag(status) : ''}
        </div>
      </div>
      <div class="task-card-bottom">
        <span class="card-person">${avatar(counterpart)}<span>${peerName}</span>${identityTag(counterpart)}</span>
        <button class="button card-button" type="button" data-action="detail" data-id="${escapeHtml(task.id)}" aria-label="查看详情 · ${escapeHtml(task.title)}">查看详情${icon('arrow')}</button>
      </div>
    </article>`;
}

function chip(value, label, selected, action) {
  return `<button type="button" class="filter-chip" data-action="${action}" data-value="${value}" aria-pressed="${selected}">${label}</button>`;
}

function emptyState(heading, description, action, label) {
  return `<div class="empty-state"><span class="empty-icon">${icon('inbox')}</span><h3>${heading}</h3><p>${description}</p>
    <button class="button secondary" type="button" data-action="${action}">${label}</button></div>`;
}

function renderBoard() {
  const open = tasks.filter(task => taskStatus(task) === 'open');
  const query = ui.query.trim().toLocaleLowerCase('zh-CN');
  const visible = open.filter(task => {
    const categoryMatch = ui.category === 'all' || task.category === ui.category;
    const publicText = [task.title, task.origin, task.destination, task.item, task.notes, CATEGORIES[task.category].label].join(' ');
    return categoryMatch && publicText.toLocaleLowerCase('zh-CN').includes(query);
  });
  const sorts = {
    latest: (a, b) => b.createdAt - a.createdAt,
    soon: (a, b) => a.dueAt - b.dueAt,
    reward: (a, b) => b.reward - a.reward || a.dueAt - b.dueAt,
  };
  visible.sort(sorts[ui.sort]);
  $('#board-count').textContent = ui.category === 'all' && !query
    ? `${open.length} 个待接单任务` : `找到 ${visible.length} 个任务`;
  const filters = $('#category-filters');
  if (!filters.childElementCount) {
    filters.innerHTML = [['all', '全部任务'], ...Object.entries(CATEGORIES).map(([key, entry]) => [key, entry.label])]
      .map(([key, label]) => chip(key, label, key === ui.category, 'filter')).join('');
  }
  for (const button of filters.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.value === ui.category));
  }
  const destination = $('#board-tasks');
  if (visible.length) {
    destination.innerHTML = visible.map(task => renderCard(task, 'board')).join('');
  } else if (open.length && (ui.category !== 'all' || query)) {
    destination.innerHTML = emptyState('没有匹配的任务', '试试换个关键词，或查看全部类别。', 'clear', '清除筛选');
  } else {
    destination.innerHTML = emptyState('暂时没有待接任务', '有需要时，可以发一个任务请同学帮忙。', 'publish', '发布任务');
  }
}

function bindingCard(method) {
  const config = BINDING_METHODS[method];
  const time = bindings[person]?.[method];
  return `<article class="panel binding-card binding-${method}">
    <div class="binding-top">
      <span class="binding-icon">${icon(config.glyph)}</span>
      <div><h3>${config.label}</h3><p>${config.purpose}</p></div>
      <span class="binding-state ${time ? 'is-bound' : ''}">${time ? config.state : '待绑定'}</span>
    </div>
    <div class="binding-bottom">
      ${time ? `<strong class="binding-value">${bindingDetails(method, person)}</strong>` : ''}
      <button class="button ${time ? 'secondary' : 'binding-action'}" type="button" data-action="binding" data-value="${method}" aria-label="${time ? `管理${config.label}绑定` : config.action}">${time ? '管理绑定' : config.action}</button>
    </div>
  </article>`;
}

function bindingCards() {
  return Object.keys(BINDING_METHODS).map(bindingCard).join('');
}

function campusCredit(id) {
  return creditFor(tasks, id, bindings[id]?.initialCredit?.score);
}

function renderCredit() {
  const { total, earned, entries } = campusCredit(person);
  const initial = bindings[person]?.initialCredit;
  const verified = studentVerified(bindings[person]);
  const creditNumber = total === null
    ? '<div class="credit-number credit-unset"><strong>待设定</strong></div>'
    : `<div class="credit-number"><strong>${total}</strong><span>分</span></div>`;
  const creditCaption = `<p class="credit-caption"><span class="credit-dot"></span>已完成 ${entries.length} 单 · 任务积分 +${earned} 分</p>`;
  const creditRule = initial
    ? `初始信用 ${initial.score} 分，每单确认后加 ${CREDIT_PER_TASK} 分。`
    : `首次绑定芝麻信用时设定初始分。每单确认后加 ${CREDIT_PER_TASK} 分。`;
  $('#identity-content').innerHTML = `
    <div class="identity-section-head"><div><h2 id="identity-title">${PEOPLE[person].name}的绑定记录</h2><p>验证学生邮箱后即可发布或接单。</p></div>
      <span class="binding-state ${verified ? 'is-bound' : ''}">${verified ? '学生身份已验证' : '学生身份待验证'}</span></div>
    <div class="binding-grid">${bindingCards()}</div>
    <p class="identity-note">${icon('info')}<span>Demo 使用预置邮箱和芝麻信用样例，演示验证码在页面内显示。</span></p>`;
  $('#credit-preview').innerHTML = `
    <div class="credit-heading"><span class="credit-emblem">${icon('shield')}</span><h2 id="credit-preview-title">我的校内信用</h2></div>
    ${creditNumber}${creditCaption}
    <a class="text-link" href="#credit">${initial ? '查看身份与信用' : '设定初始信用分'}${icon('arrow')}</a>`;
  const records = entries.map(task => `
    <li class="record">
      <div class="record-icon">${icon('check')}</div>
      <div class="record-copy"><strong>${escapeHtml(task.title)}</strong><small>${clockLabel(task.completedAt)} · 发布者确认</small></div>
      <strong class="record-amount">+${CREDIT_PER_TASK} 分</strong>
    </li>`).join('');
  $('#credit-content').innerHTML = `
    <section class="panel credit-summary">
      <div class="credit-heading"><span class="credit-emblem">${icon('shield')}</span><h2>${PEOPLE[person].name}的校内信用</h2></div>
      ${creditNumber}${creditCaption}
      <p class="summary-rule">${creditRule}</p>
    </section>
    <section class="panel credit-records" aria-labelledby="credit-log-title">
      <h2 id="credit-log-title">校内信用明细</h2>
      <ul class="records">${records}
        <li class="record"><div class="record-icon">${icon('shield')}</div><div class="record-copy"><strong>初始信用分</strong>
          <small>${initial ? `${clockLabel(initial.setAt)} · 芝麻信用样例` : '绑定芝麻信用后设定'}</small></div>
          <strong class="record-amount">${initial ? `+${initial.score} 分` : '待设定'}</strong></li>
      </ul>
    </section>`;
}

function renderMine() {
  const mine = tasks.filter(task => task.assignee === person || task.author === person);
  const counts = [
    ['进行中', 'clock', 'active'], ['待确认', 'package', 'review'], ['已完成', 'check', 'completed'],
  ];
  const inRole = ui.myRole === 'taken' ? mine.filter(task => task.assignee === person) : mine.filter(task => task.author === person);
  $('#my-stats').innerHTML = counts.map(([label, glyph, status]) => {
    const count = inRole.filter(task => taskStatus(task) === status).length;
    return `<div class="panel stat"><span class="stat-icon status-${status}">${icon(glyph)}</span><div><small>${label}</small><strong>${count}</strong></div></div>`;
  }).join('');
  const filters = $('#mine-filters');
  if (!filters.childElementCount) {
    filters.innerHTML = chip('taken', '我接的', true, 'my-role') + chip('posted', '我发布的', false, 'my-role');
  }
  for (const button of filters.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.value === ui.myRole));
  }
  const visible = inRole.filter(task => {
    const status = taskStatus(task);
    if (ui.myStatus === 'closed') return status === 'expired' || status === 'cancelled';
    return ui.myStatus === 'all' || status === ui.myStatus;
  }).sort((a, b) => b.createdAt - a.createdAt);
  let content = visible.map(task => renderCard(task, 'mine')).join('');
  if (!visible.length && inRole.length) {
    content = emptyState('这个状态下没有任务', '可切回全部状态，查看任务进展。', 'clear-mine', '查看全部状态');
  } else if (!visible.length) {
    content = ui.myRole === 'taken'
      ? emptyState('还没有接过任务', '去任务广场看看有没有顺路的一单。', 'go-board', '浏览任务')
      : emptyState('还没有发布任务', '发布一个需求，请同学搭把手。', 'publish', '发布任务');
  }
  $('#mine-tasks').innerHTML = content;
}

function renderAccount() {
  accountButton.innerHTML = `${avatar(person)}<span class="account-name">${PEOPLE[person].name}</span>${icon('chevron')}`;
  accountButton.setAttribute('aria-label', `${PEOPLE[person].name}，切换演示身份`);
  accountPanel.innerHTML = `<div class="account-panel-label">切换演示身份</div>${Object.entries(PEOPLE).map(([id, profile]) => `
    <button type="button" class="account-option" data-action="person" data-value="${id}" aria-pressed="${id === person}">
      ${avatar(id)}<span>${profile.name}<small>${profile.bio}</small></span>${id === person ? icon('check') : ''}
    </button>`).join('')}`;
}

function toggleAccount(open) {
  accountButton.setAttribute('aria-expanded', String(open));
  accountPanel.hidden = !open;
  if (open) $('button[aria-pressed="true"]', accountPanel).focus();
}

function renderData() {
  renderBoard();
  renderMine();
  renderCredit();
}

function renderPage(scroll = false) {
  const requested = location.hash.slice(1);
  ui.page = PAGES.includes(requested) ? requested : 'tasks';
  for (const page of PAGES) $(`#page-${page}`).hidden = page !== ui.page;
  for (const link of document.querySelectorAll('[data-page]')) {
    if (link.dataset.page === ui.page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const titles = { tasks: '任务广场', mine: '我的任务', credit: '身份与信用' };
  document.title = `搭把手 · ${titles[ui.page]}`;
  if (scroll) window.scrollTo(0, 0);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.innerHTML = `${icon('check')}<span>${escapeHtml(message)}</span>`;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3500);
}

function dialogHeader(title, extra = '') {
  return `<header class="dialog-header"><div class="dialog-title-group">${extra}<h2 id="dialog-title" tabindex="-1">${escapeHtml(title)}</h2></div>
    <button type="button" class="icon-button" data-action="close" aria-label="关闭弹窗">${icon('close')}</button></header>`;
}

function showDialog(options) {
  opener = document.activeElement;
  modal = options;
  renderDialog();
  dialog.showModal();
  $('#dialog-title', dialog).focus();
}

function refocusDialog() {
  $('#dialog-title', dialog)?.focus();
}

function replaceDialog(options) {
  modal = options;
  renderDialog();
  refocusDialog();
}

function field(label, control, hint = '') {
  return `<label class="form-field"><span>${label}</span>${control}${hint ? `<small>${hint}</small>` : ''}</label>`;
}

function publishFields(category, mode) {
  if (category === 'pickup') {
    return `
      <div class="field-grid">
        ${field('取件地点', '<input name="origin" maxlength="36" required placeholder="北门菜鸟驿站">')}
        ${field('交接地点', '<input name="destination" maxlength="36" required placeholder="松柏苑 6 栋一楼">')}
      </div>
      <div class="field-grid">
        ${field('包裹件数', '<input type="number" name="quantity" min="1" max="20" value="1" required>')}
        ${field('包裹大小', '<select name="size"><option>小件</option><option>含大件</option></select>')}
      </div>
      ${field('演示取件码 <small>选填</small>', '<input name="code" maxlength="21" autocomplete="off" placeholder="DEMO-0426">', '仅填演示码，只有发布者和接单同学的详情页会显示。')}`;
  }
  if (category === 'buy') {
    return `
      <div class="field-grid">
        ${field('购买地点', '<input name="origin" maxlength="36" required placeholder="二食堂一楼">')}
        ${field('交接地点', '<input name="destination" maxlength="36" required placeholder="梧桐苑 3 栋门厅">')}
      </div>
      ${field('物品和规格', '<input name="item" maxlength="60" required placeholder="鸡腿饭，微辣，打包">')}
      <div class="field-grid">
        ${field('购买数量', '<input type="number" name="quantity" min="1" max="20" value="1" required>')}
        ${field('商品预算（元）', '<input type="number" name="budget" min="0.01" max="1000" step="0.01" required placeholder="25">')}
      </div>`;
  }
  return `
    <div class="field-grid">
      ${field('座位地点', `<input name="origin" maxlength="36" required placeholder="${mode === 'hold' ? '学生活动中心 102' : '图书馆二楼靠窗区'}">`)}
      ${field('互助方式', `<select name="mode"><option value="lookup">帮看空座</option><option value="hold" ${mode === 'hold' ? 'selected' : ''}>活动留座</option></select>`)}
    </div>
    ${mode === 'hold' ? `
      <div class="field-grid">
        ${field('座位数', '<input type="number" name="quantity" min="1" max="4" value="1" required>')}
        ${field('最多留座（分钟）', '<input type="number" name="holdMinutes" min="1" max="30" value="10" required>')}
      </div>
      <label class="check-field"><input type="checkbox" name="allowed" required><span>我已确认活动主办方允许留座。</span></label>`
    : `<div class="info-box">${icon('info')}<span>请同学帮看楼层和空位。图书馆预约按本校规则由本人完成。</span></div>`}`;
}

function renderPublish() {
  const now = Date.now();
  const defaultDeadline = localInputValue(now + 120 * MINUTE);
  const minDeadline = localInputValue(now + MINUTE);
  dialog.innerHTML = `${dialogHeader('发布任务')}
    <form id="publish-form" class="dialog-form">
      <div class="dialog-scroll form-scroll">
        <fieldset class="category-options"><legend>任务类别</legend><div>${Object.entries(CATEGORIES).map(([key, category]) => `
          <label class="category-option tone-${key}"><input type="radio" name="category" value="${key}" ${key === 'pickup' ? 'checked' : ''}>
            <span>${icon(category.icon)}${category.label}</span></label>`).join('')}</div>
        </fieldset>
        ${field('任务标题', '<input name="title" maxlength="42" required placeholder="用一句话说清需要什么帮助">')}
        <div id="publish-fields" class="dynamic-fields">${publishFields('pickup')}</div>
        <div class="field-grid">
          ${field('最晚完成（北京时间）', `<input type="datetime-local" name="deadline" min="${minDeadline}" value="${defaultDeadline}" required>`)}
          ${field('感谢费（元）', '<input type="number" name="reward" min="0" max="500" step="0.01" value="5" required>', '填 0 表示无偿互助。')}
        </div>
        ${field('补充要求 <small>选填</small>', '<textarea name="notes" rows="3" maxlength="240" placeholder="写下便于交接的公开说明，例如包裹重量、可接受的替代品。"></textarea>')}
      </div>
      <div class="dialog-footer">
        <p class="form-error" role="alert" hidden></p>
        <button class="button secondary" type="button" data-action="close">取消</button>
        <button class="button primary" type="submit">${icon('plus')}确认发布</button>
      </div>
    </form>`;
}

function updatePublishFields(input) {
  const container = $('#publish-fields');
  const form = input.form;
  const current = modal.category;
  const values = Object.fromEntries([...container.querySelectorAll('[name]')].map(field => [
    field.name, field.type === 'checkbox' ? field.checked : field.value,
  ]));
  modal.drafts[current] = { ...modal.drafts[current], ...values };
  const category = form.elements.category.value;
  const draft = modal.drafts[category] ?? {};
  modal.category = category;
  container.innerHTML = publishFields(category, draft.mode);
  for (const control of container.querySelectorAll('[name]')) {
    if (!Object.hasOwn(draft, control.name)) continue;
    if (control.type === 'checkbox') control.checked = draft[control.name];
    else control.value = draft[control.name];
  }
  if (input.name === 'mode') form.elements.mode.focus();
}

function detailRoles(task) {
  const party = (id, label) => {
    const { total } = campusCredit(id);
    return `<div class="detail-person">${avatar(id)}<div><small>${label}</small><strong>${PEOPLE[id].name}${identityTag(id)}</strong></div>
      <span>${total === null ? '校内信用待设定' : `${total} 校内信用分`}</span></div>`;
  };
  return `<div class="detail-people">${party(task.author, '发布者')}${task.assignee ? party(task.assignee, '接单同学') : ''}</div>`;
}

function taskFacts(task) {
  const { category } = task;
  const facts = [[CATEGORIES[category].origin, task.origin]];
  if (task.destination) facts.push(['交接地点', task.destination]);
  if (category === 'pickup') facts.push(['包裹', `${task.quantity} 件 · ${task.size}`]);
  if (category === 'buy') {
    facts.push(['物品和规格', `${task.item} × ${task.quantity}`], ['商品预算', currency.format(task.budget)]);
  }
  if (category === 'seat') {
    const seat = task.mode === 'hold' ? `活动留座 · ${task.quantity} 座 · 最多 ${task.holdMinutes} 分钟` : '帮看空座';
    facts.push(['互助方式', seat]);
  }
  facts.push(['截止时间', `${clockLabel(task.dueAt)}（北京时间）`]);
  return `<dl class="fact-grid">${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>`;
}

function timeline(task) {
  const steps = [['发布', task.createdAt], ['接单', task.acceptedAt], ['提交交付', task.submittedAt], ['确认完成', task.completedAt]];
  return `<ol class="progress-steps" aria-label="任务进度">${steps.map(([label, date]) => `
    <li class="${date ? 'done' : ''}"><span class="progress-dot">${date ? icon('check') : ''}</span>
      <strong>${label}</strong>${date ? `<small>${clockLabel(date)}</small>` : ''}</li>`).join('')}</ol>`;
}

function detailActions(task, status) {
  const own = task.author === person;
  const runner = task.assignee === person;
  const primary = (label, action, glyph = '') => `<button class="button primary" type="button" data-action="${action}">${glyph ? icon(glyph) : ''}${label}</button>`;
  const secondary = (label, action) => `<button class="button secondary" type="button" data-action="${action}">${label}</button>`;
  if (modal.stage === 'cancel' || modal.stage === 'withdraw') {
    const cancellation = modal.stage === 'cancel';
    return `${secondary('返回详情', 'stay')}<button class="button danger" type="button" data-action="${modal.stage}">${cancellation ? '确认取消任务' : '确认退出接单'}</button>`;
  }
  if (modal.stage === 'delivery') {
    return `${secondary('返回详情', 'stay')}<button class="button primary" type="submit" form="delivery-form">提交交付</button>`;
  }
  if (status === 'open') {
    if (own) return secondary('取消任务', 'ask-cancel');
    return studentVerified(bindings[person]) ? primary('确认接单', 'accept', 'check') : primary('验证学生邮箱后接单', 'gate-accept', 'mail');
  }
  if (status === 'active' && runner) return secondary('退出接单', 'ask-withdraw') + primary('提交交付', 'delivery');
  if (status === 'review' && own) return primary('确认完成', 'complete', 'check');
  return secondary('关闭', 'close');
}

function renderDetail(task) {
  const status = taskStatus(task);
  const participant = task.author === person || task.assignee === person;
  if ((modal.stage === 'delivery' || modal.stage === 'withdraw') && (status !== 'active' || person !== task.assignee)) modal.stage = '';
  if (modal.stage === 'cancel' && (status !== 'open' || person !== task.author)) modal.stage = '';
  const header = `<div class="detail-badges">${categoryMark(task.category)}${statusTag(status)}</div>`;
  let privateCode = '';
  if (task.category === 'pickup' && task.code) {
    privateCode = `<div class="info-box">${icon('lock')}<span>${participant ? `演示取件码 <strong>${escapeHtml(task.code)}</strong>` : '演示取件码在接单后显示。'}</span></div>`;
  }
  let deliveryForm = '';
  if (modal.stage === 'delivery') {
    const placeholder = task.category === 'seat' ? '例如：16:25 看到二楼靠窗区还有 2 个空座。' : '例如：已在约定地点当面交接。';
    deliveryForm = `<form id="delivery-form">${field('交付说明', `<textarea name="delivery" required maxlength="240" rows="3" placeholder="${placeholder}"></textarea>`, '发布者确认后计入信用。')}</form>`;
  }
  const confirmation = modal.stage === 'cancel' ? '取消后，任务将从广场下架。'
    : modal.stage === 'withdraw' ? '退出后，截止时间未到的任务会回到广场，其他同学可以接单。' : '';
  dialog.innerHTML = `${dialogHeader(task.title, header)}
    <div class="dialog-scroll detail-content">
      ${modal.notice ? `<div class="info-box success-box">${icon('check')}<span>${escapeHtml(modal.notice)}</span></div>` : ''}
      <div class="detail-overview">${detailRoles(task)}${fee(task.reward)}</div>
      ${taskFacts(task)}
      ${task.notes ? `<div class="detail-note"><h3>任务说明</h3><p>${escapeHtml(task.notes)}</p></div>` : ''}
      ${task.category === 'seat' && task.mode === 'lookup' ? `<div class="info-box">${icon('info')}<span>空位以现场为准。图书馆预约请按本校规则由本人完成。</span></div>` : ''}
      ${privateCode}
      ${participant && status !== 'cancelled' && status !== 'expired' ? timeline(task) : ''}
      ${participant && task.delivery ? `<div class="detail-note"><h3>交付说明</h3><p>${escapeHtml(task.delivery)}</p></div>` : ''}
      ${deliveryForm}
      ${status === 'review' && task.assignee === person ? `<div class="info-box">${icon('clock')}<span>等待 ${PEOPLE[task.author].name} 确认。切换到发布者身份可继续演示。</span></div>` : ''}
      ${confirmation ? `<div class="info-box">${icon('info')}<span>${confirmation}</span></div>` : ''}
    </div>
    <div class="dialog-footer"><p class="form-error" role="alert" hidden></p>${detailActions(task, status)}</div>`;
}

function renderGuide() {
  dialog.innerHTML = `${dialogHeader('互助指南')}
    <div class="dialog-scroll guide-content">
      <section><h3>发布和接单</h3><p>在「身份与信用」验证演示学生邮箱。发布时写清地点、截止时间和交接要求，接单者做完后提交交付说明。</p></section>
      <section><h3>初始信用分</h3><p>首次绑定芝麻信用时，系统用样例芝麻分设定初始分。已经确认的任务积分会计入校内信用。</p></section>
      <section><h3>体验双方确认</h3><p>切换右上角的演示身份。例如用小林接阿周的任务，提交交付后切换成阿周，在「我的任务 → 我发布的」确认完成。小林会获得 ${CREDIT_PER_TASK} 信用分。</p></section>
      <section><h3>座位互助</h3><p>图书馆可以请同学帮看空位，并按校规本人预约。校园活动可在主办方允许时请同学短时留座。</p></section>
      <section><h3>数据与金额</h3><p>校区、同学和示例任务均为演示数据。任务保存在当前浏览器。感谢费和商品预算用于展示，无在线支付或报销。</p></section>
    </div>
    <div class="dialog-footer"><button class="button primary" type="button" data-action="close">知道了</button></div>`;
}

function identityFooter(back, action = '') {
  return `<div class="dialog-footer"><p class="form-error" role="alert" hidden></p>
    <button type="button" class="button secondary" data-action="binding-back">${back}</button>${action}</div>`;
}

function bindingPopup(title, content, back, action = '') {
  dialog.innerHTML = `${dialogHeader(title)}<div class="dialog-scroll identity-dialog">${content}</div>${identityFooter(back, action)}`;
}

function renderIdentityDialog() {
  const { stage, target, challenge, disconnect, notice } = modal;
  const { name } = PEOPLE[person];
  if (stage === 'overview') {
    const publishing = target.type === 'publish';
    const intent = publishing ? '发布任务' : '接单';
    const ready = studentVerified(bindings[person]);
    const action = ready || !publishing ? `<button type="button" class="button primary" data-action="resume-task">${publishing ? '继续发布' : '返回任务'}${icon('arrow')}</button>` : '';
    return bindingPopup(`验证学生邮箱后${intent}`, `
      <p>${ready ? '学生身份已验证。' : `${name}需要先通过学生邮箱验证身份。`}</p>
      ${notice ? `<div class="info-box">${icon('info')}${escapeHtml(notice)}</div>` : ''}
      ${bindingCard('student')}`, '稍后再说', action);
  }

  const { label, glyph } = BINDING_METHODS[stage];
  const boundAt = bindings[person]?.[stage];
  const back = target ? '返回绑定' : '关闭';
  if (boundAt) {
    const action = disconnect
      ? '<button type="button" class="button danger" data-action="disconnect">确认解除绑定</button>'
      : '<button type="button" class="button secondary" data-action="ask-disconnect">解除绑定</button>';
    return bindingPopup(`管理${label}绑定`, `
      <div class="binding-receipt"><span class="binding-icon">${icon(glyph)}</span>
        <div><strong>${bindingDetails(stage, person)}</strong><p>${clockLabel(boundAt)} · 演示绑定</p></div></div>
      ${disconnect ? `<div class="info-box">${icon('info')}<span>${stage === 'student'
        ? '解除后，发布或接单前需重新验证学生邮箱。'
        : '解除后可再次授权查看样例芝麻分。'}</span></div>` : ''}`, back, action);
  }

  if (stage === 'sesame') {
    return bindingPopup('芝麻信用授权', `
      <div class="binding-receipt binding-sesame"><span class="binding-icon">${icon(glyph)}</span>
        <div><strong>${name} · 演示授权</strong><p>首次授权以样例芝麻分设定初始信用分。</p></div></div>
      <form id="sesame-form"><label class="check-field"><input type="checkbox" name="consent" required>
        <span>同意为当前身份记录模拟芝麻信用授权。</span></label></form>`, target ? back : '取消',
      '<button type="submit" form="sesame-form" class="button primary">确认模拟授权</button>');
  }

  const mailbox = demoMailbox(person);
  return bindingPopup('绑定学生邮箱', `
    <form id="student-form" class="binding-form">
      ${field('学生邮箱', `<input type="email" name="mailbox" maxlength="254" autocomplete="off" autocapitalize="none" spellcheck="false"
        placeholder="${mailbox}" ${challenge ? `value="${mailbox}" readonly` : 'required'}>`)}
      ${challenge ? `<div class="demo-mail"><div><strong>演示邮件</strong><p>验证码 10 分钟内有效</p></div><output class="challenge-code">${challenge.code}</output></div>
        ${field('六位验证码', '<input name="code" inputmode="numeric" autocomplete="off" pattern="[0-9]{6}" maxlength="6" required>')}
        <button class="plain-button" type="button" data-action="new-code">获取新验证码</button>`
        : '<button class="plain-button" type="button" data-action="sample-email">填入演示邮箱</button>'}
    </form>`, target ? back : '取消', `<button type="submit" form="student-form" class="button primary">${challenge ? '验证并绑定' : '获取演示验证码'}</button>`);
}

function renderDialog() {
  if (modal.type === 'publish') return renderPublish();
  if (modal.type === 'guide') return renderGuide();
  if (modal.type === 'identity') return renderIdentityDialog();
  const task = tasks.find(task => task.id === modal.id);
  if (task) renderDetail(task);
}

function showFormError(message) {
  const error = $('.form-error', dialog);
  if (!error) return;
  error.textContent = message;
  error.hidden = false;
}

async function mutate(commit, onSuccess) {
  if (saving) return;
  saving = true;
  dialog.setAttribute('aria-busy', 'true');
  try {
    const persisted = navigator.locks ? await navigator.locks.request(TASKS_KEY, commit) : commit();
    renderData();
    onSuccess(persisted ? '' : '当前浏览器无法保存本次操作。');
  } catch (error) {
    tasks = restoreTasks();
    bindings = restoreBindings();
    renderData();
    if (modal?.type === 'detail') renderDialog();
    showFormError(error.message);
  } finally {
    saving = false;
    dialog.removeAttribute('aria-busy');
  }
}

function mutateTasks(update, onSuccess) {
  return mutate(() => setTasks(update(restoreTasks())), onSuccess);
}

function requireVerifiedIdentity() {
  bindings = restoreBindings();
  if (!studentVerified(bindings[person])) throw new Error('请先验证学生邮箱。');
}

function openBinding(stage, target = modal?.target) {
  const next = { type: 'identity', stage, target };
  if (dialog.open) replaceDialog(next);
  else showDialog(next);
}

function startPublish() {
  const target = { type: 'publish', category: 'pickup', drafts: {} };
  bindings = restoreBindings();
  if (studentVerified(bindings[person])) showDialog(target);
  else openBinding('overview', target);
}

function resumeTask() {
  const { target } = modal;
  bindings = restoreBindings();
  if (target.type === 'publish' && !studentVerified(bindings[person])) return renderDialog();
  replaceDialog(target);
}

function changeBinding(method, linked, code = '') {
  const { challenge, target } = modal;
  return mutate(() => {
    const current = restoreBindings();
    // The demo challenge is held in the dialog and never persisted.
    if (linked && method === 'student') verifyDemoCode(challenge, person, code);
    const record = updateBinding(current[person], person, method, linked);
    bindings = { ...current, [person]: record };
    return persist(BINDINGS_KEY, bindings);
  }, partial => {
    if (target) {
      replaceDialog({ type: 'identity', stage: 'overview', target, notice: partial });
    } else {
      dialog.close();
      const message = linked && method === 'sesame'
        ? `芝麻信用已绑定，初始信用 ${bindings[person].initialCredit.score} 分。`
        : linked ? '学生身份已验证。' : '已解除绑定。';
      showToast(partial || message);
    }
  });
}

function requestBindingCode(address) {
  try {
    modal.challenge = requestDemoCode(person, address);
    renderDialog();
    $('#student-form input[name="code"]').focus();
  } catch (error) {
    showFormError(error.message);
  }
}

function updateTask(action, delivery = '') {
  const { id } = modal;
  const notices = {
    accept: '接单成功，可从「我的任务」跟进。', submit: '交付已提交，等待发布者确认。',
    complete: `已确认完成，${CREDIT_PER_TASK} 分已计入接单同学的信用记录。`,
    cancel: '任务已取消。', withdraw: '已退出接单。',
  };
  return mutateTasks(current => {
    if (action === 'accept') requireVerifiedIdentity();
    const target = current.find(task => task.id === id);
    if (!target) throw new Error('找不到这项任务，请返回任务列表。');
    const updated = transition(target, action, person, delivery);
    return current.map(task => task.id === id ? updated : task);
  }, partial => {
    if (!dialog.open) return;
    modal.stage = '';
    modal.notice = partial || notices[action];
    renderDialog();
    refocusDialog();
  });
}

function selectPerson(id) {
  if (!Object.hasOwn(PEOPLE, id)) return;
  person = id;
  try { sessionStorage.setItem(PERSON_KEY, id); } catch { /* This visit retains the choice. */ }
  ui.myRole = 'taken';
  ui.myStatus = 'all';
  $('#mine-status').value = 'all';
  renderAccount();
  toggleAccount(false);
  accountButton.focus();
  renderData();
  showToast(`已切换为${PEOPLE[id].name}`);
}

const actions = {
  guide: () => showDialog({ type: 'guide' }),
  publish: startPublish,
  detail: button => showDialog({ type: 'detail', id: button.dataset.id }),
  close: () => dialog.close(),
  filter: button => { ui.category = button.dataset.value; renderBoard(); },
  clear: () => { ui.category = 'all'; ui.query = ''; search.value = ''; renderBoard(); search.focus(); },
  'my-role': button => { ui.myRole = button.dataset.value; renderMine(); },
  'clear-mine': () => { ui.myStatus = 'all'; $('#mine-status').value = 'all'; renderMine(); $('#mine-status').focus(); },
  'go-board': () => { location.hash = '#tasks'; },
  person: button => selectPerson(button.dataset.value),
  binding: button => openBinding(button.dataset.value),
  'binding-back': () => {
    if (modal.stage !== 'overview' && modal.target) openBinding('overview');
    else dialog.close();
  },
  'gate-accept': () => openBinding('overview', { type: 'detail', id: modal.id }),
  'resume-task': resumeTask,
  'sample-email': () => {
    const input = $('#student-form input[name="mailbox"]');
    input.value = demoMailbox(person);
    input.focus();
  },
  'new-code': () => requestBindingCode(demoMailbox(person)),
  'ask-disconnect': () => replaceDialog({ ...modal, disconnect: true }),
  disconnect: () => changeBinding(modal.stage, false),
  accept: () => updateTask('accept'),
  complete: () => updateTask('complete'),
  cancel: () => updateTask('cancel'),
  withdraw: () => updateTask('withdraw'),
};

const stages = { delivery: 'delivery', 'ask-cancel': 'cancel', 'ask-withdraw': 'withdraw', stay: '' };

document.addEventListener('click', event => {
  const target = event.target;
  if (!accountPanel.hidden && !target.closest('.account')) toggleAccount(false);
  const button = target.closest('[data-action]');
  if (!button || saving) return;
  const action = button.dataset.action;
  if (Object.hasOwn(stages, action)) {
    modal.stage = stages[action];
    modal.notice = '';
    renderDialog();
    if (action === 'delivery') $('#delivery-form textarea').focus();
    else refocusDialog();
    return;
  }
  actions[action]?.(button);
});

document.addEventListener('submit', event => {
  const form = event.target;
  if (!['publish-form', 'delivery-form', 'student-form', 'sesame-form'].includes(form.id)) return;
  event.preventDefault();
  if (saving) return;
  const values = Object.fromEntries(new FormData(form));
  if (form.id === 'student-form') {
    if (modal.challenge) changeBinding('student', true, values.code);
    else requestBindingCode(values.mailbox);
    return;
  }
  if (form.id === 'sesame-form') {
    if (values.consent === 'on') changeBinding('sesame', true);
    return;
  }
  if (form.id === 'delivery-form') {
    if (!values.delivery.trim()) { showFormError('请填写交付说明。'); return; }
    updateTask('submit', values.delivery);
    return;
  }
  const id = globalThis.crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
  mutateTasks(current => {
    requireVerifiedIdentity();
    return [createTask(values, person, id), ...current];
  }, partial => {
    ui.category = 'all';
    ui.query = '';
    search.value = '';
    ui.sort = 'latest';
    $('#task-sort').value = 'latest';
    renderBoard();
    dialog.close();
    location.hash = '#tasks';
    showToast(partial || '任务已发布，同学可以在广场接单。');
  });
});

document.addEventListener('change', event => {
  const input = event.target;
  if (input.form?.id === 'publish-form' && (input.name === 'category' || input.name === 'mode')) {
    updatePublishFields(input);
  }
});

accountButton.addEventListener('click', () => toggleAccount(accountPanel.hidden));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !accountPanel.hidden) {
    toggleAccount(false);
    accountButton.focus();
  }
});
dialog.addEventListener('cancel', event => {
  if (saving) event.preventDefault();
});
dialog.addEventListener('close', () => {
  if (opener && !opener.isConnected) {
    const replacement = [...document.querySelectorAll('button[data-action="detail"], #identity-content button')]
      .find(button => button.dataset.action === opener.dataset.action && button.dataset.id === opener.dataset.id &&
        button.dataset.value === opener.dataset.value && button.offsetParent !== null);
    (replacement ?? $('#main-content')).focus({ preventScroll: true });
  }
  modal = undefined;
});
$('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  $('#main-content').focus();
  $('#main-content').scrollIntoView();
});

search.addEventListener('input', () => { ui.query = search.value; renderBoard(); });
$('#task-sort').addEventListener('change', event => { ui.sort = event.target.value; renderBoard(); });
$('#mine-status').addEventListener('change', event => { ui.myStatus = event.target.value; renderMine(); });
window.addEventListener('hashchange', () => renderPage(true));
window.addEventListener('storage', event => {
  if (event.key === TASKS_KEY) tasks = restoreTasks();
  else if (event.key === BINDINGS_KEY) bindings = restoreBindings();
  else return;
  renderData();
  if (event.key === BINDINGS_KEY && dialog.open && (modal.stage === 'overview' || (modal.type === 'detail' && !modal.stage))) {
    renderDialog();
  }
});
window.setInterval(() => {
  if (document.activeElement?.closest('.task-card')) return;
  renderBoard();
  renderMine();
}, MINUTE);

for (const element of document.querySelectorAll('[data-icon]')) element.innerHTML = icon(element.dataset.icon);
setTasks(restoreTasks());
bindings = restoreBindings();
person = readPerson();
renderAccount();
renderData();
renderPage();
