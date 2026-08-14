<Slide style={{ width: 1280, height: 720, background: '#FFFFFF', padding: '56px 72px', flexDirection: 'row', gap: 56 }}>
  <Box style={{ flex: 1, justifyContent: 'center', gap: 18 }}>
    <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#1F2329' }}>全程留痕，可查可溯</Text>
    <Text style={{ fontSize: 15, color: '#5F6473', lineHeight: 1.9 }}>每一次手动操作与 AI 对话，都记录操作人、时间、动作与前后内容快照，日志追加写、不可篡改——满足审计与追溯要求。</Text>
    {['编辑人账号 / 昵称', '操作时间与完整对话原文', '具体操作行为与前后快照'].map((t) => (
      <Box key={t} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Text style={{ fontSize: 18, color: '#1E5FBF', fontWeight: 'bold' }}>✓</Text>
        <Text style={{ fontSize: 15, color: '#5F6473' }}>{t}</Text>
      </Box>
    ))}
  </Box>
  <Box style={{ width: 520, borderRadius: 16, border: '1px solid #DDE7F5', padding: '24px 28px', justifyContent: 'center', gap: 12, background: '#FBFCFE' }}>
    {[
      ['14:22:11', '杨经理', 'add', '向播单添加 2 个节目'],
      ['14:23:05', '杨经理', 'ai_apply', 'AI 追加 5 个节目，版本 v8'],
      ['14:25:40', '杨经理', 'move', '《琅琊榜》移至第 1 位'],
    ].map(([t, u, a, d]) => (
      <Box key={t} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', borderBottom: '1px solid #EFF6FF', paddingBottom: 10 }}>
        <Text style={{ fontSize: 12, color: '#8B8FA3', width: 70, }}>{t}</Text>
        <Text style={{ fontSize: 13, color: '#1F2329', width: 76 }}>{u}</Text>
        <Text style={{ fontSize: 12, color: '#1E5FBF', background: '#EFF6FF', borderRadius: 6, padding: '2px 8px', width: 70, textAlign: 'center' }}>{a}</Text>
        <Text style={{ fontSize: 13, color: '#5F6473', flex: 1 }}>{d}</Text>
      </Box>
    ))}
    <Text style={{ fontSize: 12, color: '#8B8FA3', textAlign: 'center', marginTop: 6 }}>追加写 · 不可篡改 · 可按频道/操作人/时间检索</Text>
  </Box>
  <Box style={{ position: 'absolute', left: 72, right: 72, bottom: 22, flexDirection: 'row', justifyContent: 'space-between' }}>
    <Text style={{ fontSize: 13, color: '#8B8FA3' }}>AI 播单编排工作台 · 产品演示</Text>
    <Text style={{ fontSize: 13, color: '#8B8FA3' }}>12 / 14</Text>
  </Box>
</Slide>