// 附录 C1 时间轴算法单测（SDD：规格 → 测试 → 实现）
import { describe, expect, it } from "vitest";
import { recalcTimeline, renumber } from "../src/shared/timeline.util";

describe("recalcTimeline（附录 C1）", () => {
  const base = new Date("2026-08-14T15:00:00"); // 起排应锚定当日 00:00

  it("从当日 00:00:00 起排并顺序累加", () => {
    const items = recalcTimeline([
      { duration_sec: 3600, time_start: null, time_end: null },
      { duration_sec: 1800, time_start: null, time_end: null },
    ], base);
    expect(items[0].time_start).toBe("0814000000");
    expect(items[0].time_end).toBe("0814010000");
    expect(items[1].time_start).toBe("0814010000");
    expect(items[1].time_end).toBe("0814013000");
  });

  it("不足 24h 不填充（条目数不变，无占位条目）", () => {
    const items = recalcTimeline([{ duration_sec: 600, time_start: null, time_end: null }], base);
    expect(items).toHaveLength(1);
    expect(items[0].time_end).toBe("0814001000");
  });

  it("超 24h 自然滚入下一个 24h 周期", () => {
    const items = recalcTimeline([
      { duration_sec: 23 * 3600, time_start: null, time_end: null },
      { duration_sec: 2 * 3600, time_start: null, time_end: null },
    ], base);
    expect(items[1].time_start).toBe("0814230000");
    expect(items[1].time_end).toBe("0815010000"); // 次日 01:00
  });

  it("时长缺失按 0 处理且不阻塞后续重算", () => {
    const items = recalcTimeline([
      { duration_sec: 0, time_start: null, time_end: null },
      { duration_sec: 3600, time_start: null, time_end: null },
    ], base);
    expect(items[1].time_start).toBe("0814000000");
    expect(items[1].time_end).toBe("0814010000");
  });
});

describe("renumber", () => {
  it("序号从 1 连续重排", () => {
    const arr = renumber([{ sort: 9 }, { sort: 3 }, { sort: 7 }]);
    expect(arr.map((x) => x.sort)).toEqual([1, 2, 3]);
  });
});
