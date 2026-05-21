// app/grants/page.tsx — redirect to craudiovizai.com/grants
'use client'
import { useEffect } from 'react'
export default function GrantsRedirect() {
  useEffect(() => { window.location.href = 'https://craudiovizai.com/grants' }, [])
  return <div style={{ minHeight:'100vh',background:'#080812',display:'flex',alignItems:'center',justifyContent:'center',color:'#6366f1',fontFamily:'system-ui' }}>Loading grants...</div>
}
