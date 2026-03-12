// Auto-generated stub: hooks/useRealtimeSubscription
import { useState } from 'react'

export function useRealtimeSubscription() {
  const [data, setData] = useState(null)
  return { data, loading: false, error: null, setData }
}
export default useRealtimeSubscription
