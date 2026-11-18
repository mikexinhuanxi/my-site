const ORDER_KEY = 'dabashou.print-orders.v1';
const MAX_PDF_BYTES = 512 * 1024;
const DEMO_TEXT = '校园志愿活动准备清单\n\n1. 活动签到表\n2. 分组名单和场地安排\n3. 现场物资交接表';
const SHOPS = ['文华楼一楼打印店', '学生活动中心打印点'];
const ACTIVE_TASK_STATES = new Set(['open', 'active', 'review']);
const money = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' });

function integerInRange(value, max) {
  const result = Number(value);
  return Number.isInteger(result) && result >= 1 && result <= max ? result : null;
}

function priceInCents(pages, copies, ink) {
  return pages * copies * (ink === 'color' ? 100 : 20);
}

function readPdf(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      resolve({ type: 'pdf', filename: file.name.slice(0, 110), base64: String(reader.result).split(',')[1] });
    }, { once: true });
    reader.addEventListener('error', () => reject(new Error('无法读取 PDF，请重新选择文件。')), { once: true });
    reader.readAsDataURL(file);
  });
}

async function getPrintContent(values) {
  if (values.get('source') === 'pdf') {
    const file = values.get('pdf');
    if (!file?.size || file.size > MAX_PDF_BYTES) throw new Error('请选择 512 KB 以内的 PDF 文件。');
    if ((await file.slice(0, 5).text()) !== '%PDF-') throw new Error('请上传有效的 PDF 文件。');
    return readPdf(file);
  }
  const content = String(values.get('text') ?? '').trim();
  if (!content || content.length > 4000) throw new Error('请输入 1–4000 字的打印内容。');
  return { type: 'text', text: content };
}

async function readOrder(values, owner, id) {
  const title = String(values.get('title') ?? '').trim();
  const shop = values.get('shop');
  const pages = integerInRange(values.get('pages'), 50);
  const copies = integerInRange(values.get('copies'), 20);
  if (!title || title.length > 42) throw new Error('请填写 42 字以内的订单名称。');
  if (!SHOPS.includes(shop)) throw new Error('请选择取件打印点。');
  if (pages === null || copies === null) throw new Error('页数需为 1–50，份数需为 1–20。');
  const ink = values.get('ink') === 'color' ? 'color' : 'mono';
  return {
    id, owner, title, shop, pages, copies, ink, duplex: values.get('sides') === 'double',
    content: await getPrintContent(values),
    price: priceInCents(pages, copies, ink),
    status: 'queued',
    createdAt: Date.now(),
  };
}

