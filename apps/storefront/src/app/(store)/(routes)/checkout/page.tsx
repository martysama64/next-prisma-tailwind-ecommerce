'use client'

import { Separator } from '@/components/native/separator'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuthenticated } from '@/hooks/useAuthentication'
import { isVariableValid } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function CheckoutPage() {
   const { authenticated, loading: loadingAuthentication } = useAuthenticated()
   const router = useRouter()

   const [cart, setCart] = useState(null)
   const [addresses, setAddresses] = useState([])
   const [addressId, setAddressId] = useState('')
   const [discountCode, setDiscountCode] = useState('')
   const [loading, setLoading] = useState(true)
   const [submitting, setSubmitting] = useState(false)
   const [error, setError] = useState(null)
   const [stockErrors, setStockErrors] = useState([])

   useEffect(() => {
      if (!loadingAuthentication && !authenticated) router.push('/login')
   }, [authenticated, loadingAuthentication, router])

   useEffect(() => {
      async function loadCheckout() {
         try {
            setLoading(true)
            setError(null)

            const [cartResponse, addressesResponse] = await Promise.all([
               fetch('/api/cart', { cache: 'no-store' }),
               fetch('/api/addresses', { cache: 'no-store' }),
            ])

            if (cartResponse.status === 401 || addressesResponse.status === 401) {
               router.push('/login')
               return
            }

            if (!cartResponse.ok) {
               throw new Error('Unable to load your cart.')
            }

            if (!addressesResponse.ok) {
               throw new Error('Unable to load your addresses.')
            }

            const [cartJson, addressesJson] = await Promise.all([
               cartResponse.json(),
               addressesResponse.json(),
            ])

            const nextAddresses = Array.isArray(addressesJson)
               ? addressesJson
               : []

            setCart(cartJson)
            setAddresses(nextAddresses)
            setAddressId(nextAddresses[0]?.id ?? '')
         } catch (error) {
            console.error({ error })
            setCart({ items: [] })
            setAddresses([])
            setError(
               error instanceof Error
                  ? error.message
                  : 'Unable to load checkout.'
            )
         } finally {
            setLoading(false)
         }
      }

      if (loadingAuthentication) return
      if (authenticated) loadCheckout()
      if (!authenticated) setLoading(false)
   }, [authenticated, loadingAuthentication, router])

   async function onSubmit() {
      try {
         setSubmitting(true)
         setError(null)
         setStockErrors([])

         const response = await fetch('/api/orders', {
            method: 'POST',
            cache: 'no-store',
            headers: {
               'Content-Type': 'application/json',
            },
            body: JSON.stringify({
               addressId,
               discountCode: discountCode.trim() || undefined,
            }),
         })

         if (response.status === 401) {
            router.push('/login')
            return
         }

         if (response.status === 409) {
            const json = await response.json()
            setStockErrors(Array.isArray(json?.items) ? json.items : [])
            setError('Some cart items do not have enough stock.')
            return
         }

         if (!response.ok) {
            const message = await response.text()
            setError(message || 'Unable to create order.')
            return
         }

         router.push('/profile/orders')
         router.refresh()
      } catch (error) {
         console.error({ error })
         setError('Unable to create order.')
      } finally {
         setSubmitting(false)
      }
   }

   const items = cart?.items ?? []
   const totals = calculateTotals(items)

   if (loading || loadingAuthentication) {
      return (
         <Card className="animate-pulse">
            <CardContent className="p-4">Loading checkout...</CardContent>
         </Card>
      )
   }

   if (error && !items.length) {
      return (
         <Card>
            <CardContent className="p-4">{error}</CardContent>
         </Card>
      )
   }

   if (!items.length) {
      return (
         <Card>
            <CardContent className="p-4 space-y-3">
               <p>Your cart is empty.</p>
               <Link href="/products">
                  <Button>Continue Shopping</Button>
               </Link>
            </CardContent>
         </Card>
      )
   }

   if (!addresses.length) {
      return (
         <Card>
            <CardHeader className="p-4 pb-0">
               <h1 className="text-xl font-semibold">Checkout</h1>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
               <p>You need a shipping address before placing an order.</p>
               <Link href="/profile/addresses/new">
                  <Button>Add Address</Button>
               </Link>
            </CardContent>
         </Card>
      )
   }

   return (
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
         <div className="md:col-span-2 space-y-3">
            <Card>
               <CardHeader className="p-4 pb-0">
                  <h1 className="text-xl font-semibold">Checkout</h1>
               </CardHeader>
               <CardContent className="p-4 space-y-4">
                  <section className="space-y-2">
                     <h2 className="font-medium">Shipping Address</h2>
                     <div className="space-y-2">
                        {addresses.map((address) => (
                           <label
                              key={address.id}
                              className="flex cursor-pointer gap-3 rounded-md border p-3 text-sm"
                           >
                              <input
                                 type="radio"
                                 name="addressId"
                                 value={address.id}
                                 checked={addressId === address.id}
                                 onChange={() => setAddressId(address.id)}
                              />
                              <span>
                                 <span className="block font-medium">
                                    {address.city}
                                 </span>
                                 <span className="block text-muted-foreground">
                                    {address.address}
                                 </span>
                                 <span className="block text-muted-foreground">
                                    {address.phone} - {address.postalCode}
                                 </span>
                              </span>
                           </label>
                        ))}
                     </div>
                  </section>

                  <section className="space-y-2">
                     <h2 className="font-medium">Discount Code</h2>
                     <Input
                        value={discountCode}
                        onChange={(event) => setDiscountCode(event.target.value)}
                        placeholder="Optional discount code"
                        disabled={submitting}
                     />
                  </section>

                  <section className="space-y-2">
                     <h2 className="font-medium">Items</h2>
                     {items.map((item) => (
                        <div
                           key={item.productId}
                           className="flex justify-between rounded-md border p-3 text-sm"
                        >
                           <span>{item.product?.title}</span>
                           <span>x{item.count}</span>
                        </div>
                     ))}
                  </section>

                  {error && <p className="text-sm text-red-700">{error}</p>}

                  {stockErrors.length > 0 && (
                     <div className="space-y-2 rounded-md border border-red-200 p-3 text-sm text-red-700">
                        {stockErrors.map((item) => (
                           <p key={item.productId}>
                              {getProductTitle(items, item.productId)} requested{' '}
                              {item.requested ?? 'more than available'}; available{' '}
                              {isVariableValid(item.available)
                                 ? item.available
                                 : 'unknown'}
                              .
                           </p>
                        ))}
                     </div>
                  )}
               </CardContent>
            </Card>
         </div>

         <Card className="h-min">
            <CardHeader className="p-4 pb-0">
               <h2 className="font-bold tracking-tight">Order Summary</h2>
            </CardHeader>
            <CardContent className="p-4 text-sm space-y-2">
               <div className="flex justify-between">
                  <p>Total Amount</p>
                  <h3>${totals.totalAmount}</h3>
               </div>
               <div className="flex justify-between">
                  <p>Discount Amount</p>
                  <h3>${totals.discountAmount}</h3>
               </div>
               <div className="flex justify-between">
                  <p>Tax Amount</p>
                  <h3>${totals.taxAmount}</h3>
               </div>
               <Separator className="my-4" />
               <div className="flex justify-between font-medium">
                  <p>Payable Amount</p>
                  <h3>${totals.payableAmount}</h3>
               </div>
            </CardContent>
            <CardFooter>
               <Button
                  className="w-full"
                  disabled={submitting || !addressId}
                  onClick={onSubmit}
               >
                  {submitting ? 'Placing Order...' : 'Place Order'}
               </Button>
            </CardFooter>
         </Card>
      </div>
   )
}

function calculateTotals(items) {
   let totalAmount = 0,
      discountAmount = 0

   for (const item of items) {
      totalAmount += item?.count * item?.product?.price
      discountAmount += item?.count * item?.product?.discount
   }

   const afterDiscountAmount = totalAmount - discountAmount
   const taxAmount = afterDiscountAmount * 0.09
   const payableAmount = afterDiscountAmount + taxAmount

   return {
      totalAmount: totalAmount.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      payableAmount: payableAmount.toFixed(2),
   }
}

function getProductTitle(items, productId) {
   const item = items.find((item) => item.productId === productId)
   return item?.product?.title ?? 'Product'
}
