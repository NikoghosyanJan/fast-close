import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
      <h1 className="text-6xl font-extrabold text-primary" style={{ fontFamily: 'Syne, sans-serif' }}>
        404
      </h1>
      <p className="text-lg font-semibold">Page not found</p>
      <p className="text-muted-foreground text-sm max-w-sm">
        The business or page you're looking for doesn't exist. Check the URL or go back home.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition"
      >
        Go Home
      </Link>
    </div>
  );
}
