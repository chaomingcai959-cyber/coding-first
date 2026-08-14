<Slide style={{ width: 1280, height: 720, background: '#FFFFFF', padding: '56px 72px', flexDirection: 'row', gap: 48 }}>
  <Box style={{ flex: 1, borderRadius: 20, border: '1px solid #DDE7F5', background: '#EFF6FF', padding: 24, justifyContent: 'center', gap: 18 }}>
    <Box style={{ flexDirection: 'row', gap: 18 }}>
      <Box style={{ width: 240, borderRadius: 12, background: '#FFFFFF', padding: 16, gap: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1E5FBF' }}>左栏 · 频道</Text>
        <Box style={{ height: 34, borderRadius: 8, background: '#EFF6FF' }} />
        <Box style={{ height: 70, borderRadius: 8, background: '#FFFFFF', border: '1px solid #1E5FBF' }} />
        <Box style={{ height: 70, borderRadius: 8, background: '#FFFFFF', border: '1px solid #DDE7F5' }} />
      </Box>
      <Box style={{ flex: 1, borderRadius: 12, background: '#FFFFFF', padding: 16, gap: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1E5FBF' }}>中栏 · 播单</Text>
        <Box style={{ height: 24, borderRadius: 6, background: '#DDE7F5' }} />
        {[0, 1, 2, 3].map((i) => <Box key={i} style={{ height: 18, borderRadius: 6, background: i === 1 ? '#1E5FBF' : '#EFF6FF' }} />)}
      </Box>
    </Box>
    <Box style={{ borderRadius: 12, background: '#FFFFFF', padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1E5FBF' }}>右栏 · AI 面板</Text>
      <Box style={{ height: 26, width: '60%', borderRadius: 8, background: '#EFF6FF', alignSelf: 'flex-end' }} />
      <Box style={{ height: 26, width: '80%', borderRadius: 8, background: '#1E5FBF', opacity: 0.85 }} />
    </Box>
  </Box>
  <Box style={{ width: 380, justifyContent: 'center', gap: 20 }}>
    <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#1F2329', lineHeight: 1.4 }}>一个页面<br />承载编排全流程</Text>
    <Text style={{ fontSize: 15, color: '#5F6473', lineHeight: 1.9 }}>
      左栏选频道、中栏看播单、右栏与 AI 对话——三栏联动，编排的所有动作都在一个页面上完成，无需在多个界面间跳转。
    </Text>
  </Box>
  <Box style={{ position: 'absolute', left: 72, right: 72, bottom: 22, flexDirection: 'row', justifyContent: 'space-between' }}>
    <Text style={{ fontSize: 13, color: '#8B8FA3' }}>AI 播单编排工作台 · 产品演示</Text>
    <Text style={{ fontSize: 13, color: '#8B8FA3' }}>5 / 14</Text>
  </Box>
</Slide>