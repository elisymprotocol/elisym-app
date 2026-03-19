function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const COLORS = ["#264653", "#2a9d8f", "#e9c46a", "#f4a261", "#e76f51"];

export function marbleAvatarSvg(name: string, size: number): string {
  const h = hashStr(name);
  const c1 = COLORS[h % 5]!;
  const c2 = COLORS[(h >> 4) % 5]!;
  const c3 = COLORS[(h >> 8) % 5]!;
  const x1 = 10 + (h % 80);
  const y1 = 10 + ((h >> 3) % 80);
  const x2 = 10 + ((h >> 6) % 80);
  const y2 = 10 + ((h >> 9) % 80);
  const x3 = 10 + ((h >> 12) % 80);
  const y3 = 10 + ((h >> 15) % 80);
  const r1 = 30 + (h % 40);
  const r2 = 25 + ((h >> 5) % 35);
  const r3 = 20 + ((h >> 10) % 30);
  const id = "ma" + String(h);
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="12"/></filter></defs>
    <rect width="100" height="100" fill="${c1}"/>
    <circle cx="${x1}" cy="${y1}" r="${r1}" fill="${c2}" filter="url(#${id})" opacity="0.8"/>
    <circle cx="${x2}" cy="${y2}" r="${r2}" fill="${c3}" filter="url(#${id})" opacity="0.8"/>
    <circle cx="${x3}" cy="${y3}" r="${r3}" fill="${c1 === c2 ? c3 : c1}" filter="url(#${id})" opacity="0.7"/>
  </svg>`;
}

export interface MarbleAvatarColors {
  bg: string;
  c1: string;
  c2: string;
  c3: string;
  positions: {
    x1: number;
    y1: number;
    r1: number;
    x2: number;
    y2: number;
    r2: number;
    x3: number;
    y3: number;
    r3: number;
  };
}

export function getMarbleColors(name: string): MarbleAvatarColors {
  const h = hashStr(name);
  const bg = COLORS[h % 5]!;
  const c1 = COLORS[(h >> 4) % 5]!;
  const c2 = COLORS[(h >> 8) % 5]!;
  return {
    bg,
    c1,
    c2,
    c3: bg === c1 ? c2 : bg,
    positions: {
      x1: 10 + (h % 80),
      y1: 10 + ((h >> 3) % 80),
      r1: 30 + (h % 40),
      x2: 10 + ((h >> 6) % 80),
      y2: 10 + ((h >> 9) % 80),
      r2: 25 + ((h >> 5) % 35),
      x3: 10 + ((h >> 12) % 80),
      y3: 10 + ((h >> 15) % 80),
      r3: 20 + ((h >> 10) % 30),
    },
  };
}
