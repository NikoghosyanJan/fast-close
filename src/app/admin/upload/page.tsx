'use client';

import { useState, useEffect, useTransition } from 'react';
import { toast } from 'sonner';
import { Upload, RefreshCw, Plus, ChevronDown, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { getBusinesses, createBusiness, parseProductInput, syncProducts } from '@/lib/actions';
import type { SyncResult } from '@/types';
import Link from 'next/link';

const EXAMPLE_JSON = `[
  {
    "name": "Wireless Noise-Cancelling Headphones",
    "description": "Premium over-ear headphones with 30h battery life, ANC, and foldable design.",
    "price": 149.99,
    "metadata": { "brand": "SoundPro", "color": "Midnight Black", "warranty": "2 years" }
  },
  {
    "name": "Ergonomic Office Chair",
    "description": "Lumbar support, adjustable armrests, breathable mesh back. Perfect for long sessions.",
    "price": 299.00,
    "metadata": { "brand": "ComfortDesk", "weight_limit": "150kg" }
  },
  {
    "name": "USB-C Hub 7-in-1",
    "description": "Expand your laptop with HDMI 4K, 3x USB-A, SD card, and 100W PD charging.",
    "price": 49.99,
    "metadata": { "compatibility": "MacBook, Windows, iPad Pro" }
  }
]`;

export default function AdminUploadPage() {
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [result, setResult] = useState<SyncResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // Create business modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newBizName, setNewBizName] = useState('');
  const [newBizPrompt, setNewBizPrompt] = useState('');

  useEffect(() => {
    getBusinesses().then(setBusinesses).catch(console.error);
  }, []);

  const handleSync = () => {
    if (!selectedBusiness) {
      toast.error('Please select a business first.');
      return;
    }
    if (!rawInput.trim()) {
      toast.error('Please paste your product data.');
      return;
    }

    startTransition(async () => {
      try {
        const products = await parseProductInput(rawInput);
        const res = await syncProducts(selectedBusiness, products);
        setResult(res);

        if (res.success) {
          toast.success(`✅ Synced ${res.synced} products successfully!`);
        } else {
          toast.warning(`Synced ${res.synced} products with ${res.errors.length} error(s).`);
        }
      } catch (err) {
        toast.error(`Parse error: ${String(err)}`);
      }
    });
  };

  const handleCreateBusiness = () => {
    if (!newBizName.trim()) return;

    startTransition(async () => {
      try {
        const biz = await createBusiness(newBizName, newBizPrompt);
        setBusinesses((prev) => [...prev, { id: biz.id, name: biz.name }]);
        setSelectedBusiness(biz.id);
        setShowCreate(false);
        setNewBizName('');
        setNewBizPrompt('');
        toast.success(`Business "${biz.name}" created!`);
      } catch (err) {
        toast.error(String(err));
      }
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between bg-card">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
            FastClose<span className="text-primary"> AI</span>
          </span>
        </Link>
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full font-medium">
          Admin Dashboard
        </span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>
            Product Catalog Sync
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Paste your product data and generate AI embeddings for your chatbot.
          </p>
        </div>

        {/* Step 1: Select business */}
        <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Step 1 — Select Business
          </h2>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <select
                value={selectedBusiness}
                onChange={(e) => setSelectedBusiness(e.target.value)}
                className="w-full appearance-none bg-background border border-border rounded-xl px-4 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">— Choose a business —</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>

            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              <Plus className="w-4 h-4" /> New
            </button>
          </div>

          {showCreate && (
            <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/50 animate-fade-in">
              <input
                value={newBizName}
                onChange={(e) => setNewBizName(e.target.value)}
                placeholder="Business name *"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <textarea
                value={newBizPrompt}
                onChange={(e) => setNewBizPrompt(e.target.value)}
                placeholder="Custom system prompt (optional) — e.g. 'You are a friendly assistant for a luxury watch boutique...'"
                rows={3}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateBusiness}
                  disabled={!newBizName.trim() || isPending}
                  className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
                >
                  Create Business
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-lg text-sm hover:bg-muted transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {selectedBusiness && (
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
              <span>
                Chat URL:{' '}
                <code className="text-foreground font-mono">
                  /chat/{selectedBusiness}
                </code>
              </span>
              <Link
                href={`/chat/${selectedBusiness}`}
                target="_blank"
                className="text-primary font-medium hover:underline"
              >
                Open →
              </Link>
            </div>
          )}
        </section>

        {/* Step 2: Paste products */}
        <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Step 2 — Paste Product Data
            </h2>
            <button
              onClick={() => setRawInput(EXAMPLE_JSON)}
              className="text-xs text-primary hover:underline font-medium"
            >
              Load example
            </button>
          </div>

          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder={`Paste JSON array of products or plain text.\n\nExample:\n[\n  { "name": "Product A", "description": "...", "price": 99.99 }\n]`}
            rows={14}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-none leading-relaxed"
          />

          <p className="text-xs text-muted-foreground">
            Accepted:{' '}
            <code className="bg-muted px-1 rounded">JSON array</code> with{' '}
            <code className="bg-muted px-1 rounded">name</code>,{' '}
            <code className="bg-muted px-1 rounded">description</code>,{' '}
            <code className="bg-muted px-1 rounded">price</code>,{' '}
            <code className="bg-muted px-1 rounded">metadata</code> — or plain text (one product per paragraph).
          </p>
        </section>

        {/* Sync button */}
        <button
          onClick={handleSync}
          disabled={isPending || !selectedBusiness || !rawInput.trim()}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition shadow-lg shadow-primary/25"
        >
          {isPending ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Generating embeddings…
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" /> Sync Products
            </>
          )}
        </button>

        {/* Result */}
        {result && (
          <div
            className={`border rounded-2xl p-5 space-y-3 animate-fade-in ${
              result.success
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {result.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600" />
              )}
              {result.success
                ? `${result.synced} products synced successfully`
                : `${result.synced} synced, ${result.errors.length} failed`}
            </div>

            {result.errors.length > 0 && (
              <ul className="text-xs space-y-1 list-disc list-inside opacity-80">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
