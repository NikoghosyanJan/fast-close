import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';
import { getAppBaseUrl, tableChatUrl } from '@/lib/app-url';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { tableId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!business) return new Response('Not found', { status: 404 });

  const table = await prisma.table.findFirst({
    where: { id: params.tableId, businessId: business.id },
    select: { id: true, name: true, number: true },
  });
  if (!table) return new Response('Table not found', { status: 404 });

  const appUrl = getAppBaseUrl();
  const chatUrl = tableChatUrl(appUrl, business.id, table.id);
  console.log('[QR] encoding table chat URL:', chatUrl);

  const png = await QRCode.toBuffer(chatUrl, {
    type: 'png',
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="table-${table.number}-qr.png"`,
      // Avoid stale QR images that encoded an old host (e.g. vercel.app)
      'Cache-Control': 'no-store',
      'X-Chat-Url': chatUrl,
    },
  });
}
