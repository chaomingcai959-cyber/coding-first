<Slide style={{ width: 1280, height: 720, background: '#FFFFFF', padding: '56px 72px', flexDirection: 'row', gap: 56 }}>
  <Box style={{ width: 430, borderRadius: 20, background: 'linear-gradient(150deg, #0F3E8E 0%, #1E5FBF 100%)', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
    <Text style={{ fontSize: 88 }}>🔒</Text>
    <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#FFFFFF' }}>一个频道，一个编辑</Text>
    <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, textAlign: 'center', padding: '0 36px' }}>同一时刻仅一人持有编辑锁，其余用户进入只读模式，杜绝互相覆盖</Text>
  </Box>
  <Box style={{ flex: 1, justifyContent: 'center', gap: 20 }}>
    {[
      ['进入即申领', '选中频道自动申领编辑锁，操作无需抢占等待'],
      ['占用即只读', '他人编辑中进入：提示占用，可实时查看不可编辑'],
      ['保存即同步', '编辑完成后，所有在线查看者自动刷新为最新版本'],
      ['异常自动释放', '断线、关页 30 分钟后锁自动释放，不永久占用'],
    ].map(([t, d]) => (
      <Box key={t} style={{ flexDirection: 'row', gap: 16, alignItems: 'center', background: '#EFF6FF', borderRadius: 12, padding: '16px 20px' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E5FBF', width: 110, flexShrink: 0 }}>{t}</Text>
        <Text style={{ fontSize: 14, color: '#5F6473', lineHeight: 1.6 }}>{d}</Text>
      </Box>
    ))}
  </Box>
  <Box style={{ position: 'absolute', left: 72, right: 72, bottom: 22, flexDirection: 'row', justifyContent: 'space-between' }}>
    <Text style={{ fontSize: 13, color: '#8B8FA3' }}>AI 播单编排工作台 · 产品演示</Text>
    <Text style={{ fontSize: 13, color: '#8B8FA3' }}>11 / 14</Text>
  </Box>
</Slide>