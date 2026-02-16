/**
 * AdminGuard - Route guard component for admin pages
 *
 * Checks if the current user has admin access and redirects if not.
 */

import { Show, onMount, createSignal } from 'solid-js'
import type { ParentComponent } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { adminStore } from '@/stores/adminStore'
import { authStore } from '@/stores/authStore'

export const AdminGuard: ParentComponent = (props) => {
  const [isChecking, setIsChecking] = createSignal(true)
  const [accessDenied, setAccessDenied] = createSignal(false)
  const navigate = useNavigate()

  onMount(async () => {
    // Wait for auth to finish initializing (handles page refresh / direct nav)
    if (!authStore.isInitialized) {
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (authStore.isInitialized) {
            clearInterval(interval)
            resolve()
          }
        }, 50)
      })
    }

    // Check if user is logged in
    if (!authStore.isAuthenticated) {
      navigate('/', { replace: true })
      return
    }

    // Check admin access
    const hasAccess = await adminStore.checkAdminAccess()
    if (!hasAccess) {
      setAccessDenied(true)
      // Redirect after a brief delay so user sees the message
      setTimeout(() => navigate('/discovery', { replace: true }), 2000)
    }

    setIsChecking(false)
  })

  return (
    <Show
      when={!isChecking()}
      fallback={
        <div class="min-h-screen bg-[var(--background-primary)] flex items-center justify-center">
          <div class="text-center">
            <div class="w-8 h-8 border-2 border-[var(--brand-teal-1)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p class="text-[var(--text-secondary)]">Verifying admin access...</p>
          </div>
        </div>
      }
    >
      <Show
        when={!accessDenied()}
        fallback={
          <div class="min-h-screen bg-[var(--background-primary)] flex items-center justify-center">
            <div class="text-center">
              <div class="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 class="text-xl font-semibold text-[var(--text-primary)] mb-2">Access Denied</h2>
              <p class="text-[var(--text-secondary)]">You don't have admin privileges.</p>
              <p class="text-[var(--text-tertiary)] text-sm mt-2">Redirecting...</p>
            </div>
          </div>
        }
      >
        {props.children}
      </Show>
    </Show>
  )
}
