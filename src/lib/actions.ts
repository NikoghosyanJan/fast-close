'use server';

export async function parseProductInput(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  const blocks = trimmed.split(/\n{2,}/);
  return blocks.map(block => {
    const lines = block.split('\n');
    return {
      name: lines[0] ?? 'Unnamed Product',
      description: lines.slice(1).join(' ').trim() || undefined,
    };
  });
}
