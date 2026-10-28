import React from 'react';

/* Code 39 — cada caractere tem 9 elementos (barras e espaços alternados, começando em barra).
   n = estreito, w = largo. Exibido como SVG vetorial, pronto para impressão. */

const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  $: 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn',
};

export function sanitizeCode39(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, '-');
}

export function Code39({ value, height = 46, module = 2, showText = true }: {
  value: string;
  height?: number;
  module?: number;
  showText?: boolean;
}) {
  const text = '*' + sanitizeCode39(value) + '*';
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (const ch of text) {
    const pat = CODE39[ch] ?? CODE39['-'];
    for (let i = 0; i < 9; i++) {
      const w = (pat[i] === 'w' ? 2 : 1) * module;
      if (i % 2 === 0) bars.push({ x, w });
      x += w;
    }
    x += module;
  }
  return (
    <svg
      className='barcode'
      viewBox={`0 0 ${x} ${height}`}
      preserveAspectRatio='xMidYMid meet'
      role='img'
      aria-label={`Código de barras ${value}`}
    >
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} />
      ))}
      {showText && (
        <text x={x / 2} y={height + 12} textAnchor='middle' className='barcode-text'>
          {sanitizeCode39(value)}
        </text>
      )}
    </svg>
  );
}