function orderState(order, tasks, taskStatus) {
  const linked = tasks.filter(task => task.printOrderId === order.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(task => ({ task, status: taskStatus(task) }));
  if (order.status === 'collected' || linked.some(entry => entry.status === 'completed')) {
    return { type: 'collected', label: '已取件', tone: 'completed' };
  }
  const active = linked.find(entry => ACTIVE_TASK_STATES.has(entry.status));
  if (active) {
    const tag = {
      open: { label: '等待同学接单', tone: 'open' },
      active: { label: '同学代取中', tone: 'active' },
      review: { label: '代取待确认', tone: 'review' },
    }[active.status];
    return { type: 'delegated', ...tag, runner: active.task.assignee };
  }
  if (order.status === 'queued') return { type: 'queued', label: '待打印', tone: 'open' };
  return { type: 'ready', label: '待取件', tone: 'review', previous: linked[0]?.status };
}

export function createPrinting(services) {
  const {
    root, getPerson, people, isStudentVerified, requireStudent, readStorage, writeStorage,
    runTransaction, notify, escapeHtml, icon, clockLabel, localInputValue, getTasks,
    taskStatus, publishPickup, newId,
  } = services;
  let viewer;
  let pickupId = null;
  let busy = false;

  root.innerHTML = `
    <div class="print-layout">
      <section class="panel print-panel print-compose" aria-labelledby="print-compose-title">
        <header class="print-heading">
          <span class="print-emblem">${icon('printer')}</span>
          <div><h2 id="print-compose-title">新建打印订单</h2><p>选择打印内容和校内取件点。</p></div>
          <button type="button" class="plain-button print-sample" data-print-action="sample">填入示例文字</button>
        </header>
        <div class="print-auth" data-print-auth hidden>
          ${icon('mail')}<span>验证学生邮箱后即可下单。</span><a href="#credit">去验证${icon('arrow')}</a>
        </div>
        <form data-print-form="order" class="print-form">
          <label class="print-field"><span>订单名称</span><input name="title" maxlength="42" required placeholder="例如 课程讲义"></label>
          <fieldset class="print-source-switch">
            <legend>打印内容</legend>
            <div class="print-source-options">
              <label><input type="radio" name="source" value="text" checked><span>粘贴文字</span></label>
              <label><input type="radio" name="source" value="pdf"><span>上传 PDF</span></label>
            </div>
          </fieldset>
          <label class="print-field" data-print-source="text"><span class="visually-hidden">打印文字</span><textarea name="text" rows="5" maxlength="4000" required placeholder="粘贴要打印的内容"></textarea></label>
          <label class="print-field print-upload" data-print-source="pdf" hidden><span>PDF 文件</span><input type="file" name="pdf" accept=".pdf,application/pdf" disabled><small>支持 512 KB 以内的文件。</small></label>
          <label class="print-field"><span>取件打印点</span><select name="shop">${SHOPS.map(shop => `<option>${escapeHtml(shop)}</option>`).join('')}</select></label>
          <div class="print-fields">
            <label class="print-field"><span>页数</span><input type="number" name="pages" min="1" max="50" step="1" value="1" required></label>
            <label class="print-field"><span>份数</span><input type="number" name="copies" min="1" max="20" step="1" value="1" required></label>
            <label class="print-field"><span>色彩</span><select name="ink"><option value="mono">黑白</option><option value="color">彩色</option></select></label>
            <label class="print-field"><span>版式</span><select name="sides"><option value="single">单面 A4</option><option value="double">双面 A4</option></select></label>
          </div>
          <p class="print-error" data-print-error role="alert" hidden></p>
          <div class="print-form-footer">
            <div class="print-quote"><span>预计打印费</span><output data-print-quote></output></div>
            <button type="submit" class="button primary">提交打印订单</button>
          </div>
          <p class="print-note">按页估算费用，打印内容保存在当前浏览器。</p>
        </form>
      </section>
      <section class="print-orders" aria-labelledby="print-orders-title">
        <header class="print-orders-heading"><h2 id="print-orders-title">我的打印订单</h2><span data-print-count></span></header>
        <p class="print-error print-orders-error" data-print-orders-error role="alert" hidden></p>
        <form class="panel print-panel print-form print-pickup" data-print-form="pickup" hidden>
          <header class="print-heading">
            <span class="print-emblem">${icon('package')}</span>
            <div><h3>发布代取打印件任务</h3><p data-print-pickup-label></p></div>
          </header>
          <label class="print-field"><span>交接地点</span><input name="destination" maxlength="36" placeholder="例如 松柏苑 6 栋" required></label>
          <div class="print-fields">
            <label class="print-field"><span>感谢费（元）</span><input name="reward" type="number" min="0" max="500" step="0.01" value="3" required></label>
            <label class="print-field"><span>截止时间</span><input name="deadline" type="datetime-local" required></label>
          </div>
          <p class="print-error" data-print-error role="alert" hidden></p>
          <div class="print-controls">
            <button type="button" class="button secondary" data-print-action="cancel-pickup">取消</button>
            <button type="submit" class="button primary">发布代取任务</button>
          </div>
        </form>
        <div class="print-order-list" data-print-list></div>
      </section>
    </div>`;

  const form = root.querySelector('[data-print-form="order"]');
  const pickupForm = root.querySelector('[data-print-form="pickup"]');
  const list = root.querySelector('[data-print-list]');
  const auth = root.querySelector('[data-print-auth]');
  const quote = root.querySelector('[data-print-quote]');
  const ordersError = root.querySelector('[data-print-orders-error]');

  function loadOrders() {
    const saved = readStorage(ORDER_KEY, []);
    return Array.isArray(saved) ? saved : [];
  }

  function saveOrders(next) {
    return writeStorage(ORDER_KEY, next);
  }

  function findOrder(id, actor, orders) {
    const order = orders.find(item => item.id === id && item.owner === actor);
    if (!order) throw new Error('找不到当前身份的打印订单。');
    return order;
  }

  function setError(target, message = '') {
    target.textContent = message;
    target.hidden = !message;
  }

  function syncForm() {
    const isPdf = form.elements.source.value === 'pdf';
    for (const wrapper of form.querySelectorAll('[data-print-source]')) {
      const visible = (wrapper.dataset.printSource === 'pdf') === isPdf;
      const input = wrapper.querySelector('input, textarea');
      wrapper.hidden = !visible;
      input.disabled = !visible;
      input.required = visible;
    }
    const pages = integerInRange(form.elements.pages.value, 50);
    const copies = integerInRange(form.elements.copies.value, 20);
    quote.value = pages === null || copies === null ? '—' : money.format(priceInCents(pages, copies, form.elements.ink.value) / 100);
  }

  function endPickup() {
    pickupId = null;
    pickupForm.hidden = true;
    pickupForm.reset();
    setError(pickupForm.querySelector('[data-print-error]'));
  }

  function printContent(content) {
    if (content?.type === 'text') return `<pre>${escapeHtml(content.text)}</pre>`;
    if (content?.type === 'pdf' && /^[A-Za-z0-9+/]+={0,2}$/.test(content.base64 ?? '')) {
      return `<a class="button secondary" href="data:application/pdf;base64,${content.base64}" download="${escapeHtml(content.filename)}">下载 PDF 原件</a>`;
    }
    return '<p>当前内容不可读取。</p>';
  }

  function orderCard(order, state, opened) {
    const controls = {
      queued: `<button type="button" class="button secondary" data-print-action="ready" data-order="${escapeHtml(order.id)}">模拟打印完成</button>`,
      ready: `<button type="button" class="button secondary" data-print-action="collect" data-order="${escapeHtml(order.id)}">本人确认取件</button>
        <button type="button" class="button primary" data-print-action="start-pickup" data-order="${escapeHtml(order.id)}">请同学代取</button>`,
      delegated: '<a class="button secondary" href="#mine">去我的任务</a>',
      collected: '',
    }[state.type];
    const taskCopy = {
      cancelled: '上次代取任务已取消，可再次发布。',
      expired: '上次代取任务已过期，可再次发布。',
      no_show: '上次代取任务已爽约，可再次发布。',
    }[state.previous];
    const linkedNote = state.type === 'delegated'
      ? `${state.runner ? `${escapeHtml(people[state.runner]?.name || '同学')}已接单。` : ''}可在「我的任务」的「我发布的」跟进。`
      : taskCopy;
    const specs = `${order.pages} 页 · ${order.copies} 份 · ${order.ink === 'color' ? '彩色' : '黑白'} · ${order.duplex ? '双面' : '单面'} A4`;
    return `<article class="panel print-panel print-order" data-print-order-card="${escapeHtml(order.id)}" tabindex="-1">
      <div class="print-order-head">
        <div><h3>${escapeHtml(order.title)}</h3><p>${escapeHtml(clockLabel(order.createdAt))}</p></div>
        <span class="tag status-${state.tone}"><span></span>${state.label}</span>
      </div>
      <div class="print-order-facts">
        <div><span>${icon('pin')}${escapeHtml(order.shop)}</span><p>${escapeHtml(specs)}</p></div>
        <strong>${money.format(order.price / 100)}</strong>
      </div>
      <details class="print-content" data-order="${escapeHtml(order.id)}" ${opened ? 'open' : ''}>
        <summary>查看打印内容</summary>
        <div>${printContent(order.content)}</div>
      </details>
      ${linkedNote ? `<p class="print-note">${linkedNote}</p>` : ''}
      ${controls ? `<div class="print-controls">${controls}</div>` : ''}
    </article>`;
  }

  function refresh() {
    const actor = getPerson();
    if (viewer !== actor) {
      viewer = actor;
      form.reset();
      endPickup();
      setError(form.querySelector('[data-print-error]'));
      setError(ordersError);
    }
    const verified = isStudentVerified();
    auth.hidden = verified;
    form.querySelector('button[type="submit"]').disabled = busy || !verified;
    pickupForm.querySelector('button[type="submit"]').disabled = busy || !verified;
    syncForm();

    const tasks = getTasks();
    const orders = loadOrders().filter(order => order?.owner === actor && Number.isFinite(order.createdAt))
      .sort((a, b) => b.createdAt - a.createdAt);
    const states = orders.map(order => ({ order, state: orderState(order, tasks, taskStatus) }));
    if (pickupId && !states.some(({ order, state }) => order.id === pickupId && state.type === 'ready')) endPickup();
    const opened = new Set([...list.querySelectorAll('details[open]')].map(details => details.dataset.order));
    root.querySelector('[data-print-count]').textContent = `${orders.length} 笔订单`;
    list.innerHTML = states.length
      ? states.map(({ order, state }) => orderCard(order, state, opened.has(order.id))).join('')
      : `<div class="panel print-empty"><span class="print-emblem">${icon('inbox')}</span><h3>还没有打印订单</h3><p>提交后可在这里查看进度和安排取件。</p></div>`;
  }

  function verifyActor(actor) {
    if (getPerson() !== actor) throw new Error('演示身份已切换，请重新操作。');
  }

  async function operate(actor, target, operation, onSuccess) {
    if (busy) return;
    busy = true;
    form.querySelector('button[type="submit"]').disabled = true;
    pickupForm.querySelector('button[type="submit"]').disabled = true;
    setError(target);
    let focusOrderId;
    try {
      const result = await operation();
      verifyActor(actor);
      focusOrderId = onSuccess(result);
    } catch (error) {
      if (getPerson() === actor) setError(target, error.message || '操作未完成，请重试。');
    } finally {
      busy = false;
      refresh();
      if (focusOrderId) [...list.children].find(card => card.dataset.printOrderCard === focusOrderId)?.focus();
    }
  }

  function storeOrderState(id, actor, action) {
    return runTransaction(() => {
      verifyActor(actor);
      const orders = loadOrders();
      const order = findOrder(id, actor, orders);
      const state = orderState(order, getTasks(), taskStatus);
      const markingReady = action === 'ready';
      if (state.type !== (markingReady ? 'queued' : 'ready')) throw new Error('打印订单状态已更新，请查看订单进度。');
      const change = markingReady
        ? { status: 'ready', readyAt: Date.now() }
        : { status: 'collected', collectedAt: Date.now() };
      return saveOrders(orders.map(item => item.id === id ? { ...item, ...change } : item));
    });
  }

  function startPickup(id, actor) {
    setError(ordersError);
    try {
      requireStudent();
      const order = findOrder(id, actor, loadOrders());
      if (orderState(order, getTasks(), taskStatus).type !== 'ready') {
        throw new Error('打印件就绪且可取件时，才能发布代取。');
      }
      if (pickupId !== id) {
        endPickup();
        pickupId = id;
        pickupForm.elements.deadline.min = localInputValue(Date.now() + 60_000);
        pickupForm.elements.deadline.value = localInputValue(Date.now() + 60 * 60_000);
        pickupForm.querySelector('[data-print-pickup-label]').textContent = `从${order.shop}取件`;
      }
      pickupForm.hidden = false;
      pickupForm.elements.destination.focus();
    } catch (error) {
      setError(ordersError, error.message);
    }
  }

  form.addEventListener('input', syncForm);
  form.addEventListener('change', syncForm);

  root.addEventListener('click', event => {
    const button = event.target.closest('button[data-print-action]');
    if (!button || busy) return;
    const { printAction, order: id } = button.dataset;
    const actor = getPerson();
    if (printAction === 'sample') {
      form.elements.source.value = 'text';
      form.elements.title.value = '校园志愿活动准备清单';
      form.elements.text.value = DEMO_TEXT;
      form.elements.pages.value = '1';
      setError(form.querySelector('[data-print-error]'));
      syncForm();
      form.elements.text.focus();
    } else if (printAction === 'start-pickup') {
      startPickup(id, actor);
    } else if (printAction === 'cancel-pickup') {
      const cancelledId = pickupId;
      endPickup();
      [...list.querySelectorAll('[data-print-action="start-pickup"]')].find(control => control.dataset.order === cancelledId)?.focus();
    } else if (printAction === 'ready' || printAction === 'collect') {
      operate(actor, ordersError, () => storeOrderState(id, actor, printAction), persisted => {
        const message = printAction === 'ready' ? '打印完成，可以安排取件。' : '已确认取件。';
        notify(persisted ? message : '订单已更新，本次更改暂存在当前页面。');
        return id;
      });
    }
  });

  root.addEventListener('submit', event => {
    if (event.target !== form && event.target !== pickupForm) return;
    event.preventDefault();
    if (busy) return;
    const actor = getPerson();
    const values = new FormData(event.target);
    if (event.target === form) {
      operate(actor, form.querySelector('[data-print-error]'), async () => {
        requireStudent();
        const order = await readOrder(values, actor, newId());
        return runTransaction(() => {
          verifyActor(actor);
          requireStudent();
          return { orderId: order.id, persisted: saveOrders([order, ...loadOrders()]) };
        });
      }, ({ orderId, persisted }) => {
        form.reset();
        notify(persisted ? '打印订单已提交。' : '打印订单已提交，暂存在当前页面。');
        return orderId;
      });
    } else {
      const id = pickupId;
      operate(actor, pickupForm.querySelector('[data-print-error]'), () => runTransaction(() => {
        verifyActor(actor);
        requireStudent();
        const order = findOrder(id, actor, loadOrders());
        if (orderState(order, getTasks(), taskStatus).type !== 'ready') throw new Error('打印订单状态已更新，请查看订单进度。');
        return publishPickup(order, Object.fromEntries(values));
      }), ({ persisted }) => {
        endPickup();
        notify(persisted ? '代取任务已发布到任务广场。' : '代取任务已发布，暂存在当前页面。');
        return id;
      });
    }
  });

  window.addEventListener('storage', event => {
    if (event.key === ORDER_KEY && !root.closest('[hidden]')) refresh();
  });

  return { refresh };
}
