// 线性频道 24h 时间轴（附录 C1）
// 规则：当日 00:00:00 起排；顺序累加时长；不足 24h 不填充；超 24h 自然滚入次日；
//      任何写操作后按当前顺序整体重算；时长缺失按 0 处理。

export interface TimelineItem {
  duration_sec: number;
  time_start: string | null;
  time_end: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function fmtMMDDHHMMSS(d: Date): string {
  return `${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** 按顺序整体重算线性时间轴（就地修改并返回） */
export function recalcTimeline<T extends TimelineItem>(items: T[], baseDate: Date = new Date()): T[] {
  const base = new Date(baseDate);
  base.setHours(0, 0, 0, 0);
  let cursorSec = 0;
  for (const it of items) {
    const dur = Math.max(0, it.duration_sec || 0); // 缺失按 0，不阻塞重算
    it.time_start = fmtMMDDHHMMSS(new Date(base.getTime() + cursorSec * 1000));
    it.time_end = fmtMMDDHHMMSS(new Date(base.getTime() + (cursorSec + dur) * 1000));
    cursorSec += dur;
  }
  return items;
}

/** 重排序号（1 起连续） */
export function renumber<T extends { sort: number }>(items: T[]): T[] {
  items.forEach((it, i) => (it.sort = i + 1));
  return items;
}
