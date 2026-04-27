'use client'

import { ProductGrid, ProductSkeletonGrid } from '@/components/native/Product'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthenticated } from '@/hooks/useAuthentication'
import { isVariableValid } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function User({}) {
   const { authenticated, loading: loadingAuthentication } = useAuthenticated()

   const [items, setItems] = useState(null)
   const [error, setError] = useState(null)
   const [fetchingWishlist, setFetchingWishlist] = useState(true)
   const router = useRouter()

   useEffect(() => {
      if (!loadingAuthentication && !authenticated) router.push('/login')
   }, [authenticated, loadingAuthentication, router])

   useEffect(() => {
      async function getWishlist() {
         try {
            setFetchingWishlist(true)
            setError(null)

            const response = await fetch(`/api/wishlist`, {
               cache: 'no-store',
            })

            if (!response.ok) {
               setItems([])
               setError(
                  response.status === 401
                     ? 'Please log in to view your wishlist.'
                     : 'Unable to load your wishlist.'
               )
               return
            }

            const json = await response.json()

            setItems(Array.isArray(json) ? json : [])
         } catch (error) {
            console.error({ error })
            setItems([])
            setError('Unable to load your wishlist.')
         } finally {
            setFetchingWishlist(false)
         }
      }

      if (loadingAuthentication) return
      if (authenticated) getWishlist()
      if (!authenticated) {
         setItems([])
         setFetchingWishlist(false)
      }
   }, [authenticated, loadingAuthentication])

   if (fetchingWishlist || loadingAuthentication) {
      return <ProductSkeletonGrid />
   }

   if (error) {
      return (
         <Card>
            <CardContent className="p-4">
               <p>{error}</p>
            </CardContent>
         </Card>
      )
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
