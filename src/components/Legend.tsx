import s from './Legend.module.css';

interface LegendProps {
  disclaimer?: string;
}

export function Legend({ disclaimer }: LegendProps) {
  if (!disclaimer) return null;

  return <div className={s.legend}>⚠ {disclaimer}</div>;
}
