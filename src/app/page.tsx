import Link from 'next/link';
import { Zap, MessageSquare, Send, ArrowRight, CheckCircle2, TrendingUp, Clock, DollarSign, Shield, Star, ChevronRight } from 'lucide-react';

const PAIN_STATS = [
  { stat: '62%', label: 'of customers leave if not answered within 1 hour' },
  { stat: '$1.6T', label: 'lost annually by businesses due to poor customer service' },
  { stat: '40hrs', label: 'per week your team spends answering repetitive questions' },
];

const BENEFITS = [
  { icon: Clock, title: 'Works 24/7 — while you sleep', desc: 'Your AI agent never takes a day off. Customers in different time zones get instant answers at 3am, on weekends, on holidays.' },
  { icon: DollarSign, title: 'Cut support costs by 60%', desc: 'One AI agent handles hundreds of conversations simultaneously. No salary, no sick days, no training costs. Pay a flat monthly fee.' },
  { icon: TrendingUp, title: 'Never lose a hot lead again', desc: 'When a customer is ready to buy at midnight, your agent is there to close. Every interested visitor gets captured as a lead.' },
  { icon: Shield, title: 'Trained on your exact catalog', desc: 'Unlike generic chatbots, FastClose learns your products, prices, and policies. It only says what you tell it to say.' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Upload your catalog', desc: 'Paste your products, services, or FAQ as JSON or plain text. Takes 2 minutes.' },
  { step: '02', title: 'AI learns your business', desc: 'We generate semantic embeddings of every product so your agent understands context, not just keywords.' },
  { step: '03', title: 'Deploy everywhere', desc: 'Embed the chat widget on your website and connect a Telegram bot. One setup, two channels.' },
  { step: '04', title: 'Watch leads come in', desc: 'Every captured phone number appears in your dashboard. Wake up to a list of warm leads.' },
];

const PLANS = [
  {
    name: 'Starter',
    price: '$29',
    period: '/mo',
    desc: 'Perfect for small businesses just getting started.',
    features: ['1 AI agent', 'Up to 500 conversations/mo', 'Web chat widget', 'Lead capture', 'Email support'],
    cta: 'Start free trial',
    highlight: false,
  },
  {
    name: 'Growth',
    price: '$79',
    period: '/mo',
    desc: 'For growing businesses that want more reach.',
    features: ['1 AI agent', 'Unlimited conversations', 'Web chat + Telegram bot', 'Lead capture & dashboard', 'Multilingual (10+ languages)', 'Priority support'],
    cta: 'Start free trial',
    highlight: true,
    badge: 'Most popular',
  },
  {
    name: 'Scale',
    price: '$199',
    period: '/mo',
    desc: 'For teams managing multiple brands or locations.',
    features: ['5 AI agents', 'Unlimited conversations', 'Web chat + Telegram + API', 'Advanced analytics', 'Custom AI personality', 'Dedicated onboarding'],
    cta: 'Contact sales',
    highlight: false,
  },
];

const TESTIMONIALS = [
  { name: 'Arman K.', role: 'Owner, Elektronika Store', quote: 'We used to miss 30+ customer inquiries every night. Now our AI handles everything and we wake up to 10-15 qualified leads daily.' },
  { name: 'Narine M.', role: 'CEO, Narine Beauty', quote: 'Our customers write in Armenian, Russian, and English. FastClose answers perfectly in all three. Our response time went from 6 hours to 0.' },
  { name: 'David P.', role: 'Founder, TechGear AM', quote: 'ROI in the first week. The cost of one month subscription is less than 2 hours of a support agent. It just works.' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/40">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
              FastClose<span className="text-primary"> AI</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">Stories</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden md:block">
              Sign in
            </Link>
            <Link href="/auth/register" className="text-sm font-semibold bg-primary text-white px-4 py-2 rounded-xl hover:opacity-90 transition shadow-md shadow-primary/30">
              Try free →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="pt-36 pb-24 px-6 text-center relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto relative space-y-8">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            AI Customer Support for B2B
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.04]" style={{ fontFamily: 'Syne, sans-serif' }}>
            Your best employee<br />
            <span className="text-primary">never clocks out.</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            FastClose AI answers customer questions, captures leads, and closes sales — in any language, on your website and Telegram, <span className="text-foreground font-medium">24 hours a day</span>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-white px-8 py-4 rounded-xl font-bold text-base hover:opacity-90 transition shadow-xl shadow-primary/30">
              Start free — no credit card <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/chat/00000000-0000-0000-0000-000000000001" target="_blank"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-border px-8 py-4 rounded-xl font-semibold text-base hover:bg-muted transition">
              <MessageSquare className="w-4 h-4" /> See live demo
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">14-day free trial · Cancel anytime · Setup in under 5 minutes</p>
        </div>
      </section>

      {/* ── Pain stats ──────────────────────────────────────── */}
      <section className="py-12 px-6 border-y border-border bg-muted/30">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {PAIN_STATS.map(({ stat, label }) => (
            <div key={stat} className="text-center space-y-2">
              <p className="text-4xl font-extrabold text-primary" style={{ fontFamily: 'Syne, sans-serif' }}>{stat}</p>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Problem → Solution ──────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Problem */}
            <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-8 space-y-5">
              <p className="text-xs font-bold uppercase tracking-widest text-destructive">The problem today</p>
              <h2 className="text-2xl font-bold leading-snug" style={{ fontFamily: 'Syne, sans-serif' }}>
                You're losing money every night you're not online
              </h2>
              <ul className="space-y-3">
                {[
                  'A customer asks about a product at 11pm — no reply. They buy from a competitor.',
                  'Your support team spends 6 hours a day on the same 10 questions.',
                  'You hire more staff to keep up. Costs grow faster than revenue.',
                  'Leads fall through the cracks because nobody was there to capture them.',
                ].map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="w-4 h-4 rounded-full border-2 border-destructive/40 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Solution */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 space-y-5">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">The FastClose solution</p>
              <h2 className="text-2xl font-bold leading-snug" style={{ fontFamily: 'Syne, sans-serif' }}>
                An AI agent that knows your business inside out
              </h2>
              <ul className="space-y-3">
                {[
                  'Trained on your exact products, prices, and policies — not generic knowledge.',
                  'Handles unlimited conversations simultaneously, in any language.',
                  'Captures phone numbers automatically and logs every lead.',
                  'Deploys on your website AND Telegram. One setup, two channels.',
                ].map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefits ────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-muted/20">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>
              What changes when you deploy FastClose
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Real outcomes, not features.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {BENEFITS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card border border-border rounded-2xl p-6 flex gap-4 hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-1.5">
                  <p className="font-bold text-base" style={{ fontFamily: 'Syne, sans-serif' }}>{title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-4xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>
              Up and running in 5 minutes
            </h2>
            <p className="text-muted-foreground">No developers needed. No complex setup.</p>
          </div>

          <div className="space-y-4">
            {HOW_IT_WORKS.map(({ step, title, desc }, i) => (
              <div key={step} className="flex gap-6 items-start group">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-primary font-extrabold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>{step}</span>
                </div>
                <div className="flex-1 pt-3 space-y-1">
                  <p className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>{title}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block absolute ml-7 mt-14 w-px h-4 bg-border" />
                )}
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href="/auth/register" className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-xl font-bold hover:opacity-90 transition shadow-lg shadow-primary/25">
              Get started now <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────── */}
      <section id="testimonials" className="py-24 px-6 bg-muted/20">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>
              Businesses already saving time & money
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ name, role, quote }) => (
              <div key={name} className="bg-card border border-border rounded-2xl p-6 space-y-4 flex flex-col">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">"{quote}"</p>
                <div>
                  <p className="font-semibold text-sm">{name}</p>
                  <p className="text-xs text-muted-foreground">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>
              Simple, honest pricing
            </h2>
            <p className="text-muted-foreground">Less than the cost of one support hour. Cancel anytime.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {PLANS.map(({ name, price, period, desc, features, cta, highlight, badge }) => (
              <div key={name} className={`relative rounded-2xl p-7 flex flex-col gap-6 border ${
                highlight
                  ? 'bg-primary text-white border-primary shadow-2xl shadow-primary/30 scale-[1.02]'
                  : 'bg-card border-border'
              }`}>
                {badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                    {badge}
                  </div>
                )}
                <div className="space-y-1">
                  <p className={`text-xs font-bold uppercase tracking-widest ${highlight ? 'text-white/70' : 'text-muted-foreground'}`}>{name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>{price}</span>
                    <span className={`text-sm ${highlight ? 'text-white/70' : 'text-muted-foreground'}`}>{period}</span>
                  </div>
                  <p className={`text-sm ${highlight ? 'text-white/80' : 'text-muted-foreground'}`}>{desc}</p>
                </div>

                <ul className="space-y-2.5 flex-1">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${highlight ? 'text-white/80' : 'text-primary'}`} />
                      <span className={highlight ? 'text-white/90' : ''}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/auth/register"
                      className={`w-full text-center py-3 rounded-xl font-bold text-sm transition ${
                        highlight
                          ? 'bg-white text-primary hover:bg-white/90'
                          : 'bg-primary text-white hover:opacity-90 shadow-md shadow-primary/25'
                      }`}>
                  {cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            All plans include a <strong>14-day free trial</strong>. No credit card required to start.
          </p>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="bg-primary/5 border border-primary/15 rounded-3xl p-12 space-y-6">
            <h2 className="text-4xl md:text-5xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>
              Stop losing customers <br className="hidden md:block" />while you sleep.
            </h2>
            <p className="text-muted-foreground text-lg">
              Join businesses that never miss a customer inquiry. Set up in 5 minutes, see results tonight.
            </p>
            <Link href="/auth/register"
                  className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition shadow-xl shadow-primary/30">
              Start your free trial <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-xs text-muted-foreground">14 days free · No credit card · Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-border px-6 py-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>
              FastClose<span className="text-primary"> AI</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">© 2025 FastClose AI. All rights reserved.</p>
          <div className="flex gap-5 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <Link href="/auth/login" className="hover:text-foreground transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>

    </main>
  );
}