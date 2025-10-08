import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  cookies().set('admin', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    expires: new Date(0),
  });

  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}
