'use client';

import s from './SectorFilter.module.css';

interface SectorFilterProps {
  sectors: string[];
  value: string;
  onChange: (sector: string) => void;
}

export function SectorFilter({ sectors, value, onChange }: SectorFilterProps) {
  return (
    <div className={s.filter}>
      {sectors.map((sector) => {
        const active = value === sector;
        return (
          <button
            key={sector}
            onClick={() => onChange(sector)}
            className={`${s.btn} ${active ? s.active : s.inactive}`}
          >
            {sector}
          </button>
        );
      })}
    </div>
  );
}
