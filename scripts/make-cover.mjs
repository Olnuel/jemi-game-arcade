// Generates cover.png (16:10) for the start.ng game card.
import sharp from 'sharp';

const W = 1600, H = 1000;
const stall = (x, accent) => {
  const w = 214, y = 838;
  const scallop = Array.from({ length: 5 }, (_, s) =>
    `<path d="M${x + 8 + s * 40} ${y - 70} a 20 20 0 0 0 40 0 z" fill="${accent}"/>`).join('');
  const stripes = Array.from({ length: 7 }, (_, s) =>
    `<rect x="${x + 6 + s * 29}" y="${y - 96}" width="29" height="26" fill="${s % 2 ? '#160b0f' : accent}"/>`).join('');
  return `${stripes}${scallop}
    <rect x="${x + 6}" y="${y - 44}" width="${w - 12}" height="44" fill="#241216"/>
    <rect x="${x + 18}" y="${y - 36}" width="${w - 36}" height="28" fill="${accent}" opacity="0.22"/>
    <rect x="${x}" y="${y}" width="${w}" height="12" fill="#2e1a1c"/>
    <rect x="${x + 10}" y="${y + 12}" width="10" height="150" fill="#1a0e12"/>
    <rect x="${x + w - 20}" y="${y + 12}" width="10" height="150" fill="#1a0e12"/>`;
};

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xml:space="preserve">
  <defs>
    <radialGradient id="glowA" cx="20%" cy="12%" r="60%">
      <stop offset="0%" stop-color="#4a1a5c"/><stop offset="100%" stop-color="#4a1a5c" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="86%" cy="92%" r="56%">
      <stop offset="0%" stop-color="#7a3d06"/><stop offset="100%" stop-color="#7a3d06" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a0c13"/><stop offset="55%" stop-color="#11070b"/><stop offset="100%" stop-color="#0a0507"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffcc00"/><stop offset="100%" stop-color="#ff5722"/>
    </linearGradient>
    <linearGradient id="band" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00a05a"/><stop offset="100%" stop-color="#00713e"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0507" stop-opacity="0"/><stop offset="100%" stop-color="#0a0507" stop-opacity="0.85"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#base)"/>
  <rect width="${W}" height="${H}" fill="url(#glowA)"/>
  <rect width="${W}" height="${H}" fill="url(#glowB)"/>

  <path d="M0 128 Q 200 190 400 140 T 800 155 T 1200 132 T 1600 148" stroke="#3a2a22" stroke-width="3" fill="none"/>
  ${Array.from({ length: 15 }, (_, i) => {
    const x = 50 + i * 108;
    const y = 146 + Math.sin(i * 0.82) * 20;
    const c = ['#ffcc00', '#ff7847', '#ffd23f'][i % 3];
    return `<circle cx="${x}" cy="${y}" r="8" fill="${c}"/><circle cx="${x}" cy="${y}" r="19" fill="${c}" opacity="0.2"/>`;
  }).join('')}

  <g>${stall(40, '#ffcc00')}${stall(310, '#ff7847')}${stall(580, '#00a05a')}${stall(850, '#ffcc00')}${stall(1120, '#ffd23f')}${stall(1390, '#ff7847')}</g>
  <rect x="0" y="700" width="${W}" height="300" fill="url(#fade)" opacity="0.55"/>

  <rect x="92" y="232" width="228" height="10" fill="url(#bar)"/>

  <text x="88" y="414" font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="164"
        font-weight="900" letter-spacing="-4" fill="#ffcc00">JEMI</text>
  <text x="88" y="566" font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="132"
        font-weight="900" letter-spacing="-3" fill="#fff3dc">GAME ARCADE</text>

  <text x="92" y="638" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700"
        letter-spacing="5" fill="#e3d2c0">IDENTITY DASH  &#183;  AVATAR JUMP  &#183;  SALUBATA</text>

  <g>
    <rect x="92" y="678" width="252" height="52" rx="26" fill="url(#band)"/>
    <text x="218" y="713" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700"
          letter-spacing="3" fill="#ffffff" text-anchor="middle">NIGHT MARKET</text>
    <rect x="362" y="678" width="200" height="52" rx="26" fill="none" stroke="#ffcc00" stroke-width="3"/>
    <text x="462" y="713" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700"
          letter-spacing="3" fill="#ffcc00" text-anchor="middle">THREE.JS</text>
  </g>

  <g>
    <rect x="${W - 352}" y="62" width="260" height="74" rx="37" fill="#0b0608" stroke="#4a2c2a" stroke-width="3"/>
    <circle cx="${W - 302}" cy="99" r="15" fill="#00a05a"/>
    <text x="${W - 274}" y="110" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700"
          fill="#fff3dc">start<tspan fill="#00a05a">.ng</tspan></text>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png({ quality: 92 }).toFile('cover.png');
console.log('cover.png written');