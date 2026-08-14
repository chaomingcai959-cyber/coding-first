// S2 媒资服务（规格 02 §3；附录 C4：一期 mock 数据源适配器，预留真实媒资替换点）
import { Controller, Get, Module, Query } from "@nestjs/common";
import { Injectable } from "@nestjs/common";

export interface ProgramDto {
  id: string;
  code: string;
  name: string;
  cat: string;
  tag: string;
  provider: string;
  album: string;
  duration_sec: number;
  status: "enabled" | "disabled";
}

const NAMES = [
  "琅琊榜", "庆余年", "大宅门", "大明宫词", "知否知否", "父母爱情", "西游记", "三国演义",
  "红楼梦", "水浒传", "射雕英雄传", "天龙八部", "笑傲江湖", "鹿鼎记", "倚天屠龙记", "神雕侠侣",
  "仙剑奇侠传", "古剑奇谭", "花千骨", "三生三世十里桃花", "赘婿", "雪中悍刀行", "风起洛阳", "长安十二时辰",
];
const ALBUMS = ["古装剧集", "都市情感", "家庭伦理", "谍战悬疑", "军旅题材", "年代剧", "偶像剧", "甜宠剧", "综艺合集", "纪录片"];
const CATS = ["电影", "电视剧", "综艺", "少儿"];
const TAGS = ["古装", "都市", "悬疑", "动画", "真人秀", "益智"];
const PROVIDERS = ["华策", "优酷", "爱奇艺", "腾讯"];

export const MOCK_PROGRAMS: ProgramDto[] = Array.from({ length: 120 }, (_, i) => ({
  id: `prog-${10000 + i}`,
  code: `PRG-${10000 + i}`,
  name: `${NAMES[i % NAMES.length]} 第${(i % 40) + 1}集`,
  cat: CATS[i % CATS.length],
  tag: TAGS[i % TAGS.length],
  provider: PROVIDERS[i % PROVIDERS.length],
  album: ALBUMS[(i * 3) % ALBUMS.length],
  duration_sec: (50 + (i % 20)) * 60,
  status: i % 5 === 3 ? "disabled" : "enabled",
}));

@Injectable()
export class ProgramService {
  /** 多维检索（P95 ≤1s；C4 一期内存 mock，真实媒资接入时仅替换本方法实现） */
  search(q: { cat?: string; tag?: string; provider?: string; name?: string; album?: string; page?: string; size?: string }) {
    const page = Math.max(1, parseInt(q.page || "1", 10));
    const size = Math.min(100, Math.max(1, parseInt(q.size || "20", 10)));
    const filtered = MOCK_PROGRAMS.filter(
      (p) =>
        (!q.cat || p.cat === q.cat) &&
        (!q.tag || p.tag === q.tag) &&
        (!q.provider || p.provider === q.provider) &&
        (!q.name || p.name.includes(q.name)) &&
        (!q.album || p.album.includes(q.album))
    );
    return {
      total: filtered.length,
      items: filtered.slice((page - 1) * size, page * size),
    };
  }

  byIds(ids: string[]): ProgramDto[] {
    return MOCK_PROGRAMS.filter((p) => ids.includes(p.id));
  }
}

@Controller("api/programs")
export class ProgramController {
  constructor(private readonly svc: ProgramService) {}

  @Get()
  search(@Query() q: Record<string, string>) {
    return this.svc.search(q);
  }
}

@Module({
  controllers: [ProgramController],
  providers: [ProgramService],
  exports: [ProgramService],
})
export class ProgramModule {}
