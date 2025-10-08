import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  cookies().set('admin', '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
  });

  return NextResponse.json({ ok: true });
}
