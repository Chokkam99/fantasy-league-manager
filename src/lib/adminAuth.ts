const ADMIN_SESSION_KEY = 'fantasy-admin-session'
const ADMIN_SESSION_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

interface AdminSession {
  authenticated: boolean
  timestamp: number
}

export function checkAdminAuth(): boolean {
  if (typeof window === 'undefined') return false
  
  const stored = localStorage.getItem(ADMIN_SESSION_KEY)
  if (!stored) return false
  
  try {
    const session: AdminSession = JSON.parse(stored)
    const now = Date.now()
    
    // Check if session expired
    if (now - session.timestamp > ADMIN_SESSION_EXPIRY) {
      localStorage.removeItem(ADMIN_SESSION_KEY)
      return false
    }
    
    return session.authenticated
  } catch {
    localStorage.removeItem(ADMIN_SESSION_KEY)
    return false
  }
}

export function authenticateAdmin(password: string): boolean {
  const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD
  
  if (!adminPassword || password !== adminPassword) {
    return false
  }
  
  // Store session
  const session: AdminSession = {
    authenticated: true,
    timestamp: Date.now()
  }
  
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session))
  return true
}

export function logoutAdmin(): void {
  localStorage.removeItem(ADMIN_SESSION_KEY)
  // Also clear any existing readonly mode settings
  localStorage.removeItem('fantasy-readonly-mode')
  localStorage.removeItem('fantasy-readonly-league')
}