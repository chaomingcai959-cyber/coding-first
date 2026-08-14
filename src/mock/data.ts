// Mock 数据层（一期 C4 决策：虚拟数据；联调阶段整体替换为真实 API）
export interface Channel {
  id: number | string; // API 模式下为 uuid 字符串
  name: string;
  type: "智能频道" | "线性频道";
  cat: string;
  tenant: string;
  playCount: number;
  status: string;
}

export interface PlaylistItem {
  id: number | string;
  program_id?: string; // API 模式下携带，move/remove 接口入参
  sort: number;
  name: string;
  album: string;
  status: string;
  timeStart?: string | null;
  timeEnd?: string | null;
}

export interface Program {
  id: number | string;
  name: string;
  code: string;
  cat: string;
  tag: string;
  provider: string;
  album: string;
  status: "启用" | "禁用";
  durationSec: number;
}

export const CHANNELS: Channel[] = [
  { id: 1, name: "央视电影频道", type: "智能频道", cat: "电影", tenant: "全国", playCount: 42, status: "启用" },
  { id: 2, name: "热门电视剧", type: "智能频道", cat: "电视剧", tenant: "全国", playCount: 68, status: "启用" },
  { id: 3, name: "少儿动画天地", type: "智能频道", cat: "少儿", tenant: "全国", playCount: 25, status: "禁用" },
  { id: 4, name: "综艺娱乐", type: "智能频道", cat: "综艺", tenant: "全国", playCount: 36, status: "启用" },
  { id: 5, name: "经典电影回顾", type: "线性频道", cat: "电影", tenant: "北京", playCount: 80, status: "启用" },
  { id: 6, name: "地方台精选", type: "智能频道", cat: "电视剧", tenant: "上海", playCount: 50, status: "启用" },
  { id: 7, name: "纪录片专区", type: "线性频道", cat: "电影", tenant: "广东", playCount: 60, status: "启用" },
  { id: 8, name: "家庭影院", type: "智能频道", cat: "电影", tenant: "全国", playCount: 55, status: "启用" },
];

const PROGRAM_NAMES = [
  "琅琊榜", "庆余年", "大宅门", "大明宫词", "知否知否", "父母爱情", "西游记", "三国演义",
  "红楼梦", "水浒传", "射雕英雄传", "天龙八部", "笑傲江湖", "鹿鼎记", "倚天屠龙记", "神雕侠侣",
  "仙剑奇侠传", "古剑奇谭", "花千骨", "三生三世十里桃花", "赘婿", "雪中悍刀行", "风起洛阳", "长安十二时辰",
];
const ALBUMS = [
  "古装剧集", "都市情感", "家庭伦理", "谍战悬疑", "军旅题材", "年代剧", "偶像剧", "甜宠剧",
  "综艺合集", "纪录片", "动画系列", "益智启蒙", "经典电影", "动作大片", "科幻世界", "喜剧影院",
];
const CATS = ["电影", "电视剧", "综艺", "少儿"];
const TAGS = ["古装", "都市", "悬疑", "动画", "真人秀", "益智"];
const PROVIDERS = ["华策", "优酷", "爱奇艺", "腾讯"];

// ---- 线性频道时间轴（附录 C1 算法：当日 00:00 起排、不填充、超 24h 滚入次日） ----
export function fmtLinearTime(startSec: number): string {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const d = new Date(base.getTime() + startSec * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function fmtLinearDisplay(s?: string | null): string {
  if (!s) return "";
  if (s.length === 10) {
    return `${parseInt(s.slice(0, 2), 10)}/${s.slice(2, 4)} ${s.slice(4, 6)}:${s.slice(6, 8)}:${s.slice(8, 10)}`;
  }
  return s;
}

// 生成某频道播单（含线性时间轴重算）
export function genPlaylist(chId: number, count: number, isLinear: boolean): PlaylistItem[] {
  const list: PlaylistItem[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const durationSec = (55 + ((chId * 7 + i * 13) % 11)) * 60;
    const item: PlaylistItem = {
      id: chId * 1000 + i,
      sort: i + 1,
      name: `${PROGRAM_NAMES[(chId * 3 + i) % PROGRAM_NAMES.length]} 第${(i % 50) + 1}集`,
      album: ALBUMS[(chId * 5 + i * 2) % ALBUMS.length],
      status: i % 6 === 4 ? "禁用" : "启用",
    };
    if (isLinear) {
      item.timeStart = fmtLinearTime(cursor);
      item.timeEnd = fmtLinearTime(cursor + durationSec);
    }
    list.push(item);
    cursor += durationSec;
  }
  return list;
}

// 素材库节目池（添加节目弹窗 / AI 候选共用）
export const PROGRAM_POOL: Program[] = Array.from({ length: 48 }, (_, i) => ({
  id: 9000 + i,
  name: `${PROGRAM_NAMES[i % PROGRAM_NAMES.length]} 第${(i % 40) + 1}集`,
  code: `PRG-${10000 + i}`,
  cat: CATS[i % CATS.length],
  tag: TAGS[i % TAGS.length],
  provider: PROVIDERS[i % PROVIDERS.length],
  album: ALBUMS[(i * 3) % ALBUMS.length],
  status: i % 5 === 3 ? "禁用" : "启用",
  durationSec: (50 + (i % 20)) * 60,
}));

export const FILTER_OPTIONS = { CATS, TAGS, PROVIDERS };
