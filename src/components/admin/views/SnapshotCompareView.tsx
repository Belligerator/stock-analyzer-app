import type { AdminViewServerProps } from 'payload';
import { DefaultTemplate } from '@payloadcms/next/templates';
import { SnapshotCompareClient } from './SnapshotCompareClient';

export const SnapshotCompareView = (props: AdminViewServerProps) => {
  const { initPageResult, params, searchParams } = props;
  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={initPageResult.req.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <SnapshotCompareClient />
    </DefaultTemplate>
  );
};
