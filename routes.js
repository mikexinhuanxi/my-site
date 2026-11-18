export const MAX_DETOUR_METERS = 200;
export const EXAMPLE_ROUTE = { from: 'north', to: 'songbai' };

const PLACES = {
  north: ['北门菜鸟驿站', '北门驿站', '北门快递站'],
  canteen: ['二食堂一楼', '二食堂', '第二食堂'],
  wutong: ['梧桐苑 3 栋', '梧桐苑 3 号楼'],
  songbai: ['松柏苑 6 栋', '松柏苑 6 号楼'],
  library: ['图书馆二楼', '图书馆 2 楼', '图书馆'],
  wenhua: ['文华楼一楼', '文华楼 1 楼', '文华楼'],
  east: ['东门快递站', '东门驿站'],
  activity: ['学生活动中心 102', '学生活动中心'],
  gym: ['体育馆南门', '体育馆'],
  shop: ['学苑超市'],
  design: ['设计楼门厅', '设计楼'],
  south: ['南门快递站', '南门驿站'],
  bamboo: ['竹苑 2 栋', '竹苑 2 号楼'],
};

export const CAMPUS_STOPS = Object.fromEntries(
  Object.entries(PLACES).map(([id, [label]]) => [id, label]),
);

// Walking distances in meters for the fictional Donghu campus.
const PATHS = [
  ['north', 'canteen', 220],
  ['canteen', 'wutong', 270],
  ['wutong', 'songbai', 300],
  ['canteen', 'library', 70],
  ['library', 'wenhua', 315],
  ['wenhua', 'east', 180],
  ['wenhua', 'design', 225],
  ['design', 'shop', 160],
  ['shop', 'south', 290],
  ['south', 'bamboo', 205],
  ['bamboo', 'songbai', 375],
  ['wutong', 'activity', 165],
  ['activity', 'gym', 280],
  ['gym', 'south', 260],
];

const stops = Object.keys(CAMPUS_STOPS);
const distances = Object.fromEntries(stops.map(from => [
  from, Object.fromEntries(stops.map(to => [to, from === to ? 0 : Infinity])),
]));

for (const [from, to, length] of PATHS) {
  distances[from][to] = length;
  distances[to][from] = length;
}
for (const via of stops) {
  for (const from of stops) {
    for (const to of stops) {
      distances[from][to] = Math.min(distances[from][to], distances[from][via] + distances[via][to]);
    }
  }
}

function normalizePlace(label) {
  return String(label ?? '').normalize('NFKC').replace(/[\s·・]+/g, '');
}

const aliases = Object.entries(PLACES)
  .flatMap(([id, labels]) => labels.map(label => [id, normalizePlace(label)]))
  .sort((a, b) => b[1].length - a[1].length);

function stopFor(label) {
  const text = normalizePlace(label);
  return aliases.find(([, alias]) => text.startsWith(alias))?.[0];
}

export function selectRoute(from, to) {
  if (!Object.hasOwn(CAMPUS_STOPS, from) || !Object.hasOwn(CAMPUS_STOPS, to)) {
    throw new Error('请选择校区内的起点和终点。');
  }
  if (from === to) throw new Error('起点和终点需要选择不同地点。');
  return { from, to, meters: distances[from][to] };
}

export function taskDetour(route, task) {
  const pickup = stopFor(task.origin);
  const delivery = task.category === 'seat' ? pickup : stopFor(task.destination);
  if (!pickup || !delivery) return null;

  const { from, to, meters } = route;
  const orderedDistance = distances[from][pickup] + distances[pickup][delivery] + distances[delivery][to];
  const reversedDistance = distances[from][delivery] + distances[delivery][pickup] + distances[pickup][to];
  const extra = orderedDistance - meters;
  // Requiring the delivery order to be at least as direct rules out backtracking jobs.
  return orderedDistance <= reversedDistance && extra <= MAX_DETOUR_METERS ? extra : null;
}

export function seedRouteTasks(now = Date.now()) {
  function sample(stop, author, title, details) {
    return {
      id: `route-sample-${stop}`, status: 'open', author, title,
      createdAt: now - 90 * 60_000, dueAt: Math.floor((now + 7 * 86_400_000) / 60_000) * 60_000,
      ...details,
    };
  }

  function pickup(stop, author, title, pickupPoint, meetingPoint, reward) {
    const place = CAMPUS_STOPS[stop];
    return sample(stop, author, title, {
      category: 'pickup', reward, origin: place + pickupPoint, destination: place + meetingPoint,
      quantity: 1, size: '小件', code: `DEMO-${stop.toUpperCase()}`, notes: '一件小包裹，取好后在约定地点碰面。',
    });
  }

  function buy(stop, author, title, shop, meetingPoint, item, budget) {
    const place = CAMPUS_STOPS[stop];
    return sample(stop, author, title, {
      category: 'buy', reward: 3, origin: place + shop, destination: place + meetingPoint,
      item, budget, quantity: 1, notes: '请按规格购买，缺货时在交付说明里告知。',
    });
  }

  function seat(stop, author, title, zone) {
    return sample(stop, author, title, {
      category: 'seat', reward: 2, origin: `${CAMPUS_STOPS[stop]} · ${zone}`,
      mode: 'lookup', notes: '反馈看到空位的区域和时间。',
    });
  }

  return [
    pickup('north', 'zhou', '帮从北门自提柜取一封快件', '自提柜', '出口', 4),
    buy('canteen', 'man', '二食堂窗口带一杯无糖豆浆', '早餐窗口', '门口', '无糖豆浆', 6),
    pickup('wutong', 'wen', '取梧桐苑楼下自提点的文具包', '自提点', '门厅', 4),
    pickup('songbai', 'yu', '从松柏苑服务台带一件小包裹', '服务台', '门口', 4),
    seat('library', 'xu', '帮看图书馆二楼靠走廊的空位', '走廊阅览区'),
    pickup('wenhua', 'man', '帮取文华楼服务台代收的资料包', '服务台', '南门', 4),
    pickup('east', 'lin', '帮取东门自提柜的小包裹', '自提柜', '取件区外', 3),
    seat('activity', 'zhou', '帮看活动中心等候区有没有空位', '等候区'),
    buy('gym', 'yu', '在体育馆自动售卖机买瓶水', '自动售卖机', '入口处', '500 ml 矿泉水', 5),
    buy('shop', 'xu', '学苑超市顺手买一卷透明胶', '', '门口', '宽 24 mm 透明胶', 8),
    pickup('design', 'wen', '帮取设计楼收发处的布料样品', '收发处', '门口', 5),
    pickup('south', 'man', '顺手取南门驿站的一件薄包裹', '靠窗货架', '出口', 4),
    pickup('bamboo', 'zhou', '帮带竹苑自提点的一袋日用品', '自提点', '南侧门口', 4),
  ];
}
