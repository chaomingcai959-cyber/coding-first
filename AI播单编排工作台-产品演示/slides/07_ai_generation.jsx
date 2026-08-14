<Slide style={{ width: 1280, height: 720, background: '#FFFFFF', padding: '48px 72px', flexDirection: 'row', gap: 48 }}>
  <Box style={{ width: 440, justifyContent: 'center' }}>
    {[
      ['1', '选择频道', '左栏筛选并选中目标频道，加载播单与会话'],
      ['2', 'AI 主动引导', 'AI 收集题材、时长、受众等编排意图'],
      ['3', '候选节目', 'AI 按规则匹配候选，展示思考过程，排除已在播'],
      ['4', '勾选确认', '勾选节目，确认加入方式'],
      ['5', '入库生效', '序号与播出时间自动重排，即时存档'],
    ].map(([n, t, d], i) => (
      <Box key={n} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: i === 4 ? 0 : 16 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', background: '#1E5FBF', width: 32, height: 32, textAlign: 'center', borderRadius: 16, flexShrink: 0, paddingTop: 4 }}>{n}</Text>
        <Box>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1F2329' }}>{t}</Text>
          <Text style={{ fontSize: 12, color: '#5F6473' }}>{d}</Text>
        </Box>
      </Box>
    ))}
  </Box>
  <Box style={{ flex: 1, borderRadius: 16, background: '#EFF6FF', padding: 24, justifyContent: 'center' }}>
    <Box style={{ alignSelf: 'flex-start', background: '#FFFFFF', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
      <Text style={{ fontSize: 13, color: '#5F6473' }}>帮我生成今天的播单，古装悬疑题材</Text>
    </Box>
    <Box style={{ alignSelf: 'flex-start', background: '#FFFFFF', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
      <Text style={{ fontSize: 11, color: '#1E5FBF', fontWeight: 'bold' }}>✦ 思考过程</Text>
      <Text style={{ fontSize: 11, color: '#5F6473' }}>意图识别 ✓ · 规则整理 ✓ · 命中 10 条候选（已排除 3 条在播）</Text>
    </Box>
    <Box style={{ alignSelf: 'flex-start', background: '#FFFFFF', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
      <Text style={{ fontSize: 13, color: '#1F2329' }}>请勾选候选节目，确认加入方式（插入开头 / 追加末尾 / 清空覆盖）</Text>
    </Box>
    <Box style={{ alignSelf: 'flex-end', background: '#1E5FBF', borderRadius: 10, padding: '10px 14px' }}>
      <Text style={{ fontSize: 13, color: '#FFFFFF' }}>勾选完成，追加到末尾</Text>
    </Box>
  </Box>
  <Box style={{ position: 'absolute', left: 72, right: 72, bottom: 22, flexDirection: 'row', justifyContent: 'space-between' }}>
    <Text style={{ fontSize: 13, color: '#8B8FA3' }}>AI 播单编排工作台 · 产品演示</Text>
    <Text style={{ fontSize: 13, color: '#8B8FA3' }}>7 / 14</Text>
  </Box>
</Slide>
