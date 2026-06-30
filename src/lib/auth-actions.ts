'use server';

import { prisma } from './prisma';
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut, auth } from './auth';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';

export async function signUp(email: string, password: string, businessName: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('An account with this email already exists.');

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, password: hashedPassword, role: 'BUSINESS' },
    });
    await tx.business.create({
      data: { userId: user.id, name: businessName },
    });
  });

  // Auto sign in after registration
  await nextAuthSignIn('credentials', { email, password, redirectTo: '/dashboard' });
}

export async function signIn(email: string, password: string) {
  try {
    await nextAuthSignIn('credentials', { email, password, redirectTo: '/dashboard' });
  } catch (error) {
    if (error instanceof AuthError) {
      throw new Error('Invalid email or password.');
    }
    throw error;
  }
}

export async function signOut() {
  await nextAuthSignOut({ redirectTo: '/auth/login' });
}

export async function getSession() {
  const session = await auth();
  return session?.user ?? null;
}

export async function getProfile() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, role: true, createdAt: true },
  });
  return user;
}

export async function getMyBusiness() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
  });
  return business;
}
