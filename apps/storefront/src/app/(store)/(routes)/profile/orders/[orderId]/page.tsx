'use client'

import {
   Card,
   CardContent,
   CardFooter,
   CardHeader,
   CardTitle,
} from '@/components/ui/card'
import { Loader } from '@/components/ui/loader'
import { useAuthenticated } from '@/hooks/useAuthentication'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { UserCombobox } from '../../components/switcher'

type OrderDetail = {
   id: string
   number: number
   status: string
   total: number
   shipping: number
   payable: number
   discount: number
   isPaid: boolean
   createdAt: string
   address: {
      address: string
      city: string
      country: string
      phone: string
   } | null
   warehouse: {
      name: string
   } | null
   orderItems: {
      productId: string
      count: number
      price: number
      discount: number
      product: {
         title: string
      }
   }[]
}

const ProductPage = ({ params }: { params: { orderId: string } }) => {
   const { authenticated } = useAuthenticated()
   const [order, setOrder] = useState<OrderDetail | null>(null)
   const [error, setError] = useState<string | null>(null)
   const [loading, setLoading] = useState(true)
   const pathname = usePathname()

   useEffect(() => {
      async function getOrder() {
         setLoading(true)
         setError(null)

         try {
            const response = await fetch(`/api/orders/${params.orderId}`, {
               method: 'GET',
               cache: 'no-store',
            })

            if (!response.ok) {
               throw new Error(await response.text())
            }

            const json = await response.json()
            setOrder(json)
         } catch (error) {
            console.error({ error })
            setError(
               error instanceof Error ? error.message : 'Unable to load order'
            )
         } finally {
            setLoading(false)
         }
      }

      if (authenticated) getOrder()
   }, [authenticated, params.orderId])

   function OrderCard() {
      return (
         <Card className="my-4 p-2">
            <CardHeader>
               <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent>
               {loading ? (
                  <div className="h-[20vh]">
                     <div className="h-full my-4 flex items-center justify-center">
                        <Loader />
                     </div>
                  </div>
               ) : error ? (
                  <p className="text-sm text-destructive">{error}</p>
               ) : order ? (
                  <div className="space-y-6">
                     <div className="grid gap-3 text-sm md:grid-cols-2">
                        <p>
                           <span className="font-medium">Order:</span> #
                           {order.number}
                        </p>
                        <p>
                           <span className="font-medium">Status:</span>{' '}
                           {order.status}
                        </p>
                        <p>
                           <span className="font-medium">Paid:</span>{' '}
                           {order.isPaid ? 'Yes' : 'No'}
                        </p>
                        <p>
                           <span className="font-medium">Date:</span>{' '}
                           {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                        <p>
                           <span className="font-medium">Warehouse:</span>{' '}
                           {order.warehouse?.name || 'Not assigned'}
                        </p>
                        <p>
                           <span className="font-medium">Payable:</span> $
                           {order.payable.toFixed(2)}
                        </p>
                     </div>

                     {order.address && (
                        <div className="rounded-md border p-3 text-sm">
                           <p className="font-medium">Shipping Address</p>
                           <p>{order.address.address}</p>
                           <p>
                              {order.address.city}, {order.address.country}
                           </p>
                           <p>{order.address.phone}</p>
                        </div>
                     )}

                     <div className="space-y-3">
                        <p className="font-medium">Items</p>
                        {order.orderItems.map((item) => (
                           <div
                              key={item.productId}
                              className="flex items-center justify-between rounded-md border p-3 text-sm"
                           >
                              <div>
                                 <p className="font-medium">
                                    {item.product.title}
                                 </p>
                                 <p className="text-muted-foreground">
                                    Quantity: {item.count}
                                 </p>
                              </div>
                              <p>${(item.price * item.count).toFixed(2)}</p>
                           </div>
                        ))}
                     </div>
                  </div>
               ) : (
                  <p className="text-sm text-muted-foreground">
                     Order not found.
                  </p>
               )}
            </CardContent>
            <CardFooter className="text-sm text-muted-foreground">
               This page is read-only. Processing orders can be cancelled from
               the orders list.
            </CardFooter>
         </Card>
      )
   }

   return (
      <div className="flex-col">
         <div className="flex-1">
            <div className="flex items-center justify-between">
               <div className="flex items-center justify-between">
                  <UserCombobox initialValue={pathname} />
               </div>
            </div>
            <OrderCard />
         </div>
      </div>
   )
}

export default ProductPage
