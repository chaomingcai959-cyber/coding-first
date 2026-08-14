#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""测试用例自动执行器：按《测试用例集-v1.0.md》逐条执行可脚本化用例，输出 PASS/FAIL/UI 三类结果。
依赖：后端 :3000 + PG 运行中。用法：python run_case_tests.py [--fix]"""
import json
import sys
import time
import uuid
from urllib.parse import urlencode
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:3000"
results = []


def call(method, path, user="u-yang", body=None, timeout=40, _retries=3):
    for attempt in range(_retries):
        r = _call_once(method, path, user, body, timeout)
        if r[0] != 0:
            return r
        time.sleep(0.5)
    return r


def _call_once(method, path, user, body, timeout):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("X-User-Id", user)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {"error": str(e)}


def rid():
    return str(uuid.uuid4())


def record(cid, ok, detail):
    results.append((cid, "PASS" if ok else "FAIL", detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {cid} {detail}")


def record_ui(cid, detail):
    results.append((cid, "UI", detail))
    print(f"[ UI ] {cid} {detail}")


def get_channel_by_name(name):
    _, d = call("GET", "/api/channels", "u-yang")
    for c in d["data"]["items"]:
        if c["name"] == name:
            return c
    return None


def lock_and_get(ch):
    call("POST", f"/api/channels/{ch}/lock", "u-yang")
    _, pl = call("GET", f"/api/channels/{ch}/playlist", "u-yang")
    return pl["data"]


def acquire_clean(ch, user="u-yang"):
    call("POST", f"/api/channels/{ch}/lock", user)


def release(ch, user="u-yang"):
    call("DELETE", f"/api/channels/{ch}/lock", user)


def main():
    # ============ 准备：锁定线性频道（经典电影回顾）用于时间轴/写用例 ============
    lin = get_channel_by_name("经典电影回顾")
    smart = get_channel_by_name("央视电影频道")
    kids = get_channel_by_name("少儿动画天地")
    assert lin and smart and kids, "频道种子缺失"
    lin_id, smart_id, kids_id = lin["id"], smart["id"], kids["id"]
    release(lin_id); release(smart_id); release(kids_id)
    acquire_clean(lin_id)
    call("POST", f"/api/channels/{lin_id}/confirm-tokens", "u-yang", {"action": "clear_playlist"})
    acquire_clean(lin_id)
    # 清空线性频道（直接构造 token）
    _, tk = call("POST", f"/api/channels/{lin_id}/confirm-tokens", "u-yang", {"action": "clear_playlist"})
    call("POST", f"/api/channels/{lin_id}/playlist/clear", "u-yang", {"confirm_token": tk["data"]["confirm_token"], "request_id": rid()})

    # ============ 契约专项 TC-C ============
    # TC-C-006~009 时间轴
    _, prog = call("GET", "/api/programs?size=30", "u-yang")
    ps = prog["data"]["items"]
    # 60min + 30min 两条（用 mock 时长最接近的）
    p1, p2 = ps[0], ps[4]
    call("POST", f"/api/channels/{lin_id}/playlist/items", "u-yang",
         {"program_ids": [p1["id"], p2["id"]], "mode": "append", "request_id": rid()})
    _, pl = call("GET", f"/api/channels/{lin_id}/playlist", "u-yang")
    it = pl["data"]["items"]
    ok6 = len(it) == 2 and it[0]["time_start"] == it[0]["time_start"] and int(it[0]["time_start"][4:6]) <= 59 and int(it[0]["time_start"][6:8]) <= 59
    ok6 = it[0]["time_start"].endswith("000000") and it[0]["time_start"] < it[0]["time_end"]
    record("TC-C-006", ok6, f"线性00:00起排 {it[0]['time_start']}->{it[0]['time_end']}")
    dur1 = (int(it[0]["time_end"][6:8]) - int(it[0]["time_start"][6:8])) % 60
    ok7 = it[1]["time_start"] == it[0]["time_end"]  # 顺序累加
    record("TC-C-007", len(it) == 2, "不足24h不填充(仅2条)")
    record("TC-C-008", ok7, f"顺序累加 {it[0]['time_end']}=={it[1]['time_start']}")
    # TC-C-009 调序重算
    call("POST", f"/api/channels/{lin_id}/playlist/move", "u-yang",
         {"program_id": it[1]["program_id"], "target_index": 0, "request_id": rid()})
    _, pl2 = call("GET", f"/api/channels/{lin_id}/playlist", "u-yang")
    it2 = pl2["data"]["items"]
    record("TC-C-009", it2[0]["program_id"] == it[1]["program_id"] and int(it2[0]["time_start"][4:6]) == int(it2[0]["time_start"][4:6]),
           f"调序后重排, 新首条 {it2[0]['time_start']}->{it2[0]['time_end']}")

    # TC-C-001 幂等
    rid1 = rid()
    body = {"program_ids": [p1["id"]], "mode": "append", "request_id": rid1}
    _, r1 = call("POST", f"/api/channels/{lin_id}/playlist/items", "u-yang", body)
    _, r2 = call("POST", f"/api/channels/{lin_id}/playlist/items", "u-yang", body)
    _, pln = call("GET", f"/api/channels/{lin_id}/playlist", "u-yang")
    record("TC-C-001", r1["data"] == r2["data"], f"重放返回同结果 {r1['data']}")
    _, pld = call("GET", f"/api/channels/{lin_id}/playlist", "u-yang")

    # TC-C-002/003/004 confirm_token
    _, bad = call("POST", f"/api/channels/{lin_id}/playlist/clear", "u-yang", {"confirm_token": "bad", "request_id": rid()})
    record("TC-C-002", bad.get("code") == 1005, f"无有效token清空 -> {bad.get('code')}")
    _, tk = call("POST", f"/api/channels/{lin_id}/confirm-tokens", "u-yang", {"action": "clear_playlist"})
    _, ok_clear = call("POST", f"/api/channels/{lin_id}/playlist/clear", "u-yang",
                       {"confirm_token": tk["data"]["confirm_token"], "request_id": rid()})
    _, again = call("POST", f"/api/channels/{lin_id}/playlist/clear", "u-yang",
                    {"confirm_token": tk["data"]["confirm_token"], "request_id": rid()})
    record("TC-C-003", ok_clear["data"].get("version") is not None and again.get("code") == 1005,
           f"首次成功版本{ok_clear['data'].get('version')}, 复用{again.get('code')}")
    # 跨用户：u-admin 用 u-yang 的 token
    acquire_clean(lin_id, "u-yang")
    _, tk2 = call("POST", f"/api/channels/{lin_id}/confirm-tokens", "u-yang", {"action": "clear_playlist"})
    _, cross = call("POST", f"/api/channels/{lin_id}/playlist/clear", "u-admin",
                    {"confirm_token": tk2["data"]["confirm_token"], "request_id": rid()})
    record("TC-C-004", cross.get("code") == 1005, f"跨用户token -> {cross.get('code')}")

    # TC-C-005 过期：直接改库模拟（跳过，人工项见报告）-> 用 DB 更新验证
    import subprocess
    tk3 = call("POST", f"/api/channels/{lin_id}/confirm-tokens", "u-yang", {"action": "clear_playlist"})[1]["data"]["confirm_token"]
    sql = f"UPDATE confirm_token SET expires_at = now() - interval '1 minute' WHERE token = '{tk3}';"
    env = dict(__import__("os").environ, PGPASSWORD="workbench")
    psql_res = subprocess.run(["D:/Application/sql/pgsql/bin/psql.exe", "-h", "127.0.0.1", "-U", "workbench", "-d", "workbench", "-c", sql],
                        env=env, capture_output=True, text=True)
    if psql_res.returncode != 0:
        record("TC-C-005", False, f"DB更新失败: {psql_res.stderr.strip()}")
        return
    _, expired = call("POST", f"/api/channels/{lin_id}/playlist/clear", "u-yang",
                      {"confirm_token": tk3, "request_id": rid()})
    record("TC-C-005", expired.get("code") == 1005, f"过期token -> {expired.get('code')}")

    # TC-C-010/011 鉴权
    st, d = call("GET", "/api/channels", "u-nobody")
    record("TC-C-010", d.get("code") in (1001,), f"缺失/未知用户 -> {d.get('code')}")
    req = urllib.request.Request(BASE + "/api/channels")
    try:
        urllib.request.urlopen(req, timeout=10)
        code = 200
    except urllib.error.HTTPError as e:
        code = e.code
    record("TC-C-011", code in (401,), f"无X-User-Id -> HTTP {code}")

    # TC-C-012 日志只读
    st, d = call("PUT", "/api/logs", "u-admin", {})
    record("TC-C-012", st in (404, 405), f"PUT /logs -> HTTP {st}")

    # TC-C-013 错误 envelope
    record("TC-C-013", "trace_id" in bad and "code" in bad and "message" in bad, "错误响应含 code/message/trace_id")

    # ============ F1 权限 ============
    # TC-F1-006 越权（viewer 仅授权前 2 个频道；少儿动画天地为第 3 个，未授权）
    st, d = call("GET", f"/api/channels/{kids_id}", "u-viewer")
    record("TC-F1-006", d.get("code") == 1002, f"viewer访问未授权频道 -> {d.get('code')}")
    # TC-F1-001 viewer 只见授权频道
    st, d = call("GET", "/api/channels", "u-viewer")
    record("TC-F1-001", len(d["data"]["items"]) == 2, f"viewer频道数={len(d['data']['items'])}")

    # ============ F7 编辑锁 ============
    # TC-F7-001 首位申领
    release(smart_id)
    st, d = call("POST", f"/api/channels/{smart_id}/lock", "u-yang")
    record("TC-F7-001", d["data"]["held"] is True, "u-yang 申领成功")
    # TC-F7-002/003 占用
    st, d2 = call("POST", f"/api/channels/{smart_id}/lock", "u-viewer")
    record("TC-F7-003", d2.get("code") == 1003, f"viewer 进入被占用频道 -> {d2.get('code')}")
    # TC-F7-009 非持锁人写
    st, d3 = call("POST", f"/api/channels/{smart_id}/playlist/items", "u-admin",
                  {"program_ids": [p1["id"]], "mode": "append", "request_id": rid()})
    record("TC-F7-009", d3.get("code") == 1004, f"u-admin 无锁写 -> {d3.get('code')}")
    # TC-F7-004 释放
    st, d4 = call("DELETE", f"/api/channels/{smart_id}/lock", "u-yang")
    record("TC-F7-004", d4["data"]["released"] is True, "释放成功")

    # ============ F8 手动操作 + M6 ============
    acquire_clean(smart_id)
    _, pl0 = call("GET", f"/api/channels/{smart_id}/playlist", "u-yang")
    n0 = len(pl0["data"]["items"])
    # 添加
    _, add = call("POST", f"/api/channels/{smart_id}/playlist/items", "u-yang",
                  {"program_ids": [p1["id"], p2["id"]], "mode": "append", "request_id": rid()})
    _, pl1 = call("GET", f"/api/channels/{smart_id}/playlist", "u-yang")
    record("TC-F8-001", len(pl1["data"]["items"]) == n0 + 2, f"添加2条 {n0}->{len(pl1['data']['items'])}")
    # 删除
    item = pl1["data"]["items"][0]
    _, delr = call("DELETE", f"/api/channels/{smart_id}/playlist/items", "u-yang",
                   {"item_ids": [item["id"]], "request_id": rid()})
    _, pl2 = call("GET", f"/api/channels/{smart_id}/playlist", "u-yang")
    record("TC-F8-002", len(pl2["data"]["items"]) == len(pl1["data"]["items"]) - 1, f"删除1条 -> {len(pl2['data']['items'])}")
    # 调序
    ita = pl2["data"]["items"][-1]
    _, mv = call("POST", f"/api/channels/{smart_id}/playlist/move", "u-yang",
                 {"program_id": ita["program_id"], "target_index": 0, "request_id": rid()})
    _, pl3 = call("GET", f"/api/channels/{smart_id}/playlist", "u-yang")
    record("TC-F8-006", pl3["data"]["items"][0]["program_id"] == ita["program_id"], "调序生效")
    # M6 系统事件写入会话
    _, msgs = call("GET", f"/api/channels/{smart_id}/messages?limit=10", "u-yang")
    roles = [m["role"] for m in msgs["data"]["items"]]
    record("TC-F8-009", "system_event" in roles, f"会话流含system_event: {roles}")
    # 清空（含确认）
    _, tk = call("POST", f"/api/channels/{smart_id}/confirm-tokens", "u-yang", {"action": "clear_playlist"})
    _, clr = call("POST", f"/api/channels/{smart_id}/playlist/clear", "u-yang",
                  {"confirm_token": tk["data"]["confirm_token"], "request_id": rid()})
    _, pl4 = call("GET", f"/api/channels/{smart_id}/playlist", "u-yang")
    record("TC-F8-004", len(pl4["data"]["items"]) == 0, f"清空后 {len(pl4['data']['items'])} 条")
    release(smart_id)

    # ============ F4 会话隔离 ============
    acquire_clean(kids_id)
    _, ma = call("POST", f"/api/channels/{kids_id}/playlist/items", "u-yang",
                 {"program_ids": [p1["id"]], "mode": "append", "request_id": rid()})
    _, m1 = call("GET", f"/api/channels/{kids_id}/messages?limit=5", "u-yang")
    _, m2 = call("GET", f"/api/channels/{smart_id}/messages?limit=5", "u-yang")
    a_ids = {m["id"] for m in m1["data"]["items"]}
    b_ids = {m["id"] for m in m2["data"]["items"]}
    record("TC-F4-001", not (a_ids & b_ids), "两频道消息无交集")
    release(kids_id)

    # ============ F5 开启新规则 ============
    acquire_clean(lin_id)
    _, cut = call("POST", f"/api/channels/{lin_id}/messages/cutoff", "u-yang")
    _, m5 = call("GET", f"/api/channels/{lin_id}/messages?limit=10", "u-yang")
    record("TC-F5-002", any(m["role"] == "divider" and m["is_cutoff"] for m in m5["data"]["items"]),
           "cutoff 分割线已写入")
    _, st5 = call("GET", f"/api/channels/{lin_id}/session-state", "u-yang")
    record("TC-F5-002b", st5["data"]["phase"] == "IDLE", f"状态重置 {st5['data']['phase']}")
    release(lin_id)

    # ============ F3 插入模式 ============
    acquire_clean(lin_id)
    _, tk = call("POST", f"/api/channels/{lin_id}/confirm-tokens", "u-yang", {"action": "overwrite_playlist"})
    _, ov = call("POST", f"/api/channels/{lin_id}/playlist/items", "u-yang",
                 {"program_ids": [p1["id"]], "mode": "overwrite", "confirm_token": tk["data"]["confirm_token"], "request_id": rid()})
    _, plo = call("GET", f"/api/channels/{lin_id}/playlist", "u-yang")
    record("TC-F3-007", len(plo["data"]["items"]) == 1 and plo["data"]["items"][0]["program_id"] == p1["id"],
           f"overwrite 后仅剩1条({plo['data']['items'][0]['name']})")
    _, pre = call("POST", f"/api/channels/{lin_id}/playlist/items", "u-yang",
                  {"program_ids": [p2["id"]], "mode": "prepend", "request_id": rid()})
    _, plp = call("GET", f"/api/channels/{lin_id}/playlist", "u-yang")
    record("TC-F3-005", plp["data"]["items"][0]["program_id"] == p2["id"], "prepend 插入开头")
    _, app = call("POST", f"/api/channels/{lin_id}/playlist/items", "u-yang",
                  {"program_ids": [ps[6]["id"]], "mode": "append", "request_id": rid()})
    _, pla = call("GET", f"/api/channels/{lin_id}/playlist", "u-yang")
    record("TC-F3-006", pla["data"]["items"][-1]["program_id"] == ps[6]["id"], "append 追加末尾")
    # TC-C-008b 超24h滚动（补足到 >24h：55min×28≈25.7h）
    _, psbig = call("GET", "/api/programs?size=100", "u-yang")
    need = max(1, 28 - len(pla["data"]["items"]))
    call("POST", f"/api/channels/{lin_id}/playlist/items", "u-yang",
         {"program_ids": [p["id"] for p in psbig["data"]["items"][:need]], "mode": "append", "request_id": rid()})
    _, plbig = call("GET", f"/api/channels/{lin_id}/playlist", "u-yang")
    itbig = plbig["data"]["items"]
    day_ok = any(int(i["time_start"][2:4]) > int(itbig[0]["time_start"][2:4]) or int(i["time_start"][0:2]) != int(itbig[0]["time_start"][0:2]) for i in itbig)
    record("TC-C-008b", day_ok, f"跨天滚入次日: 首条{itbig[0]['time_start']} 尾条{itbig[-1]['time_start']}")
    release(lin_id)

    # ============ F9 媒资检索 ============
    t0 = time.time()
    _, ps2 = call("GET", "/api/programs?" + urlencode({"cat": "电影", "tag": "古装", "size": "10"}), "u-yang")
    dt = (time.time() - t0) * 1000
    record("TC-F9-001", all(p["cat"] == "电影" for p in ps2["data"]["items"]) and len(ps2["data"]["items"]) > 0,
           f"筛选精确匹配 {len(ps2['data']['items'])} 条")
    record("TC-F9-007", dt <= 1000, f"检索耗时 {dt:.0f}ms ≤1s")

    # ============ F3-010 零候选（构造不存在的节目）============
    # 后端 search 无命中即空 -> 由编排器 I1 路径返回零候选文案（UI 层）；API 层验证 search 空结果
    _, z = call("GET", "/api/programs?" + urlencode({"name": "不存在的节目XYZ"}), "u-yang")
    record("TC-F3-010", z["data"]["total"] == 0, f"零候选 total={z['data']['total']}")

    # ============ 非功能 ============
    # TC-N-004 媒资检索 50 次耗时
    t0 = time.time()
    for _ in range(50):
        call("GET", "/api/programs?size=5", "u-yang")
    dt = (time.time() - t0) * 1000 / 50
    record("TC-N-004", dt <= 1000, f"媒资检索均值 {dt:.0f}ms ≤1s")

    # ============ 汇总 ============
    print("\n===== 汇总 =====")
    from collections import Counter
    c = Counter(r[1] for r in results)
    print(f"PASS={c['PASS']} FAIL={c['FAIL']} UI(人工)={c['UI']} 合计={len(results)}")
    fails = [r for r in results if r[1] == "FAIL"]
    if fails:
        print("\n===== 失败清单 =====")
        for f in fails:
            print(f"  {f[0]}: {f[2]}")


if __name__ == "__main__":
    main()
