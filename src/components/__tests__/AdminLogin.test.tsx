import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminLogin from '../AdminLogin'

const mockAuthenticateAdmin = jest.fn()
const mockLogoutAdmin = jest.fn()

jest.mock('@/lib/adminAuth', () => ({
  authenticateAdmin: (...args: unknown[]) => mockAuthenticateAdmin(...args),
  logoutAdmin: () => mockLogoutAdmin(),
}))

function renderLogin(
  props: Partial<React.ComponentProps<typeof AdminLogin>> = {},
) {
  const onAuthChange = jest.fn()
  render(
    <AdminLogin
      isAdmin={false}
      onAuthChange={onAuthChange}
      {...props}
    />,
  )

  return { onAuthChange }
}

async function openLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('button', { name: 'Commissioner login' }),
  )
}

describe('AdminLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthenticateAdmin.mockResolvedValue({ success: true })
  })

  it('opens an accessible password-only commissioner dialog', async () => {
    const user = userEvent.setup()
    renderLogin()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await openLogin(user)

    expect(
      screen.getByRole('dialog', { name: 'Commissioner login' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'type',
      'password',
    )
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Login' })).toBeDisabled()
  })

  it('authenticates with the server route and closes after success', async () => {
    const user = userEvent.setup()
    const { onAuthChange } = renderLogin()
    await openLogin(user)

    await user.type(screen.getByLabelText('Password'), 'league-secret')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(mockAuthenticateAdmin).toHaveBeenCalledWith('league-secret')
      expect(onAuthChange).toHaveBeenCalledWith(true)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the server error and leaves the dialog available for retry', async () => {
    const user = userEvent.setup()
    mockAuthenticateAdmin.mockResolvedValue({
      error: 'Commissioner sessions are not configured.',
      success: false,
    })
    const { onAuthChange } = renderLogin()
    await openLogin(user)

    const password = screen.getByLabelText('Password')
    await user.type(password, 'league-secret')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Commissioner sessions are not configured.')
    expect(password).toHaveValue('league-secret')
    expect(onAuthChange).not.toHaveBeenCalled()
  })

  it('uses a safe fallback for an unexpected authentication failure', async () => {
    const user = userEvent.setup()
    mockAuthenticateAdmin.mockRejectedValue(new Error('network detail'))
    renderLogin()
    await openLogin(user)

    await user.type(screen.getByLabelText('Password'), 'league-secret')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Authentication failed',
    )
  })

  it('disables actions while login is pending', async () => {
    const user = userEvent.setup()
    let resolveLogin: (result: { success: boolean }) => void = () => undefined
    mockAuthenticateAdmin.mockImplementation(
      () => new Promise((resolve) => {
        resolveLogin = resolve
      }),
    )
    renderLogin()
    await openLogin(user)

    await user.type(screen.getByLabelText('Password'), 'league-secret')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(screen.getByRole('button', { name: 'Logging in...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    resolveLogin({ success: true })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('clears password and errors when cancelled', async () => {
    const user = userEvent.setup()
    mockAuthenticateAdmin.mockResolvedValue({
      error: 'Incorrect password',
      success: false,
    })
    renderLogin()
    await openLogin(user)

    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await openLogin(user)
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders the menu trigger with visible text', () => {
    renderLogin({ display: 'menu' })

    expect(
      screen.getByRole('button', { name: 'Commissioner login' }),
    ).toHaveTextContent('Commissioner login')
  })

  it('logs the commissioner out and reports the auth change', async () => {
    const user = userEvent.setup()
    const { onAuthChange } = renderLogin({ isAdmin: true })

    await user.click(
      screen.getByRole('button', { name: 'Log out of commissioner mode' }),
    )

    expect(mockLogoutAdmin).toHaveBeenCalledTimes(1)
    expect(onAuthChange).toHaveBeenCalledWith(false)
  })
})
