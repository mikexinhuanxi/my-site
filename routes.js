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
