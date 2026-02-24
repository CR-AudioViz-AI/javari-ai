// components/header/HeaderLogo.tsx
"use client"

import { useState } from 'react'
import Image from 'next/image'

export function HeaderLogo() {
  const [logoError, setLogoError] = useState(false)

  return (
    <>
      {!logoError ? (
        <Image 
          src="/javariailogo.png"
          alt="Javari AI" 
          width={32}
          height={32}
          className="h-8 w-8"
          onError={() => setLogoError(true)}
        />
      ) : (
        <div className="h-8 w-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">J</span>
        </div>
      )}
      <span className="text-lg font-bold">Javari AI</span>
    </>
  )
}
