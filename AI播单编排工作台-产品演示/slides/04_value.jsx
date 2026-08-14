<Slide style={{ width: 1280, height: 720, background: '#FFFFFF', padding: '64px 72px', flexDirection: 'row', gap: 48 }}>
  <Box style={{ width: 560, borderRadius: 20, background: 'linear-gradient(150deg, #1E5FBF 0%, #0F3E8E 100%)', padding: '48px 40px', justifyContent: 'center', gap: 26 }}>
    <Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.8)', fontWeight: 'bold', letterSpacing: 2 }}>痛点：人工排单</Text>
    <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.9)', lineHeight: 1.9 }}>运营人员手工筛选节目、逐条排播单，依赖个人经验，编排一个频道动辄数小时，且难以复制和沉淀。</Text>
    <Box style={{ height: 2, background: 'rgba(255,255,255,0.25)', margin: '6px 0' }} />
    <Text style={{ fontSize: 20, color: '#FBBF24', fontWeight: 'bold', letterSpacing: 2 }}>方案：AI 指挥编排</Text>
    <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.9)', lineHeight: 1.9 }}>自然语言下达编排意图，AI 完成筛选、候选与入库全流程；手动编辑能力完整保留，作为兜底。</Text>
  </Box>
  <Box style={{ flex: 1, justifyContent: 'center', gap: 26 }}>
    <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#1F2329', lineHeight: 1.5 }}>
      编排时长从 <span style={{ color: '#1E5FBF' }}>小时级</span> 降到
      <span style={{ color: '#F59E0B' }}> 对话级</span>
    </Text>
    <Box style={{ gap: 14 }}>
      {['降低门槛：无需熟悉复杂编排规则，一句话即可发起', '能力沉淀：编排规则结构化存储，可继承、可复用', '全程可控：AI 每一步都可回看、可人工干预'].map((t) => (
        <Box key={t} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 18, color: '#1E5FBF', fontWeight: 'bold' }}>✓</Text>
          <Text style={{ fontSize: 16, color: '#5F6473', lineHeight: 1.6 }}>{t}</Text>
        </Box>
      ))}
    </Box>
  </Box>
  <Box style={{ position: 'absolute', left: 72, right: 72, bottom: 22, flexDirection: 'row', justifyContent: 'space-between' }}>
    <Text style={{ fontSize: 13, color: '#8B8FA3' }}>AI 播单编排工作台 · 产品演示</Text>
    <Text style={{ fontSize: 13, color: '#8B8FA3' }}>4 / 14</Text>
  </Box>
</Slide>