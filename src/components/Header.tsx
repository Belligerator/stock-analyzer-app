import { formatDate } from '../utils/format';
import pkg from '../../package.json';
import s from './Header.module.css';

interface HeaderProps {
  dataAsOf: string;
  sources: string[];
  rightSlot?: React.ReactNode;
}

export function Header({ dataAsOf, sources, rightSlot }: HeaderProps) {
  return (
    <div className={s.header}>
      <div className={s.left}>
        <h1 className={s.title}>Akciový přehled — {formatDate(dataAsOf)}</h1>
        <p className={s.source}>
          {sources.map((s) => s.replace(/^https?:\/\//, '').replace(/\/$/, '')).join(' · ')}
          <span className={s.version}>v{pkg.version}</span>
        </p>
      </div>
      {rightSlot && <div className={s.right}>{rightSlot}</div>}
    </div>
  );
}
