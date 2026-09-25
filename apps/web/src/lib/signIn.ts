import { useCallback, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { API_URL } from './env'

// Sign-in rules shared by the /login screen (views/auth/AuthScreen) and the
// sign-in panel on the public site, so both behave identically: same API
// calls (via the auth store), same remember-me keys, same error wording,
// same OAuth start URL.

const REMEMBERED_EMAIL_KEY = 'remote365_remembered_email'
const REMEMBER_ME_KEY = 'remote365_remember_me'

const readStorage = (key: string): string | null => {
  try { return localStorage.getItem(key) } catch { return null }
}

export const rememberedEmail = () => readStorage(REMEMBERED_EMAIL_KEY) || ''
export const rememberMeDefault = () => readStorage(REMEMBER_ME_KEY) === 'true'

/** Remember (or forget) the email for the next visit. Storage failures are non-fatal. */
export function persistRememberMe(email: string, rememberMe: boolean) {
  try {
    if (rememberMe) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email)
      localStorage.setItem(REMEMBER_ME_KEY, 'true')
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY)
      localStorage.setItem(REMEMBER_ME_KEY, 'false')
    }
  } catch { /* storage unavailable */ }
}

// Shape of an axios error from the auth API.
type ApiError = { response?: { status?: number; data?: { error?: string } } } | null | undefined

export interface SignInFailure {
  title: string
  message: string
}

/** The error title/message the auth screen shows for a failed sign-in. */
export function signInFailure(error: unknown): SignInFailure {
  const err = error as ApiError
  return {
    title: err?.response?.status === 401 ? 'Sign in failed' : 'Could not sign in',
    message: err?.response?.data?.error || 'Could not sign in. Check your credentials and try again.',
  }
}

/** The error title/message for a rejected two-factor code. */
export function twoFactorFailure(error: unknown): SignInFailure {
  const err = error as ApiError
  return {
    title: 'Code not accepted',
    message: err?.response?.data?.error || 'Invalid 2FA code',
  }
}

export type OAuthProvider = 'google' | 'microsoft'

/** Where to send the browser to start Google / Microsoft sign-in. */
export function oauthStartUrl(provider: OAuthProvider, options: { business?: boolean } = {}) {
  const apiUrl = API_URL || window.location.origin
  const returnUrl = `${window.location.origin}/auth/callback`
  return `${apiUrl}/api/auth/oauth/${provider}?platform=web&returnUrl=${encodeURIComponent(returnUrl)}${options.business ? '&accountType=business' : ''}`
}

export type SignInOutcome = 'signed-in' | 'two-factor' | 'failed'

/**
 * Form state + actions for a compact sign-in form. 2FA is handled inline:
 * the store keeps the temporary token in memory only, so it can't survive a
 * page load to /2fa.
 */
export function useSignIn() {
  const login = useAuthStore(s => s.login)
  const verify2fa = useAuthStore(s => s.verify2fa)
  const temp2faToken = useAuthStore(s => s.temp2faToken)
  const setTemp2faToken = useAuthStore(s => s.setTemp2faToken)

  const [email, setEmail] = useState(rememberedEmail)
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(rememberMeDefault)
  const [totpCode, setTotpCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<SignInFailure | null>(null)

  const signIn = async (): Promise<SignInOutcome> => {
    setError(null)
    setPending(true)
    try {
      const result = await login(email, password)
      persistRememberMe(email, rememberMe)
      return result?.twoFactorRequired ? 'two-factor' : 'signed-in'
    } catch (err) {
      setError(signInFailure(err))
      return 'failed'
    } finally {
      setPending(false)
    }
  }

  const submitTwoFactor = async (): Promise<boolean> => {
    if (totpCode.length !== 6 || !temp2faToken) return false
    setError(null)
    setPending(true)
    try {
      await verify2fa(totpCode, temp2faToken)
      return true
    } catch (err) {
      setError(twoFactorFailure(err))
      return false
    } finally {
      setPending(false)
    }
  }

  /** Back out of a started 2FA step (e.g. the panel was closed). Stable identity. */
  const cancelTwoFactor = useCallback(() => {
    setTotpCode('')
    setError(null)
    setTemp2faToken(null)
  }, [setTemp2faToken])

  return {
    email, setEmail,
    password, setPassword,
    rememberMe, setRememberMe,
    totpCode, setTotpCode,
    awaitingTwoFactor: Boolean(temp2faToken),
    pending,
    error,
    signIn,
    submitTwoFactor,
    cancelTwoFactor,
  }
}
