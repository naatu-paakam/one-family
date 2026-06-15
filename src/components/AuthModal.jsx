import { useAuth } from '../contexts/AuthContext'

export default function AuthModal({ onClose }) {
  const { signInWithGoogle, signInWithFacebook } = useAuth()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <span className="text-4xl">🌾</span>
          <h2 className="mt-2 text-2xl font-display text-stone-900">Welcome Back</h2>
          <p className="text-stone-500 text-sm mt-1">Sign in to view and share family updates</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-stone-300 rounded-xl hover:bg-stone-50 transition font-medium text-sm"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
            Continue with Google
          </button>

          <button
            onClick={signInWithFacebook}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#1877F2] rounded-xl hover:bg-[#166FE5] transition font-medium text-sm text-white"
          >
            <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
              <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.883v2.252h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
            </svg>
            Continue with Facebook
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full text-center text-sm text-stone-400 hover:text-stone-600"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
