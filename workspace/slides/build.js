const pptxgen = require('pptxgenjs');
const html2pptx = require('/home/iamooo/.claude/skills/pptx/scripts/html2pptx');
const path = require('path');

async function build() {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Unified Workspace';
  pptx.title = 'Unified Workspace - 시스템 아키텍처 & 모듈 구성';

  await html2pptx(path.join(__dirname, 'slide1.html'), pptx);
  await html2pptx(path.join(__dirname, 'slide2.html'), pptx);

  const outPath = path.join(__dirname, '..', 'unified-workspace-overview.pptx');
  await pptx.writeFile({ fileName: outPath });
  console.log('Created:', outPath);
}

build().catch(e => { console.error(e); process.exit(1); });
