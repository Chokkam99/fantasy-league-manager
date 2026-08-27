import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSession,
  isAdminSessionSecretConfigured,
  isValidAdminSession,
  verifyAdminPassword,
} from '@/lib/adminSession'

type AuthAction = 'check' | 'login' | 'logout'

interface AuthRequestBody {
  action?: AuthAction
  password?: string
}

function response(
  body: Record<string, boolean | string>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'no-store' },
    status,
  })
}

export async function POST(request: NextRequest) {
  let body: AuthRequestBody

  try {
    const parsedBody: unknown = await request.json()
    if (
      !parsedBody ||
      typeof parsedBody !== 'object' ||
      Array.isArray(parsedBody)
    ) {
      return response(
        { success: false, error: 'Invalid authentication request.' },
        400,
      )
    }
    body = parsedBody as AuthRequestBody
  } catch {
    return response(
      { success: false, error: 'Invalid authentication request.' },
      400,
    )
  }

  if (body.action === 'logout') {
    const cookieStore = await cookies()
    cookieStore.delete(ADMIN_SESSION_COOKIE)
    cookieStore.set(ADMIN_SESSION_COOKIE, '', {
      httpOnly: true,
      maxAge: 0,
      path: '/',
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    })
    return response({ success: true, isAdmin: false })
  }

  if (body.action === 'check') {
    const cookieStore = await cookies()
    const session = cookieStore.get(ADMIN_SESSION_COOKIE)
    const isValid = isValidAdminSession(
      session?.value,
      process.env.ADMIN_SESSION_SECRET,
    )
    return response({ success: true, isAdmin: isValid })
  }

  if (body.action === 'login') {
    if (!isAdminSessionSecretConfigured(process.env.ADMIN_SESSION_SECRET)) {
      return response(
        {
          success: false,
          error: 'Commissioner authentication is not configured.',
        },
        503,
      )
    }

    const passwordVerification = await verifyAdminPassword(
      body.password,
      process.env.ADMIN_PASSWORD_HASH,
      process.env.ALLOW_LEGACY_ADMIN_PASSWORD_HASH === 'true',
    )

    if (passwordVerification === 'misconfigured') {
      return response(
        {
          success: false,
          error: 'Commissioner password verification is not configured.',
        },
        503,
      )
    }

    if (passwordVerification === 'invalid') {
      return response({ success: false, error: 'Invalid password' }, 401)
    }

    const session = createAdminSession(process.env.ADMIN_SESSION_SECRET)
    ;(await cookies()).set(ADMIN_SESSION_COOKIE, session, {
      httpOnly: true,
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
      path: '/',
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    })

    return response({ success: true, isAdmin: true })
  }

  return response({ success: false, error: 'Invalid action' }, 400)
}
