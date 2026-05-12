import Link from 'next/link';
import { Zap, MessageSquare, BarChart3, ArrowRight, Send } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      <nav className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
            FastClose<span className="text-primary"> AI</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Sign in
          </Link>
          <Link href="/auth/register" className="text-sm font-semibold bg-primary text-white px-4 py-2 rounded-xl hover:opacity-90 transition">
            Get started
          </Link>
        </div>
      </nav>

      <section className="flex-1 flex flex-col items-center justify-center px-6 text-center py-24 gap-8">
        <div className="inline-flex items-center gap-2 bg-accent text-accent-foreground rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          AI Sales Automation
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-3xl leading-[1.05]">
          Close deals while<br /><span className="text-primary">you sleep.</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl leading-relaxed">
          FastClose AI deploys a product-aware chatbot on your storefront and Telegram that answers questions, qualifies leads, and captures contacts — 24/7.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/auth/register" className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition shadow-lg shadow-primary/30">
            Start for free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/auth/login" className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-xl font-semibold text-sm hover:bg-muted transition-colors">
            Sign in
          </Link>
        </div>
      </section>

      <section className="px-6 pb-16 flex flex-wrap justify-center gap-4 max-w-3xl mx-auto">
        {[
          { icon: Zap, label: 'RAG-powered answers from your catalog' },
          { icon: MessageSquare, label: 'Web chat widget for your site' },
          { icon: Send, label: 'Telegram bot integration' },
          { icon: BarChart3, label: 'Automatic lead capture' },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-4 py-3 text-sm font-medium shadow-sm">
            <Icon className="w-4 h-4 text-primary" />{label}
          </div>
        ))}
      </section>
    </main>
  );
}
