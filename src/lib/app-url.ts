/**
 * Resolve the public base URL for absolute links (QR codes, webhooks, share URLs).
 *
 * Preference order:
 * 1. Incoming request host (so dashboard QR matches the site you're viewing)
 * 2. NEXT_PUBLIC_APP_URL (canonical override; ignore placeholder)
 * 3. Vercel production / deployment URL
 * 4. localhost
 */
export function getAppBaseUrl(req?: Request): string {
  if (req) {
    const hostHeader = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    const host = hostHeader?.split(',')[0]?.trim();
    if (host) {
      const protoHeader = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
      const proto =
        protoHeader ||
        (req.headers.get('x-forwarded-ssl') === 'on' ? 'https' : null) ||
        (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
      return `${proto}://${host}`.replace(/\/$/, '');
    }
  }

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (fromEnv && !/your-app\.vercel\.app/i.test(fromEnv)) {
    return fromEnv;
  }

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProd) return `https://${vercelProd.replace(/^https?:\/\//, '')}`.replace(/\/$/, '');

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, '')}`.replace(/\/$/, '');

  return 'http://localhost:3000';
}

export function tableChatUrl(baseUrl: string, businessId: string, tableId: string): string {
  return `${baseUrl.replace(/\/$/, '')}/chat/${businessId}/table/${tableId}`;
}
