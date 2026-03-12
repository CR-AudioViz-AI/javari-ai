// Auto-generated stub: hooks/useAuth
import { useState } from 'react'

export function useAuth() {
  const [data, setData] = useState(null)
  return { data, loading: false, error: null, setData }
}
export default useAuth
