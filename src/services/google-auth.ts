import { FirebaseError } from 'firebase/app'
import { signInWithPopup, signOut } from 'firebase/auth'
import { auth, provider } from '@/firebase'

export interface AuthUser {
  uid: string
  email: string | null
  name: string | null
  photo: string | null
  accessToken: string
}

export const getGoogleAuthErrorMessage = (error: unknown): string => {
  if (!(error instanceof FirebaseError)) {
    return error instanceof Error ? error.message : 'Unable to sign in. Please try again.'
  }

  const messages: Record<string, string> = {
    'auth/popup-blocked': 'The Google sign-in window was blocked. Please try again.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/unauthorized-domain':
      'This desktop origin is not authorized in Firebase. Add localhost under Firebase Authentication > Settings > Authorized domains.',
    'auth/operation-not-supported-in-this-environment':
      'Google sign-in requires the desktop app to run from its local HTTP origin.',
    'auth/network-request-failed': 'Google sign-in could not reach Firebase. Check your connection.',
  }

  return messages[error.code] ?? error.message
}

export const googleAuth = {
  async signIn(): Promise<AuthUser> {
    const result = await signInWithPopup(auth, provider)

    return {
      uid: result.user.uid,
      email: result.user.email,
      name: result.user.displayName,
      photo: result.user.photoURL,
      accessToken: await result.user.getIdToken(),
    }
  },

  async signOut(): Promise<void> {
    await signOut(auth)
  },
}
