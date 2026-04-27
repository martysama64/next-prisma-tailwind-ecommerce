'use client'

import { ProductGrid, ProductSkeletonGrid } from '@/components/native/Product'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthenticated } from '@/hooks/useAuthentication'
import { isVariableValid } from '@/lib/utils'
import { useUserContext } from '@/state/User'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function User({}) {
   const { authenticated } = useAuthenticated()
   const { user, loading } = useUserContext()

   const [items, setItems] = useState(null)
   const [fetchingWishlist, setFetchingWishlist] = useState(true)
   const router = useRouter()

   useEffect(() => {
      if (!loading && !isVariableValid(user)) router.push('/')
   }, [user, loading, router])

   useEffect(() => {
      async function getWishlist() {
         try {
            setFetchingWishlist(true)

            const response = await fetch(`/api/wishlist`, {
               cache: 'no-store',
            })

            if (!response.ok) {
               setItems([])
               return
            }

            const json = await response.json()

            setItems(json)
         } catch (error) {
            console.error({ error })
         } finally {
            setFetchingWishlist(false)
         }
      }

      if (authenticated) getWishlist()
      if (!authenticated) setFetchingWishlist(false)
   }, [authenticated])

   if (fetchingWishlist || loading) {
      return <ProductSkeletonGrid />
   }

   if (!isVariableValid(items) || items.length === 0) {
      return (
         <Card>
            <CardContent className="p-4">
               <p>Your wishlist is empty...</p>
            </CardContent>
         </Card>
      )
   }

   return (
      <>
         <ProductGrid products={items} />
      </>
   )
}
