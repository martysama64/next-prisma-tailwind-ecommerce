'use client'

import { validateBoolean } from '@/lib/utils'
import { useEffect, useState } from 'react'

export function useAuthenticated() {
   const [authenticated, setAuthenticated] = useState(null)

   useEffect(() => {
      try {
         if (typeof window !== 'undefined' && window.localStorage) {
            const loggedInCookie = document.cookie
               .split(';')
               .map((cookie) => cookie.trim())
               .find((cookie) => cookie.startsWith('logged-in='))
               ?.split('=')[1]

            setAuthenticated(loggedInCookie === 'true')
         }
      } catch (error) {
         console.error({ error })
         setAuthenticated(false)
      }
   }, [])

   return {
      authenticated: validateBoolean(authenticated, true),
      loading: authenticated === null,
   }
}
