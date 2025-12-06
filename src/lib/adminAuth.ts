/**
 * Admin Authentication - Server-side validation
 * Password never exposed to client
 */

export async function checkAdminAuth(): Promise<boolean> {
  return checkAdminStatus();
}

export async function authenticateAdmin(password: string): Promise<boolean> {
  try {
    const response = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, action: 'login' }),
    });

    const data = await response.json();
    return data.success && data.isAdmin;
  } catch (error) {
    console.error('Authentication failed:', error);
    return false;
  }
}

export async function logoutAdmin(): Promise<void> {
  try {
    await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
  } catch (error) {
    console.error('Logout failed:', error);
  }
}

export async function checkAdminStatus(): Promise<boolean> {
  try {
    const response = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check' }),
    });

    const data = await response.json();
    return data.success && data.isAdmin;
  } catch (error) {
    console.error('Status check failed:', error);
    return false;
  }
}
