import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const SESSION_COOKIE = 'admin_session';

// Simple hash function (in production, use bcrypt)
function simpleHash(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export async function POST(request: NextRequest) {
  try {
    const { password, action } = await request.json();

    if (action === 'logout') {
      (await cookies()).delete(SESSION_COOKIE);
      return NextResponse.json({ success: true, isAdmin: false });
    }

    if (action === 'check') {
      const cookieStore = await cookies();
      const session = cookieStore.get(SESSION_COOKIE);
      const isValid = session?.value === ADMIN_PASSWORD_HASH;
      return NextResponse.json({ success: true, isAdmin: isValid });
    }

    if (action === 'login') {
      const passwordHash = simpleHash(password);

      if (passwordHash === ADMIN_PASSWORD_HASH) {
        (await cookies()).set(SESSION_COOKIE, ADMIN_PASSWORD_HASH, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });
        return NextResponse.json({ success: true, isAdmin: true });
      }

      return NextResponse.json(
        { success: false, error: 'Invalid password' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
