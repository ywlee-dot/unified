const sharp = require('sharp');

async function createGradientBackground() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#0a0a1a"/>
        <stop offset="50%" style="stop-color:#1a1a3e"/>
        <stop offset="100%" style="stop-color:#0d2137"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile('workspace/bg-gradient.png');
}

async function createArrow(name, color, w, h, direction) {
  let points;
  if (direction === 'right') {
    points = `0,3 ${w-6},3 ${w-6},0 ${w},${h/2} ${w-6},${h} ${w-6},${h-3} 0,${h-3}`;
  } else {
    points = `3,0 ${w-3},0 ${w-3},${h-6} ${w},${h-6} ${w/2},${h} 0,${h-6} 3,${h-6}`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <polygon points="${points}" fill="#${color}"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`workspace/${name}.png`);
}

(async () => {
  await Promise.all([
    createGradientBackground(),
    createArrow('arrow-right', '4dd0e1', 20, 12, 'right'),
    createArrow('arrow-down', '4dd0e1', 12, 18, 'down'),
    createArrow('arrow-down-sm', '64b5f6', 10, 14, 'down'),
  ]);
  console.log('Assets created');
})();
