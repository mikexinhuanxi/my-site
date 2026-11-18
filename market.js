const MARKET_KEY = 'dabashou.market.v1';
const MAX_IMAGE_BYTES = 280 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CATEGORIES = {
  books: '书籍资料',
  electronics: '数码电器',
  household: '生活用品',
  other: '其他',
};
const CONDITIONS = ['近全新', '九成新', '使用痕迹明显'];
const STATUS = { available: '在售', reserved: '已预约', sold: '已成交', withdrawn: '已下架', cancelled: '已取消预约' };
const currency = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', currencyDisplay: 'narrowSymbol' });

const SAMPLE_LISTINGS = [
  {
    id: 'market-lamp', seller: 'zhou', name: '可充电折叠台灯', category: 'electronics',
    price: 2800, condition: '九成新', location: '松柏苑 6 栋一楼',
    description: '暖白光可调，折叠后能放进书包。附充电线，可以当面试亮。',
    image: './assets/market-lamp.webp',
  },
  {
    id: 'market-books', seller: 'man', name: '高等数学教材（上册）', category: 'books',
    price: 1200, condition: '使用痕迹明显', location: '图书馆一楼大厅',
    description: '封面和内页完整，前两章有铅笔笔记。适合预习或考试复习。',
    image: './assets/market-books.webp',
  },
  {
    id: 'market-cart', seller: 'xu', name: '可折叠宿舍手拉车', category: 'household',
    price: 3500, condition: '近全新', location: '竹苑 2 栋门口',
    description: '搬书和去驿站拿快递都能用，拉杆伸缩顺畅，折起来可立在宿舍门边。',
    image: './assets/market-cart.webp',
  },
];

function availability(listing) {
  if (listing.withdrawnAt) return 'withdrawn';
  const latest = listing.reservations.at(-1);
  if (latest?.status === 'completed') return 'sold';
  return latest?.status === 'reserved' ? 'reserved' : 'available';
}

function readPhoto(file) {
  if (!file?.name) return Promise.resolve(null);
  if (!IMAGE_TYPES.includes(file.type) || !file.size || file.size > MAX_IMAGE_BYTES) {
    throw new Error('请选择 280 KB 以内的 JPG、PNG 或 WebP 图片。');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)), { once: true });
    reader.addEventListener('error', () => reject(new Error('图片读取失败，请重新选择。')), { once: true });
    reader.readAsDataURL(file);
  });
}

function photoSource(value) {
  if (SAMPLE_LISTINGS.some(listing => listing.image === value)) return value;
  return typeof value === 'string' && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : null;
}

function selectedActorReservation(listing, person) {
  return listing.reservations.findLast(reservation => reservation.buyer === person);
}

function nextListing(listing, action, person, now) {
  const status = availability(listing);
  if (action === 'reserve') {
    if (listing.seller === person) throw new Error('请从其他同学发布的商品中选择。');
    if (status !== 'available') throw new Error('商品状态已更新，请返回商品列表。');
    return { ...listing, reservations: [...listing.reservations, { buyer: person, status: 'reserved', at: now }] };
  }
  if (action === 'withdraw') {
    if (status !== 'available' || listing.seller !== person) throw new Error('只有卖家可以下架在售商品。');
    return { ...listing, withdrawnAt: now };
  }
  const latest = listing.reservations.at(-1);
  if (status !== 'reserved' || latest?.buyer !== person) throw new Error('这笔预约的状态已更新。');
  return {
    ...listing,
    reservations: [
      ...listing.reservations.slice(0, -1),
      { ...latest, status: action === 'receive' ? 'completed' : 'cancelled', finishedAt: now },
    ],
  };
}

