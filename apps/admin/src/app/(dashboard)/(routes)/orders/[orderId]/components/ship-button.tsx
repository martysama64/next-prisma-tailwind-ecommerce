'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'react-hot-toast'

export function ShipOrderButton({ orderId, disabled = false }) {
   const router = useRouter()
   const [loading, setLoading] = useState(false)

   async function shipOrder() {
      setLoading(true)
      const response = await fetch(`/api/orders/${orderId}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ status: 'Shipped' }),
      })

      setLoading(false)

      if (!response.ok) {
         toast.error(await response.text())
         return
      }

      toast.success('Order shipped')
      router.refresh()
   }

   return (
      <Button disabled={disabled || loading} onClick={shipOrder}>
         Mark shipped
      </Button>
   )
}
