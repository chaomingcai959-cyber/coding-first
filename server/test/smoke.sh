#!/bin/bash
# 端到端冒烟（规格 02 契约逐条过）：鉴权/锁/播单写/幂等/confirm_token/会话/规则/日志/SSE
BASE=http://127.0.0.1:3000
YANG='-H Content-Type:application/json -H X-User-Id:u-yang'
PY="C:/Users/ZhaoMing/.workbuddy/binaries/python/versions/3.13.12/python.exe"
jqr() { $PY -c "import sys,json;d=json.load(sys.stdin);print($1)"; }

CH=$(curl -s -H "X-User-Id: u-yang" "$BASE/api/channels?type=linear" | jqr "d['data']['items'][0]['id']")
echo "== 线性频道: $CH"

echo -n "1 越权拦截(G2): "; curl -s -H "X-User-Id: u-viewer" "$BASE/api/channels/$CH" | jqr "d['code']"

echo -n "2 申领编辑锁: "; curl -s -X POST $YANG "$BASE/api/channels/$CH/lock" | jqr "d['data']"

echo -n "3 追加节目(append): "
PROGS=$(curl -s $YANG "$BASE/api/programs?size=3" | jqr "[p['id'] for p in d['data']['items']]")
PID1=$(echo $PROGS | jqr "eval(sys.stdin.read())[0]" <<< "$PROGS")
IDS=$($PY -c "import json;print(json.dumps($PROGS))")
curl -s -X POST $YANG "$BASE/api/channels/$CH/playlist/items" -d "{\"program_ids\":$IDS,\"mode\":\"append\",\"request_id\":\"$(uuidgen 2>/dev/null || $PY -c 'import uuid;print(uuid.uuid4())')\"}" | jqr "d['data']"

echo -n "4 幂等重放(同request_id): "
RID=$($PY -c 'import uuid;print(uuid.uuid4())')
curl -s -X POST $YANG "$BASE/api/channels/$CH/playlist/items" -d "{\"program_ids\":[\"$PID1\"],\"mode\":\"append\",\"request_id\":\"$RID\"}" | jqr "d['data']"
curl -s -X POST $YANG "$BASE/api/channels/$CH/playlist/items" -d "{\"program_ids\":[\"$PID1\"],\"mode\":\"append\",\"request_id\":\"$RID\"}" | jqr "'重放返回相同结果: '+str(d['data'])"
echo -n "  播单条数(应为4=3+1,非5): "; curl -s $YANG "$BASE/api/channels/$CH/playlist" | jqr "len(d['data']['items'])"

echo -n "5 线性时间轴(C1): "; curl -s $YANG "$BASE/api/channels/$CH/playlist" | jqr "[(i['sort'],i['time_start'],i['time_end']) for i in d['data']['items'][:2]]"

echo -n "6 无token清空(应1005): "; curl -s -X POST $YANG "$BASE/api/channels/$CH/playlist/clear" -d "{\"confirm_token\":\"bad\",\"request_id\":\"$($PY -c 'import uuid;print(uuid.uuid4())')\"}" | jqr "d['code']"
echo -n "7 签发token+清空(C3): "
TK=$(curl -s -X POST $YANG "$BASE/api/channels/$CH/confirm-tokens" -d '{"action":"clear_playlist"}' | jqr "d['data']['confirm_token']")
curl -s -X POST $YANG "$BASE/api/channels/$CH/playlist/clear" -d "{\"confirm_token\":\"$TK\",\"request_id\":\"$($PY -c 'import uuid;print(uuid.uuid4())')\"}" | jqr "d['data']"
echo -n "  token二次使用(应1005): "; curl -s -X POST $YANG "$BASE/api/channels/$CH/playlist/clear" -d "{\"confirm_token\":\"$TK\",\"request_id\":\"$($PY -c 'import uuid;print(uuid.uuid4())')\"}" | jqr "d['code']"

echo -n "8 规则字段级覆盖(M4): "
curl -s -X PUT $YANG "$BASE/api/channels/$CH/rules" -d '{"rule_type":"movie","fields":{"director":"张艺谋","tags":["古装"]}}' | jqr "d['data']"
curl -s -X PUT $YANG "$BASE/api/channels/$CH/rules" -d '{"rule_type":"movie","fields":{"director":"陈凯歌"}}' | jqr "d['data']"
curl -s $YANG "$BASE/api/channels/$CH/rules" | jqr "[r for r in d['data']['rules'] if r['rule_type']=='movie'][0]['fields']"

echo -n "9 SSE AI对话: "; curl -s -N -X POST $YANG "$BASE/api/ai/chat" -d "{\"channel_id\":\"$CH\",\"content\":\"帮我生成今天的播单\",\"request_id\":\"$($PY -c 'import uuid;print(uuid.uuid4())')\"}" --max-time 10 | grep -c "^event:"

echo -n "10 会话存档(M7): "; curl -s $YANG "$BASE/api/channels/$CH/messages?limit=5" | jqr "[m['role'] for m in d['data']['items']]"

echo -n "11 开启新规则cutoff: "; curl -s -X POST $YANG "$BASE/api/channels/$CH/messages/cutoff" | jqr "d['data']"

echo -n "12 操作日志(管理员): "; curl -s -H "X-User-Id: u-admin" "$BASE/api/logs?channel_id=$CH" | jqr "[(l['action'],l['operator_name']) for l in d['data']['items'][:5]]"
echo -n "   日志越权(非管理员应1002): "; curl -s -H "X-User-Id: u-yang" "$BASE/api/logs" | jqr "d['code']"

echo -n "13 释放锁: "; curl -s -X DELETE $YANG "$BASE/api/channels/$CH/lock" | jqr "d['data']"
echo "SMOKE DONE"
