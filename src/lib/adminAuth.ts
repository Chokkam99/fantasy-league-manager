import { invalidateFinanceCache } from '@/lib/financeClient'
import { invalidateLeagueReadCache } from '@/lib/leagueReadClient'

export const AUTH_CHANGE_STORAGE_KEY = 'flm-auth-change'

function clearAuthData() {
  invalidateFinanceCache()
  invalidateLeagueReadCache()
  try { localStorage.setItem(AUTH_CHANGE_STORAGE_KEY, String(Date.now())) } catch { /* Storage is optional. */ }
}

/**
 * Admin Authentication - Server-side validation
 * Password never exposed to client
 */

export async function checkAdminAuth(): Promise<boolean> {
  return checkAdminStatus();
}

export interface AdminAuthenticationResult {
  error?: string
  success: boolean
}

export async function authenticateAdmin(
  password: string,
): Promise<AdminAuthenticationResult> {
  try {
    const response = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, action: 'login' }),
    });

    const data = await response.json()
    if (response.ok && data.success && data.isAdmin) {
      clearAuthData()
      return { success: true }
    }

    return {
      error: typeof data.error === 'string' ? data.error : 'Unable to sign in.',
      success: false,
    }
  } catch (error) {
    console.error('Authentication failed:', error);
    return {
      error: 'Authentication failed. Check your connection and try again.',
      success: false,
    }
  }
}

export async function logoutAdmin(): Promise<void> {
  const response = await fetch('/api/admin/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'logout' }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || 'Could not log out. Please try again.')
  }
  clearAuthData()
}

export async function checkAdminStatus(): Promise<boolean> {
  try {
    const response = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check' }),
    });

    const data = await response.json();
    return Boolean(response.ok && data.success && data.isAdmin);
  } catch (error) {
    console.error('Status check failed:', error);
    return false;
  }
}
