import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateEmbedding, buildProductEmbeddingText } from '@/lib/openai';
import { normalizeAliases, normalizeCategory } from '@/lib/products';
import { NextRequest } from 'next/server';

async function getBusiness(userId: string) {
  return prisma.business.findUnique({ where: { userId }, select: { id: true } });
}

export async function PATCH(req: NextRequest, { params }: { params: { productId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const business = await getBusiness(session.user.id);
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

  const existing = await prisma.product.findFirst({
    where: { id: params.productId, businessId: business.id },
  });
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

  const { name, description, price, category, aliases, metadata } = await req.json();
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

  await prisma.$executeRawUnsafe(
    `UPDATE products
     SET name=$1, description=$2, category=$3, aliases=$4::text[], price=$5,
         embedding=$6::vector, metadata=$7::jsonb
     WHERE id=$8 AND business_id=$9`,
    name,
    description ?? null,
    fields.category,
    fields.aliases,
    price ?? null,
    vectorStr,
    JSON.stringify(metadata ?? {}),
    params.productId,
    business.id
  );

  return Response.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { productId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const business = await getBusiness(session.user.id);
  if (!business) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await prisma.product.deleteMany({
    where: { id: params.productId, businessId: business.id },
  });
  if (result.count === 0) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json({ success: true });
}
