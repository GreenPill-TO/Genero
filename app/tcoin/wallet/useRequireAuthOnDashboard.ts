import { useEffect, useState } from 'react'

export function shouldRequireAuth(value: unknown): boolean {
  return value === true || value === 'true' || value === 'TRUE' || value === 1 || value === '1'
}

export default function useRequireAuthOnDashboard() {
  const [requireAuth, setRequireAuth] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFlag = async () => {
      const { createClient } = await import('@shared/lib/supabase/client')
      const supabase = createClient()
      const { data, error } = await supabase
        .from('control_variables')
        .select('value')
        .eq('variable', 'require_authenticated_on_dashboard')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!error && data) {
        setRequireAuth(shouldRequireAuth(data.value))
      }
      setLoading(false)
    }

    fetchFlag()
  }, [])

  return { requireAuth, loading }
}
