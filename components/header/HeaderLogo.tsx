// components/header/HeaderLogo.tsx
"use client"

import { useState } from 'react'

export function HeaderLogo() {
  const [logoError, setLogoError] = useState(false)

  return (
    <>
      {!logoError && (
        <img 
          src="/javari-logo.svg" 
          alt="Javari AI" 
          className="h-8 w-8"
          onError={() => setLogoError(true)}
        />
      )}
      <span className="text-lg font-bold">Javari AI</span>
    </>
  )
}
