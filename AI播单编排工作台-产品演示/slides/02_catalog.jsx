<Slide style={{ width: 1280, height: 720, background: '#FFFFFF', padding: 0, display: 'flex', flexDirection: 'row' }}>
  <Box style={{ width: 420, background: '#1E5FBF', padding: '60px 48px', justifyContent: 'center' }}>
    <Text style={{ fontSize: 40, fontWeight: 'bold', color: '#FFFFFF' }}>目录</Text>
    <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: 12, lineHeight: 1.7 }}>从产品定位到能力演示，再到协作安全与工程底座，四步讲清一套真实可用的 AI 播单编排系统。</Text>
  </Box>
  <Box style={{ flex: 1, padding: '64px 72px', justifyContent: 'center', gap: 30 }}>
    {[
      ['01', '产品定位', '从"人工排单"到"AI 指挥"'],
      ['02', '能力演示', '对话生成 · 三种入库 · 双向联动'],
      ['03', '协作与安全', '多人协作编辑锁 · 全程留痕'],
      ['04', '工程底座', '真实可用的系统'],
    ].map(([n, t, d]) => (
      <Box key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 28, borderBottom: '1px solid #DDE7F5', paddingBottom: 24 }}>
        <Text style={{ fontSize: 34, fontWeight: 'bold', color: '#1E5FBF', width: 84 }}>{n}</Text>
        <Box style={{ flex: 1 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1F2329' }}>{t}</Text>
          <Text style={{ fontSize: 14, color: '#5F6473', marginTop: 4 }}>{d}</Text>
        </Box>
      </Box>
    ))}
  </Box>
  <Box style={{ position: 'absolute', left: 72, right: 72, bottom: 22, flexDirection: 'row', justifyContent: 'space-between' }}>
    <Text style={{ fontSize: 13, color: '#8B8FA3' }}>AI 播单编排工作台 · 产品演示</Text>
    <Text style={{ fontSize: 13, color: '#8B8FA3' }}>2 / 14</Text>
  </Box>
</Slide>