import { createClient } from '@supabase/supabase-js'
import {
  createServerSupabaseClient,
  isServerSupabaseConfigurationError,
  ServerSupabaseConfigurationError,
} from '@/lib/supabaseServer'

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

const mockedCreateClient = createClient as jest.MockedFunction<
  typeof createClient
>

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const originalSecretKey = process.env.SUPABASE_SECRET_KEY
const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function restoreEnvironment() {
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl

  if (originalSecretKey === undefined) delete process.env.SUPABASE_SECRET_KEY
  else process.env.SUPABASE_SECRET_KEY = originalSecretKey

  if (originalServiceRoleKey === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey
  }
}

describe('server Supabase client', () => {
  afterEach(() => {
    mockedCreateClient.mockReset()
    restoreEnvironment()
  })

  it('fails closed when no privileged server key is configured', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    delete process.env.SUPABASE_SECRET_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    expect(() => createServerSupabaseClient()).toThrow(
      ServerSupabaseConfigurationError,
    )
    expect(mockedCreateClient).not.toHaveBeenCalled()
  })

  it('prefers the modern server secret key and disables session persistence', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SECRET_KEY = 'server-secret'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-service-role'
    const client = { from: jest.fn() }
    mockedCreateClient.mockReturnValue(
      client as unknown as ReturnType<typeof createClient>,
    )

    expect(createServerSupabaseClient()).toBe(client)
    expect(mockedCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'server-secret',
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    )
  })

  it('supports the legacy service-role key during deployment migration', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    delete process.env.SUPABASE_SECRET_KEY
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-service-role'
    mockedCreateClient.mockReturnValue({} as ReturnType<typeof createClient>)

    createServerSupabaseClient()

    expect(mockedCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'legacy-service-role',
      expect.any(Object),
    )
  })

  it('recognizes only the server configuration error type', () => {
    expect(
      isServerSupabaseConfigurationError(
        new ServerSupabaseConfigurationError(),
      ),
    ).toBe(true)
    expect(isServerSupabaseConfigurationError(new Error('database error'))).toBe(
      false,
    )
  })
})
