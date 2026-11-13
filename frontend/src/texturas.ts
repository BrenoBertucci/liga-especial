// Colmeia de hexágonos no canto dos cartões de elemento. Traço branco translúcido: em cada metal ela
// sai num tom mais claro da própria cor. Vira a variável CSS --tx-colmeia no :root.
const RAIO = 40;
const ALTURA = Math.sqrt(3) * RAIO;

function hexagono(cx: number, cy: number) {
  const pontos = [0, 60, 120, 180, 240, 300].map((g) => {
    const a = (g * Math.PI) / 180;
    return `${(cx + RAIO * Math.cos(a)).toFixed(1)},${(cy + RAIO * Math.sin(a)).toFixed(1)}`;
  });
  return `<polygon points='${pontos.join(' ')}'/>`;
}

let celulas = '';
for (let col = 0; col < 7; col++) {
  for (let lin = -1; lin < 5; lin++) {
    celulas += hexagono(640 - col * 1.5 * RAIO, lin * ALTURA + (col % 2 ? ALTURA / 2 : 0));
  }
}

// Só o canto de cima à direita aparece; some antes de chegar no texto
const svg =
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 300' preserveAspectRatio='xMaxYMin slice'>` +
  `<defs><radialGradient id='g' cx='1' cy='0' r='0.52'><stop offset='0' stop-color='#fff' stop-opacity='0.42'/><stop offset='0.55' stop-color='#fff' stop-opacity='0.16'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></radialGradient>` +
  `<mask id='m'><rect width='600' height='300' fill='url(#g)'/></mask></defs>` +
  `<g mask='url(#m)' fill='none' stroke='#fff' stroke-width='1.6'>${celulas}</g></svg>`;

document.documentElement.style.setProperty('--tx-colmeia', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
