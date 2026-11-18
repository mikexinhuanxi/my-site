export const CREDIT_PER_TASK = 10;
export const TIME_ZONE = 'Asia/Shanghai';

export const CATEGORIES = {
  pickup: { label: '代取快递', icon: 'package', origin: '取件地点' },
  buy: { label: '代买物品', icon: 'bag', origin: '购买地点' },
  seat: { label: '座位互助', icon: 'chair', origin: '座位地点' },
};

export const PEOPLE = {
  lin: { name: '小林', initial: '林', tone: 'violet', bio: '信息学院' },
  zhou: { name: '阿周', initial: '周', tone: 'green', bio: '建筑学院' },
  man: { name: '小满', initial: '满', tone: 'peach', bio: '外国语学院' },
  yu: { name: '小雨', initial: '雨', tone: 'blue', bio: '新闻学院' },
  wen: { name: '阿文', initial: '文', tone: 'pink', bio: '文学院' },
  xu: { name: '小许', initial: '许', tone: 'gold', bio: '设计学院' },
};

export const STATUS = {
  open: '待接单', active: '进行中', review: '待确认', completed: '已完成',
  cancelled: '已取消', expired: '已过期',
};

export const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const dayKey = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
const timeKey = new Intl.DateTimeFormat('zh-CN', {
  timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const fullDate = new Intl.DateTimeFormat('zh-CN', {
  timeZone: TIME_ZONE, month: 'long', day: 'numeric', hour: '2-digit',
  minute: '2-digit', hourCycle: 'h23',
});

export function clockLabel(time) {
  return fullDate.format(time);
}

export function localInputValue(time) {
  return `${dayKey.format(time)}T${timeKey.format(time)}`;
}

export function deadlineLabel(time, now = Date.now()) {
  const date = dayKey.format(time);
  if (date === dayKey.format(now)) return `今天 ${timeKey.format(time)} 前`;
  if (date === dayKey.format(now + 24 * HOUR)) return `明天 ${timeKey.format(time)} 前`;
  return `${clockLabel(time)} 前`;
}

export function seedTasks(now = Date.now()) {
  const open = (task, position, hours) => ({
    status: 'open', createdAt: now - position * 7 * MINUTE,
    dueAt: Math.floor((now + hours * HOUR) / MINUTE) * MINUTE,
    ...task,
  });
  const north = {
    id: 'sample-north', category: 'pickup', author: 'zhou', reward: 8,
    title: '北门驿站代取 2 件快递', origin: '北门菜鸟驿站', destination: '松柏苑 6 栋',
    quantity: 2, size: '小件', code: 'DEMO-0426', notes: '两个小盒子，步行可带。送到松柏苑 6 栋一楼大厅交接。',
  };
  return [
    open(north, 1, 1.25),
    open({
      id: 'sample-lunch', category: 'buy', author: 'man', reward: 6,
      title: '二食堂帮买一份鸡腿饭', origin: '二食堂一楼', destination: '梧桐苑 3 栋',
      item: '鸡腿饭，微辣，打包', quantity: 1, budget: 25,
      notes: '如果卖完了请直接说明，无需买替代品。',
    }, 2, 3),
    open({
      id: 'sample-library', category: 'seat', author: 'yu', reward: 3,
      title: '帮看看图书馆二楼有没有空座', origin: '图书馆二楼 · 靠窗区', mode: 'lookup',
      notes: '想找靠窗有插座的位置，回复楼层、区域和看到空位的时间就好。',
    }, 3, 4),
    open({
      id: 'sample-print', category: 'pickup', author: 'wen', reward: 5,
      title: '东门驿站代取一盒打印资料', origin: '东门快递站', destination: '文华楼一楼',
      quantity: 1, size: '小件', code: 'DEMO-7310', notes: '到文华楼一楼大厅交给我。',
    }, 4, 23),
    open({
      id: 'sample-event', category: 'seat', author: 'xu', reward: 4,
      title: '社团分享会帮留一个座位', origin: '学生活动中心 102',
      mode: 'hold', quantity: 1, holdMinutes: 10, notes: '主办方允许开场前留座，靠过道优先。',
    }, 5, 27),
    open({
      id: 'sample-pens', category: 'buy', author: 'zhou', reward: 6,
      title: '帮买两支黑色速干签字笔', origin: '学苑超市', destination: '设计楼门厅',
      item: '黑色速干签字笔，0.5 mm', quantity: 2, budget: 15, notes: '任意品牌都可以。',
    }, 6, 33),
    open({
      id: 'sample-mine', category: 'pickup', author: 'lin', reward: 5,
      title: '帮我带一个小包裹到竹苑', origin: '南门快递站', destination: '竹苑 2 栋',
      quantity: 1, size: '小件', code: 'DEMO-7208', notes: '门厅见，包裹只有一本书大小。',
    }, 7, 29),
    open({
      id: 'sample-current', category: 'buy', author: 'man', assignee: 'lin', status: 'active', reward: 4,
      title: '学苑超市带两瓶无糖茶', origin: '学苑超市', destination: '体育馆南门',
      item: '500 ml 无糖茶', quantity: 2, budget: 12, notes: '品牌不限。', acceptedAt: now - 25 * MINUTE,
    }, 9, 20),
    {
      ...north, id: 'sample-complete', title: '代取运动水壶包裹', quantity: 1,
      status: 'completed', assignee: 'lin', createdAt: now - 26 * HOUR, dueAt: now - 20 * HOUR,
      acceptedAt: now - 25 * HOUR, submittedAt: now - 23 * HOUR, completedAt: now - 22 * HOUR,
      notes: '一件小包裹。', delivery: '包裹已在松柏苑 6 栋一楼大厅当面交接。',
    },
  ];
}

export function taskStatus(task, now = Date.now()) {
  return task.status === 'open' && task.dueAt <= now ? 'expired' : task.status;
}

export function creditFor(tasks, person, startingScore = null) {
  const entries = tasks.filter(task => task.status === 'completed' && task.assignee === person)
    .sort((a, b) => b.completedAt - a.completedAt);
  const earned = entries.length * CREDIT_PER_TASK;
  return { entries, earned, total: startingScore === null ? null : startingScore + earned };
}

function requiredText(value, label, maxLength) {
  const text = String(value ?? '').trim();
  if (!text || text.length > maxLength) throw new Error(`请填写${label}（最多 ${maxLength} 字）。`);
  return text;
}

function validAmount(value, label, min, max, scale = 1) {
  const amount = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(amount) ||
      amount < min || amount > max || Math.abs(amount * scale - Math.round(amount * scale)) > 1e-7) {
    throw new Error(`请填写有效的${label}（${min}–${max}）。`);
  }
  return amount;
}

export function createTask(values, author, id, now = Date.now()) {
  const { category } = values;
  if (!Object.hasOwn(CATEGORIES, category) || !Object.hasOwn(PEOPLE, author)) throw new Error('请选择任务类别。');
  const dueAt = Date.parse(`${values.deadline}:00+08:00`);
  if (!Number.isFinite(dueAt) || dueAt <= now) throw new Error('截止时间需要晚于现在。');

  const task = {
    id, author, category, dueAt, createdAt: now, status: 'open',
    title: requiredText(values.title, '任务标题', 42),
    origin: requiredText(values.origin, CATEGORIES[category].origin, 36),
    reward: validAmount(values.reward, '感谢费', 0, 500, 100),
    notes: String(values.notes ?? '').trim().slice(0, 240),
  };
  if (category !== 'seat') {
    task.destination = requiredText(values.destination, '交接地点', 36);
    task.quantity = validAmount(values.quantity, '数量', 1, 20);
  }
  if (category === 'pickup') {
    task.size = values.size === '含大件' ? '含大件' : '小件';
    task.code = String(values.code ?? '').trim();
    if (task.code && !/^DEMO-[A-Za-z0-9-]{1,16}$/.test(task.code)) {
      throw new Error('演示取件码请使用 DEMO- 开头，后接 1–16 位字母、数字或连字符。');
    }
  }
  if (category === 'buy') {
    task.item = requiredText(values.item, '物品和规格', 60);
    task.budget = validAmount(values.budget, '商品预算', 0.01, 1000, 100);
  }
  if (category === 'seat') {
    task.mode = values.mode === 'hold' ? 'hold' : 'lookup';
    if (task.mode === 'hold') {
      if (values.allowed !== 'on') throw new Error('请确认活动主办方允许留座。');
      task.quantity = validAmount(values.quantity, '座位数', 1, 4);
      task.holdMinutes = validAmount(values.holdMinutes, '留座时长', 1, 30);
    }
  }
  return task;
}

export function transition(task, action, person, delivery = '', now = Date.now()) {
  const status = taskStatus(task, now);
  const isAuthor = task.author === person;
  const isRunner = task.assignee === person;
  if (action === 'accept' && status === 'open' && !isAuthor) {
    return { ...task, status: 'active', assignee: person, acceptedAt: now };
  }
  if (action === 'submit' && status === 'active' && isRunner) {
    return { ...task, status: 'review', delivery: requiredText(delivery, '交付说明', 240), submittedAt: now };
  }
  if (action === 'complete' && status === 'review' && isAuthor) {
    return { ...task, status: 'completed', completedAt: now };
  }
  if (action === 'cancel' && status === 'open' && isAuthor) {
    return { ...task, status: 'cancelled', cancelledAt: now };
  }
  if (action === 'withdraw' && status === 'active' && isRunner) {
    const { assignee, acceptedAt, ...availableTask } = task;
    return { ...availableTask, status: 'open' };
  }
  throw new Error('这项操作当前不可用，请查看最新任务状态。');
}
