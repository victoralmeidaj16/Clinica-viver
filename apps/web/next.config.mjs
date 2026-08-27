import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendOrigin =
  process.env.BACKEND_ORIGIN?.trim().replace(/\/$/, '') ||
  (process.env.VERCEL ? 'https://app.clinicavivermais.cloud' : undefined);

if (backendOrigin && !backendOrigin.startsWith('https://')) {
  throw new Error('BACKEND_ORIGIN precisa usar HTTPS.');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(appDirectory, '../..'),
  transpilePackages: ['@thats-life/core'],
  async rewrites() {
    if (!backendOrigin) return [];

    // A Vercel continua servindo páginas, assets e o bundle desta aplicação.
    // Apenas as rotas que dependem do estado permanente atravessam HTTPS até
    // o backend na VPS Hostinger, onde o MySQL privado é alcançável.
    return [
      {
        source: '/api/application/:path*',
        destination: `${backendOrigin}/api/application/:path*`,
      },
      {
        source: '/api/agenda/:path*',
        destination: `${backendOrigin}/api/agenda/:path*`,
      },
      {
        source: '/api/auth/:path*',
        destination: `${backendOrigin}/api/auth/:path*`,
      },
      {
        source: '/api/infra/:path*',
        destination: `${backendOrigin}/api/infra/:path*`,
      },
      {
        source: '/api/pagamento/:path*',
        destination: `${backendOrigin}/api/pagamento/:path*`,
      },
      {
        source: '/api/financeiro/asaas/:path*',
        destination: `${backendOrigin}/api/financeiro/asaas/:path*`,
      },
      {
        source: '/api/financeiro/inter/:path*',
        destination: `${backendOrigin}/api/financeiro/inter/:path*`,
      },
      {
        source: '/api/certificados/:path*',
        destination: `${backendOrigin}/api/certificados/:path*`,
      },
      {
        source: '/api/public/certificados/:path*',
        destination: `${backendOrigin}/api/public/certificados/:path*`,
      },
    ];
  },
};

export default nextConfig;
