/**
 * Canonical public base URL for QR codes, webhooks, and share links.
 * Always prefer NEXT_PUBLIC_APP_URL — never VERCEL_URL (that is a per-deploy preview host).
 */
export function getAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (fromEnv && !/your-app\.vercel\.app/i.test(fromEnv)) {
    return fromEnv;
  }

  // Stable production hostname on Vercel (not the unique preview deployment URL)
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProd) {
    return `https://${vercelProd.replace(/^https?:\/\//, '')}`.replace(/\/$/, '');
  }

  return 'http://localhost:3000';
}

export function tableChatUrl(baseUrl: string, businessId: string, tableId: string): string {
  return `${baseUrl.replace(/\/$/, '')}/chat/${businessId}/table/${tableId}`;
}
