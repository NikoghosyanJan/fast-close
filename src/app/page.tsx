import Link from 'next/link';
import { ArrowRight, Zap } from 'lucide-react';

const CHANNELS = [
  {
    title: 'Website chat',
    desc: 'A guest opens your widget, browses the menu, and places a delivery order — phone and address collected by the agent.',
  },
  {
    title: 'Table QR',
    desc: 'Print a code per table. Guests scan, chat with an AI waiter, and order for that table — no phone or address needed.',
  },
  {
    title: 'Telegram',
    desc: 'The same menu-aware agent on Telegram. Confirmed orders land in your dashboard and ping your kitchen chat.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Add your menu',
    desc: 'Import dishes with names, prices, and categories. FastClose embeds each item so the agent answers from your real catalog.',
  },
  {
    n: '02',
    title: 'Open your channels',
    desc: 'Share the web chat link, print table QR codes, and connect Telegram. One menu powers all three.',
  },
  {
    n: '03',
    title: 'Take orders',
    desc: 'The agent helps guests choose, builds the cart, confirms the order, and notifies you instantly.',
  },
];

const PLANS = [
  {
    name: 'Starter',
    price: '$29',
    desc: 'One location getting started with AI ordering.',
    features: ['Web chat widget', 'Menu sync', 'Order dashboard', 'Up to 500 chats / month'],
  },
  {
    name: 'Growth',
    price: '$79',
    desc: 'Delivery, dine-in QR, and Telegram in one place.',
    features: ['Everything in Starter', 'Table QR codes', 'Telegram bot', 'Unlimited chats', 'Armenian · Russian · English'],
    featured: true,
  },
  {
    name: 'Scale',
    price: '$199',
    desc: 'For groups expanding across locations.',
    features: ['Up to 5 locations', 'Priority support', 'Custom agent tone', 'Onboarding help'],
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[hsl(160_18%_8%/0.72)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 md:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </span>
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
              FastClose
            </span>
          </Link>
          <div className="flex items-center gap-5">
            <nav className="hidden items-center gap-6 text-sm text-white/75 md:flex">
              <a href="#channels" className="transition hover:text-white">Channels</a>
              <a href="#how" className="transition hover:text-white">How it works</a>
              <a href="#pricing" className="transition hover:text-white">Pricing</a>
            </nav>
            <Link href="/auth/login" className="hidden text-sm text-white/75 transition hover:text-white sm:inline">
              Sign in
            </Link>
            <Link
              href="/auth/register"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — one composition, brand-first, full-bleed visual */}
      <section className="relative min-h-[100svh] flex flex-col justify-end overflow-hidden">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=2400&q=80"
            alt=""
            className="landing-hero-media h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(160_18%_8%)] via-[hsl(160_16%_10%/0.72)] to-[hsl(160_14%_12%/0.35)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(152_50%_35%/0.25),transparent_50%)]" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-16 pt-32 md:px-8 md:pb-24">
          <p
            className="landing-rise text-5xl font-extrabold tracking-tight text-white sm:text-6xl md:text-8xl"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            FastClose
          </p>
          <h1
            className="landing-rise landing-rise-delay-1 mt-4 max-w-2xl text-2xl font-semibold leading-snug text-white/95 sm:text-3xl md:text-4xl"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            The AI waiter that takes orders for your café.
          </h1>
          <p className="landing-rise landing-rise-delay-2 mt-4 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">
            Menu-aware chat in Armenian, Russian, and English — for delivery, table QR dine-in, and Telegram.
          </p>
          <div className="landing-rise landing-rise-delay-3 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
            >
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
            >
              See how it works
            </a>
          </div>
          <p className="landing-rise landing-rise-delay-4 mt-5 text-xs text-white/50">
            Built for restaurants in Armenia · Setup in minutes · Cancel anytime
          </p>
        </div>
      </section>

      {/* Channels */}
      <section id="channels" className="border-b border-border bg-background px-5 py-24 md:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Where guests order</p>
          <h2
            className="mt-3 max-w-xl text-3xl font-extrabold tracking-tight md:text-4xl"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            One agent. Three ways to order.
          </h2>
          <p className="mt-4 max-w-lg text-muted-foreground">
            Guests talk to a waiter that actually knows your menu — prices, names, and what you do not serve.
          </p>

          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-12">
            {CHANNELS.map((item, i) => (
              <div key={item.title} className="relative">
                <span
                  className="text-5xl font-extrabold text-primary/15"
                  style={{ fontFamily: 'Syne, sans-serif' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-2 text-xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative overflow-hidden px-5 py-24 md:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--muted)/0.65),transparent_40%,hsl(var(--muted)/0.4))]" />
        <div className="relative mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">How it works</p>
          <h2
            className="mt-3 max-w-xl text-3xl font-extrabold tracking-tight md:text-4xl"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            From menu to confirmed order.
          </h2>
          <p className="mt-4 max-w-lg text-muted-foreground">
            No scripts to write. No developers required. Your catalog becomes the agent&apos;s knowledge.
          </p>

          <ol className="mt-16 space-y-12 md:space-y-16">
            {STEPS.map(step => (
              <li key={step.n} className="grid gap-4 md:grid-cols-[5rem_1fr] md:gap-10">
                <span
                  className="text-3xl font-extrabold text-primary md:text-4xl"
                  style={{ fontFamily: 'Syne, sans-serif' }}
                >
                  {step.n}
                </span>
                <div>
                  <h3 className="text-xl font-bold md:text-2xl" style={{ fontFamily: 'Syne, sans-serif' }}>
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Promise strip */}
      <section className="border-y border-border bg-[hsl(160_18%_10%)] px-5 py-20 text-white md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl" style={{ fontFamily: 'Syne, sans-serif' }}>
              Honest about the menu.
              <br />
              Fast about the order.
            </h2>
            <p className="mt-4 text-white/65 leading-relaxed">
              FastClose only suggests items from your catalog. Guests get clear prices in AMD, help choosing, and a confirmation
              your kitchen can act on — day or night.
            </p>
          </div>
          <ul className="space-y-3 text-sm text-white/80">
            {[
              'Armenian script, transliteration, Russian, English',
              'Delivery orders with phone + address',
              'Dine-in orders tied to a table ID',
              'Telegram alerts when an order is confirmed',
            ].map(line => (
              <li key={line} className="flex items-start gap-3">
                <span className="landing-dot mt-1.5 h-1.5 w-1.5 shrink-0 rounded-sm bg-primary" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-5 py-24 md:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Pricing</p>
          <h2
            className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Simple plans for busy kitchens.
          </h2>
          <p className="mt-4 max-w-lg text-muted-foreground">
            Less than a few hours of phone staff. 14-day free trial on every plan.
          </p>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {PLANS.map(plan => (
              <div
                key={plan.name}
                className={
                  plan.featured
                    ? 'flex flex-col border border-primary bg-primary p-7 text-primary-foreground'
                    : 'flex flex-col border border-border bg-card p-7'
                }
              >
                <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${plan.featured ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {plan.name}
                </p>
                <p className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>
                    {plan.price}
                  </span>
                  <span className={plan.featured ? 'text-primary-foreground/70' : 'text-muted-foreground'}>/mo</span>
                </p>
                <p className={`mt-2 text-sm leading-relaxed ${plan.featured ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {plan.desc}
                </p>
                <ul className="mt-8 flex-1 space-y-2.5">
                  {plan.features.map(f => (
                    <li key={f} className={`text-sm ${plan.featured ? 'text-primary-foreground/90' : 'text-foreground'}`}>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/register"
                  className={
                    plan.featured
                      ? 'mt-8 block rounded-xl bg-card py-3 text-center text-sm font-bold text-foreground transition hover:opacity-95'
                      : 'mt-8 block rounded-xl bg-primary py-3 text-center text-sm font-bold text-primary-foreground transition hover:opacity-90'
                  }
                >
                  Start free trial
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden px-5 py-28 md:px-8">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=2000&q=80"
            alt=""
            className="h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-[hsl(160_18%_8%/0.88)]" />
        </div>
        <div className="relative mx-auto max-w-3xl text-center text-white">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl" style={{ fontFamily: 'Syne, sans-serif' }}>
            Put an AI waiter on every table.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-white/65 leading-relaxed">
            Upload tonight&apos;s menu. Share a link or print QR codes. Take your first AI order before the dinner rush.
          </p>
          <Link
            href="/auth/register"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-bold text-primary-foreground transition hover:opacity-90"
          >
            Create your account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-10 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-3.5 w-3.5 text-primary-foreground" />
            </span>
            <span className="font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
              FastClose
            </span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} FastClose AI · AI ordering for restaurants</p>
          <div className="flex gap-5 text-xs text-muted-foreground">
            <Link href="/auth/login" className="transition hover:text-foreground">Sign in</Link>
            <Link href="/auth/register" className="transition hover:text-foreground">Register</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