export function createMarket(services) {
  const {
    root, getPerson, people, isStudentVerified, requireStudent, readStorage, writeStorage,
    runTransaction, notify, escapeHtml, icon, clockLabel, newId,
  } = services;
  const categoryOptions = Object.entries(CATEGORIES).map(([value, name]) => `<option value="${value}">${name}</option>`).join('');
  const statusLabels = { reserve: '预约成功，请与卖家当面交接。', receive: '已确认收货。', cancel: '预约已取消。', withdraw: '商品已下架。' };
  const sampleTime = Date.now();
  const demoListings = SAMPLE_LISTINGS.map((listing, index) => ({
    ...listing, reservations: [], createdAt: sampleTime - index * 15 * 60_000,
  }));
  let viewer = getPerson();
  let view = 'browse';
  let selectedListing = null;
  let busy = false;

  root.innerHTML = `
    <div class="market-toolbar">
      <div class="filter-list" role="group" aria-label="商品视图">
        <button class="filter-chip" type="button" data-market-action="browse" aria-pressed="true">全部商品</button>
        <button class="filter-chip" type="button" data-market-action="mine" aria-pressed="false">我的交易</button>
      </div>
      <button class="button primary" type="button" data-market-action="publish">${icon('plus')}发布闲置</button>
    </div>
    <div class="market-filters">
      <label class="search-field">
        ${icon('search')}<span class="visually-hidden">搜索商品</span>
        <input type="search" placeholder="搜索商品或交接地点" maxlength="60" data-market-search>
      </label>
      <label class="sort-field">
        <span class="visually-hidden">商品类别</span>
        <select data-market-category><option value="">全部类别</option>${categoryOptions}</select>
        <span class="market-filter-arrow">${icon('chevron')}</span>
      </label>
    </div>
    <p class="market-count" aria-live="polite" data-market-count></p>
    <div class="market-grid" data-market-grid></div>
    <dialog class="dialog market-dialog" aria-labelledby="market-dialog-title"></dialog>
  `;
  const grid = root.querySelector('[data-market-grid]');
  const search = root.querySelector('[data-market-search]');
  const category = root.querySelector('[data-market-category]');
  const dialog = root.querySelector('.market-dialog');

  function getListings() {
    const saved = readStorage(MARKET_KEY, demoListings);
    if (Array.isArray(saved) && saved.every(listing => listing && typeof listing.id === 'string' &&
      Object.hasOwn(people, listing.seller) && Object.hasOwn(CATEGORIES, listing.category) &&
      Number.isInteger(listing.price) && listing.price >= 0 && Number.isFinite(listing.createdAt) &&
      Array.isArray(listing.reservations) && listing.reservations.every(reservation =>
        reservation && Object.hasOwn(people, reservation.buyer) && Number.isFinite(reservation.at)))) {
      return saved;
    }
    return demoListings;
  }

  function saveListings(next, message) {
    return writeStorage(MARKET_KEY, next) ? message : `${message} 本次更新保留在当前页面。`;
  }

  function imageOf(listing) {
    const src = photoSource(listing.image);
    return src
      ? `<div class="market-photo"><img src="${escapeHtml(src)}" alt="" loading="lazy"></div>`
      : `<div class="market-photo market-photo-empty">${icon('bag')}</div>`;
  }

  function priceOf(listing) {
    return listing.price === 0 ? '免费' : currency.format(listing.price / 100);
  }

  function statusOf(listing, person, personalView) {
    if (!personalView || listing.seller === person) return availability(listing);
    const reservation = selectedActorReservation(listing, person);
    if (reservation?.status === 'cancelled') return 'cancelled';
    return reservation?.status === 'completed' ? 'sold' : availability(listing);
  }

  function statusTag(status) {
    return `<span class="market-status market-status-${status}">${STATUS[status]}</span>`;
  }

  function card(listing, person) {
    const own = listing.seller === person;
    const role = view === 'mine' ? (own ? '我发布的' : '我的预约') : people[listing.seller].name;
    return `
      <article class="panel market-card">
        ${imageOf(listing)}
        <div class="market-card-body">
          <div class="market-card-top"><span>${CATEGORIES[listing.category]}</span>${statusTag(statusOf(listing, person, view === 'mine'))}</div>
          <h2>${escapeHtml(listing.name)}</h2>
          <div class="market-price-row"><strong>${priceOf(listing)}</strong><span>${escapeHtml(listing.condition)}</span></div>
          <p class="market-location">${icon('pin')}<span>${escapeHtml(listing.location)}</span></p>
          <div class="market-card-bottom">
            <span>${role}</span>
            <button class="button card-button" type="button" data-market-action="detail" data-id="${escapeHtml(listing.id)}" aria-label="查看详情 ${escapeHtml(listing.name)}">查看详情${icon('arrow')}</button>
          </div>
        </div>
      </article>`;
  }

  function renderListings() {
    const person = getPerson();
    const keyword = search.value.trim().toLowerCase();
    const selectedCategory = category.value;
    const filtered = getListings().filter(listing => {
      const inView = view === 'mine'
        ? listing.seller === person || selectedActorReservation(listing, person)
        : availability(listing) === 'available';
      const inCategory = !selectedCategory || listing.category === selectedCategory;
      const searchable = `${listing.name} ${listing.description} ${listing.location}`.toLowerCase();
      return inView && inCategory && searchable.includes(keyword);
    }).sort((a, b) => b.createdAt - a.createdAt);
    root.querySelector('[data-market-action="mine"]').setAttribute('aria-pressed', String(view === 'mine'));
    root.querySelector('[data-market-action="browse"]').setAttribute('aria-pressed', String(view === 'browse'));
    root.querySelector('[data-market-count]').textContent = `${filtered.length} ${view === 'mine' ? '条交易记录' : '件在售商品'}`;
    if (filtered.length) {
      grid.innerHTML = filtered.map(listing => card(listing, person)).join('');
      return;
    }
    const emptyMessage = keyword || selectedCategory ? '没有符合条件的商品。' : view === 'mine' ? '暂无交易记录。' : '暂无在售商品。';
    const emptyAction = keyword || selectedCategory
      ? '<button class="button secondary" type="button" data-market-action="clear">清除筛选</button>'
      : view === 'mine' ? '<button class="button secondary" type="button" data-market-action="browse">浏览商品</button>' : '';
    grid.innerHTML = `<div class="empty-state">${icon('bag')}<p>${emptyMessage}</p>${emptyAction}</div>`;
  }

  function showDialog(title, contents) {
    dialog.innerHTML = `
      <div class="dialog-header">
        <div class="dialog-title-group"><h2 id="market-dialog-title" tabindex="-1">${escapeHtml(title)}</h2></div>
        <button class="icon-button" type="button" data-market-action="close" aria-label="关闭">${icon('close')}</button>
      </div>
      ${contents}
    `;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('#market-dialog-title').focus();
  }

  function showVerification() {
    selectedListing = null;
    showDialog('验证学生邮箱', `
      <div class="dialog-scroll"><p>验证学生邮箱后即可发布闲置和预约购买。</p></div>
      <div class="dialog-footer"><button class="button secondary" type="button" data-market-action="close">返回</button>
        <a class="button primary" href="#credit" data-market-action="close">去验证</a></div>
    `);
  }

  function showPublish() {
    selectedListing = null;
    showDialog('发布闲置', `
      <form class="dialog-form" data-market-form>
        <div class="dialog-scroll market-edit">
          <label class="form-field"><span>商品名称</span><input name="name" maxlength="45" placeholder="例如 可折叠宿舍台灯" required></label>
          <div class="field-grid">
            <label class="form-field"><span>商品类别</span><select name="category" required>${categoryOptions}</select></label>
            <label class="form-field"><span>成色</span><select name="condition" required>${CONDITIONS.map(value => `<option>${value}</option>`).join('')}</select></label>
          </div>
          <div class="field-grid">
            <label class="form-field"><span>价格（元）</span><input type="number" name="price" min="0" max="9999.99" step="0.01" inputmode="decimal" placeholder="0.00" required></label>
            <label class="form-field"><span>交接地点</span><input name="location" maxlength="42" placeholder="例如 松柏苑 6 栋一楼" required></label>
          </div>
          <label class="form-field"><span>商品描述</span><textarea name="description" maxlength="360" rows="3" placeholder="填写使用情况、配件或交接要求" required></textarea></label>
          <label class="form-field market-file"><span>商品图片（选填）</span><input type="file" name="photo" accept="image/jpeg,image/png,image/webp"><small>JPG、PNG 或 WebP，最大 280 KB。</small></label>
        </div>
        <div class="dialog-footer">
          <p class="form-error" data-market-error role="alert" hidden></p>
          <button class="button secondary" type="button" data-market-action="close">取消</button>
          <button class="button primary" type="submit">确认发布</button>
        </div>
      </form>
    `);
    dialog.querySelector('[name="name"]').focus();
  }

  function actionButtons(listing, person) {
    const status = availability(listing);
    if (status === 'available') {
      return listing.seller === person
        ? '<button class="button secondary" type="button" data-market-action="withdraw">下架商品</button>'
        : '<button class="button primary" type="button" data-market-action="reserve">预约购买</button>';
    }
    if (status === 'reserved' && listing.reservations.at(-1)?.buyer === person) {
      return '<button class="button secondary" type="button" data-market-action="cancel">取消预约</button><button class="button primary" type="button" data-market-action="receive">确认收货</button>';
    }
    return '<button class="button secondary" type="button" data-market-action="close">关闭详情</button>';
  }

  function historyOf(listing, person) {
    const own = listing.seller === person;
    const history = listing.reservations.filter(reservation => own || reservation.buyer === person).flatMap(reservation => {
      const name = own ? people[reservation.buyer].name : '我';
      const events = [{ label: `${name}预约购买`, date: reservation.at }];
      if (reservation.finishedAt) {
        const label = reservation.status === 'completed' ? '确认收货' : '取消预约';
        events.push({ label: name + label, date: reservation.finishedAt });
      }
      return events;
    });
    if (own && listing.withdrawnAt) history.push({ label: '我下架了商品', date: listing.withdrawnAt });
    if (!history.length) return '';
    return `<section class="market-history"><h3>交易记录</h3><ul>${history.sort((a, b) => b.date - a.date).map(event => `
      <li><span>${event.label}</span><time>${clockLabel(event.date)}</time></li>`).join('')}</ul></section>`;
  }

  function showDetail(listing) {
    selectedListing = listing.id;
    const person = getPerson();
    showDialog(listing.name, `
      <div class="dialog-scroll market-detail">
        ${imageOf(listing)}
        <div class="market-detail-top">
          <strong class="market-detail-price">${priceOf(listing)}</strong>
          ${statusTag(statusOf(listing, person, Boolean(selectedActorReservation(listing, person))))}
        </div>
        <dl class="market-facts">
          <div><dt>卖家</dt><dd>${people[listing.seller].name}</dd></div>
          <div><dt>成色</dt><dd>${escapeHtml(listing.condition)}</dd></div>
          <div class="market-fact-location"><dt>交接地点</dt><dd>${escapeHtml(listing.location)}</dd></div>
        </dl>
        <div class="market-description"><h3>商品描述</h3><p>${escapeHtml(listing.description)}</p></div>
        ${historyOf(listing, person)}
        <p class="market-handoff">${icon('info')}<span>预约后在校内当面交接，收到商品后确认收货。金额仅供演示。</span></p>
      </div>
      <div class="dialog-footer"><p class="form-error" data-market-error role="alert" hidden></p>${actionButtons(listing, person)}</div>
    `);
  }

  function refresh() {
    const person = getPerson();
    if (viewer !== person) {
      viewer = person;
      selectedListing = null;
      if (dialog.open) dialog.close();
    }
    renderListings();
  }

  async function operate(actor, operation, onSuccess) {
    if (busy) return;
    busy = true;
    dialog.setAttribute('aria-busy', 'true');
    dialog.querySelectorAll('button').forEach(button => { button.disabled = true; });
    const error = dialog.querySelector('[data-market-error]');
    if (error) error.hidden = true;
    try {
      const result = await operation();
      if (actor === getPerson()) {
        if (!root.closest('[hidden]')) onSuccess(result);
        notify(result.message);
      }
    } catch (failure) {
      if (error && actor === getPerson() && error.isConnected) {
        error.textContent = failure.message;
        error.hidden = false;
      }
    } finally {
      busy = false;
      dialog.removeAttribute('aria-busy');
      dialog.querySelectorAll('button').forEach(button => { button.disabled = false; });
    }
  }

  async function publishDraft(form, actor) {
    const fields = new FormData(form);
    const name = String(fields.get('name') ?? '').trim();
    const location = String(fields.get('location') ?? '').trim();
    const description = String(fields.get('description') ?? '').trim();
    const price = fields.get('price');
    const cents = Number(price) * 100;
    const itemCategory = fields.get('category');
    const condition = fields.get('condition');
    if (!name || name.length > 45 || !location || location.length > 42 || !description || description.length > 360) {
      throw new Error('请填写商品名称、交接地点和商品描述。');
    }
    if (!Object.hasOwn(CATEGORIES, itemCategory) || !CONDITIONS.includes(condition)) throw new Error('请选择类别和成色。');
    if (!price || !Number.isFinite(cents) || cents < 0 || cents > 999999 || Math.abs(cents - Math.round(cents)) > 1e-7) {
      throw new Error('价格须在 0 至 9999.99 元之间，最多保留两位小数。');
    }
    const image = await readPhoto(fields.get('photo'));
    return runTransaction(() => {
      if (actor !== getPerson()) throw new Error('演示身份已切换。');
      requireStudent();
      const listing = {
        id: newId(), seller: actor, name, category: itemCategory, condition, location, description,
        price: Math.round(cents), image, reservations: [], createdAt: Date.now(),
      };
      return { message: saveListings([listing, ...getListings()], '闲置商品已发布。') };
    });
  }

  root.addEventListener('input', event => {
    if (event.target === search) renderListings();
  });
  root.addEventListener('change', event => {
    if (event.target === category) renderListings();
  });
  root.addEventListener('submit', event => {
    if (!event.target.matches('[data-market-form]')) return;
    event.preventDefault();
    const actor = getPerson();
    operate(actor, () => publishDraft(event.target, actor), () => {
      dialog.close();
      view = 'mine';
      search.value = '';
      category.value = '';
      renderListings();
      root.querySelector('[data-market-action="mine"]').focus();
    });
  });
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-market-action]');
    if (!button || busy) return;
    const action = button.dataset.marketAction;
    if (action === 'close') {
      dialog.close();
      return;
    }
    if (action === 'browse' || action === 'mine' || action === 'clear') {
      if (action !== 'clear') view = action;
      search.value = '';
      category.value = '';
      renderListings();
      return;
    }
    if (action === 'publish') {
      if (isStudentVerified()) showPublish();
      else showVerification();
      return;
    }
    if (action === 'detail') {
      const listing = getListings().find(entry => entry.id === button.dataset.id);
      if (listing) showDetail(listing);
      return;
    }
    if (!Object.hasOwn(statusLabels, action) || !selectedListing) return;
    if (action === 'reserve' && !isStudentVerified()) {
      showVerification();
      return;
    }
    const actor = getPerson();
    const itemId = selectedListing;
    operate(actor, () => runTransaction(() => {
      if (actor !== getPerson()) throw new Error('演示身份已切换。');
      if (action === 'reserve') requireStudent();
      const current = getListings();
      const listing = current.find(entry => entry.id === itemId);
      if (!listing) throw new Error('商品状态已更新，请返回商品列表。');
      const updated = nextListing(listing, action, actor, Date.now());
      return { listing: updated, message: saveListings(current.map(entry => entry.id === itemId ? updated : entry), statusLabels[action]) };
    }), ({ listing }) => {
      renderListings();
      showDetail(listing);
    });
  });
  dialog.addEventListener('cancel', event => {
    if (busy) event.preventDefault();
  });
  dialog.addEventListener('close', () => {
    selectedListing = null;
    if (!root.closest('[hidden]') && !root.contains(document.activeElement)) {
      if (document.activeElement === document.body) root.querySelector('[data-market-action="publish"]').focus();
    }
  });
  window.addEventListener('storage', event => {
    if (event.key === MARKET_KEY && !root.closest('[hidden]')) refresh();
  });
  window.addEventListener('hashchange', () => {
    window.requestAnimationFrame(() => {
      if (dialog.open && root.closest('[hidden]')) dialog.close();
    });
  });
  refresh();
  return { refresh };
}
