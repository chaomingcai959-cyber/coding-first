<Slide style={{ width: 1280, height: 720, background: '#FFFFFF', padding: '56px 72px', flexDirection: 'row', gap: 56 }}>
  <Box style={{ width: 320, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontSize: 150, fontWeight: 'bold', color: '#1E5FBF', lineHeight: 1 }}>3</Text>
    <Text style={{ fontSize: 20, color: '#5F6473', marginTop: 8 }}>种入库模式</Text>
    <Text style={{ fontSize: 14, color: '#8B8FA3', marginTop: 16, textAlign: 'center', lineHeight: 1.7 }}>覆盖频道编排的全部内容组合诉求</Text>
  </Box>
  <Box style={{ flex: 1, justifyContent: 'center', gap: 22 }}>
    {[
      ['插入开头', '新节目排在播单最前端，原节目顺延', '适合：头条节目、重点内容强推'],
      ['追加末尾', '新节目追加到播单最后，原有不变', '适合：常规扩充、日更补位'],
      ['清空覆盖', '原播单清空，仅保留本次选中节目', '适合：整单重排、方向性调整（需二次确认）'],
    ].map(([t, d, s]) => (
      <Box key={t} style={{ flexDirection: 'row', gap: 20, alignItems: 'center', background: '#EFF6FF', borderRadius: 14, padding: '20px 24px' }}>
        <Box style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, background: '#1E5FBF' }} />
        <Box style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1F2329' }}>{t}</Text>
          <Text style={{ fontSize: 14, color: '#5F6473', marginTop: 4, lineHeight: 1.6 }}>{d}</Text>
        </Box>
        <Text style={{ fontSize: 13, color: '#1E5FBF', maxWidth: 170, textAlign: 'right', lineHeight: 1.6 }}>{s}</Text>
      </Box>
    ))}
  </Box>
  <Box style={{ position: 'absolute', left: 72, right: 72, bottom: 22, flexDirection: 'row', justifyContent: 'space-between' }}>
    <Text style={{ fontSize: 13, color: '#8B8FA3' }}>AI 播单编排工作台 · 产品演示</Text>
    <Text style={{ fontSize: 13, color: '#8B8FA3' }}>8 / 14</Text>
  </Box>
</Slide>