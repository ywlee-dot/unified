const pptxgen = require('pptxgenjs');
const path = require('path');
const html2pptx = require(path.join(process.env.HOME, '.claude/skills/pptx/scripts/html2pptx.js'));

async function main() {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Claude';
  pptx.title = 'RAG System Architecture';

  await html2pptx(path.resolve('workspace/slide1.html'), pptx);

  await pptx.writeFile({ fileName: path.resolve('RAG_Architecture_Diagram.pptx') });
  console.log('Presentation created: RAG_Architecture_Diagram.pptx');
}

main().catch(e => { console.error(e); process.exit(1); });
