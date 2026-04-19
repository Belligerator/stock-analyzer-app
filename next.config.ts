import type { NextConfig } from 'next';
import { withPayload } from '@payloadcms/next/withPayload';

const nextConfig: NextConfig = {
  // Allow access to dev server from LAN (e.g. phone testing).
  allowedDevOrigins: ['192.168.0.125'],
};

export default withPayload(nextConfig);
