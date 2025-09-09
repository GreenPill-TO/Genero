import { useEffect, useState } from 'react'

export function shouldRequireAuth(value: unknown): boolean {
  return value === true || value === 'true' || value === 'TRUE' || value === 1 || value === '1'
}

export async function fetchRequireAuth(
  fetcher?: () => Promise<{ data: { value: unknown } | null; error: unknown }>
): Promise<boolean> {
  try {
    const { data, error } = fetcher
      ? await fetcher()
      : await (async () => {
          const { createClient } = await import('@shared/lib/supabase/client')
          const supabase = createClient()
          return supabase
            .from('control_variables')
            .select('value')
            .eq('variable', 'require_authenticated_on_dashboard')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        })()

    if (error) return false
    return shouldRequireAuth(data?.value)
  } catch {
    return false
  }
}

export default function useRequireAuthOnDashboard() {
  const [requireAuth, setRequireAuth] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRequireAuth()
      .then(setRequireAuth)
      .finally(() => setLoading(false))
  }, [])

  return { requireAuth, loading }
}
