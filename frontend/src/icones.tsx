// Ícones do guia de estilo (traço 2, cantos redondos, grade 24) mais o cadinho e o lingote
import type { ReactNode } from 'react';

const P = {
  pie: <><circle cx="12" cy="12" r="9" /><path d="M12 3V12H21" /></>,
  layers: <><path d="M12 2.5L2.5 7L12 11.5L21.5 7Z" /><path d="M2.5 12L12 16.5L21.5 12" /><path d="M2.5 17L12 21.5L21.5 17" /></>,
  sliders: <path d="M21 4H14M10 4H3M21 12H12M8 12H3M21 20H16M12 20H3M14 2V6M8 10V14M16 18V22" />,
  sigma: <path d="M18 7V4H6L12 12L6 20H18V17" />,
  check: <path d="M20 6L9 17L4 12" />,
  plus: <><path d="M5 12H19" /><path d="M12 5V19" /></>,
  chev: <path d="M9 18L15 12L9 6" />,
  alert: <><path d="M12 3L22 20H2Z" /><path d="M12 9V13" /><path d="M12 17H12.01" /></>,
  play: <path d="M6 3L20 12L6 21Z" />,
  trash: <><path d="M3 6H21" /><path d="M19 6V21H5V6" /><path d="M8 6V3H16V6" /></>,
  cadinho: <><path d="M3 7H21" /><path d="M5 7L6.6 18.3C6.7 19.3 7.6 20 8.6 20H15.4C16.4 20 17.3 19.3 17.4 18.3L19 7" /><path d="M7.5 11.5H16.5" /><path d="M12 2.5V4" /><path d="M8.5 3L9 4.2" /><path d="M15.5 3L15 4.2" /></>,
  lingote: <><path d="M2.5 19H16.5L14.5 13H4.5Z" /><path d="M4.5 13L7.5 9H17.5L14.5 13" /><path d="M16.5 19L21.5 15L17.5 9" /></>,
  sol: <><circle cx="12" cy="12" r="4" /><path d="M12 2V4M12 20V22M4.9 4.9L6.3 6.3M17.7 17.7L19.1 19.1M2 12H4M20 12H22M4.9 19.1L6.3 17.7M17.7 6.3L19.1 4.9" /></>,
  lua: <path d="M20 14.5A8 8 0 1 1 9.5 4A6.5 6.5 0 0 0 20 14.5Z" />,
} satisfies Record<string, ReactNode>;

export type NomeIcone = keyof typeof P;

export function Icone({ nome, tamanho = 20 }: { nome: NomeIcone; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[nome]}
    </svg>
  );
}
