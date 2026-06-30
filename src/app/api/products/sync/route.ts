import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateEmbedding, buildProductEmbeddingText } from '@/lib/openai';
import { parseProductInput } from '@/lib/actions';
import { normalizeAliases, normalizeCategory } from '@/lib/products';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id }, select: { id: true },
  });
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

  const { raw } = await req.json();
  if (!raw) return Response.json({ error: 'No data provided' }, { status: 400 });

  const products = await parseProductInput(raw);

  await prisma.product.deleteMany({ where: { businessId: business.id } });

  let synced = 0;
  const errors: string[] = [];

  for (const product of products) {
    try {
      const fields = {
        name: product.name,
        description: product.description,
        price: product.price,
        category: normalizeCategory(product.category),
        aliases: normalizeAliases(product.aliases),
        metadata: product.metadata,
      };
      const embeddingText = buildProductEmbeddingText(fields);
      const embedding = await generateEmbedding(embeddingText);
      const vectorStr = `[${embedding.join(',')}]`;

      await prisma.$executeRawUnsafe(
        `INSERT INTO products
           (id, business_id, name, description, category, aliases, price, embedding, metadata, created_at)
         VALUES
           (gen_random_uuid(), $1, $2, $3, $4, $5::text[], $6, $7::vector, $8::jsonb, NOW())`,
        business.id,
        fields.name,
        fields.description ?? null,
        fields.category,
        fields.aliases,
        fields.price ?? null,
        vectorStr,
        JSON.stringify(fields.metadata ?? {})
      );
      synced++;
    } catch (e) {
      console.error(`[Sync] failed for "${product.name}":`, e);
      errors.push(`${product.name}: ${String(e)}`);
    }
  }

  return Response.json({ synced, errors });
}
