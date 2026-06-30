import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateEmbedding, buildProductEmbeddingText } from '@/lib/openai';
import { normalizeAliases, normalizeCategory } from '@/lib/products';
import { NextRequest } from 'next/server';

async function getBusiness(userId: string) {
  return prisma.business.findUnique({ where: { userId }, select: { id: true } });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const business = await getBusiness(session.user.id);
  if (!business) return Response.json({ products: [] });

  const products = await prisma.product.findMany({
    where: { businessId: business.id },
    select: {
      id: true, name: true, description: true, category: true, aliases: true,
      price: true, metadata: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return Response.json({
    products: products.map(p => ({
      ...p,
      price: p.price ? Number(p.price) : null,
      created_at: p.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const business = await getBusiness(session.user.id);
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

  const { name, description, price, category, aliases, metadata } = await req.json();
  if (!name) return Response.json({ error: 'Name required' }, { status: 400 });

  const fields = {
    name,
    description,
    price,
    category: normalizeCategory(category),
    aliases: normalizeAliases(aliases),
    metadata,
  };
  const embeddingText = buildProductEmbeddingText(fields);
  const embedding = await generateEmbedding(embeddingText);
  const vectorStr = `[${embedding.join(',')}]`;
  const aliasArr = fields.aliases;

  const product = await prisma.$queryRawUnsafe(
    `INSERT INTO products (id, business_id, name, description, category, aliases, price, embedding, metadata, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::text[], $6, $7::vector, $8::jsonb, NOW())
     RETURNING id, name, description, category, aliases, price::float, metadata, created_at`,
    business.id,
    name,
    description ?? null,
    fields.category,
    aliasArr,
    price ?? null,
    vectorStr,
    JSON.stringify(metadata ?? {})
  );

  return Response.json({ product: (product as { id: string }[])[0] });
}
