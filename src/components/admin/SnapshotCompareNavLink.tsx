import Link from 'next/link';

export const SnapshotCompareNavLink = () => {
  return (
    <Link
      href="/admin/snapshots/compare"
      style={{
        display: 'block',
        padding: '0px 12px',
        fontSize: '13px',
        color: 'var(--theme-text)',
        textDecoration: 'none',
        borderRadius: '4px',
      }}
    >
      Compare snapshots
    </Link>
  );
};
