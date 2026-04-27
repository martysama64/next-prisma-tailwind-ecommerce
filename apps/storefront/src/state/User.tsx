import { useAuthenticated } from '@/hooks/useAuthentication'
import { isVariableValid, validateBoolean } from '@/lib/utils'
import React, { createContext, useContext, useEffect, useState } from 'react'

const UserContext = createContext({
   user: null,
   loading: true,
   refreshUser: () => {},
})

export const useUserContext = () => {
   return useContext(UserContext)
}

export const UserContextProvider = ({ children }) => {
   const { authenticated } = useAuthenticated()

   const [user, setUser] = useState(null)
   const [loading, setLoading] = useState(true)

   const refreshUser = async () => {
      try {
         if (authenticated) {
            setLoading(true)

            const response = await fetch(`/api/profile`, {
               cache: 'no-store',
            })

            if (!response.ok) {
               setUser(null)
               return
            }

            const json = await response.json()

            if (isVariableValid(json)) {
               setUser(json)
            }
         }
      } catch (error) {
         console.error({ error })
      } finally {
         setLoading(false)
      }
   }

   useEffect(() => {
      try {
         async function fetchData() {
            try {
               setLoading(true)

               const response = await fetch(`/api/profile`, {
                  cache: 'no-store',
               })

               if (!response.ok) {
                  setUser(null)
                  return
               }

               const json = await response.json()

               if (isVariableValid(json)) {
                  setUser(json)
               }
            } finally {
               setLoading(false)
            }
         }

         if (authenticated) fetchData()
         if (!authenticated) {
            setUser(null)
            setLoading(false)
         }
      } catch (error) {
         console.error({ error })
         setLoading(false)
      }
   }, [authenticated])

   return (
      <UserContext.Provider value={{ user, loading, refreshUser }}>
         {children}
      </UserContext.Provider>
   )
}
