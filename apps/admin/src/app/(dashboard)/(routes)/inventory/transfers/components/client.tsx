'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'react-hot-toast'

export function TransfersClient({ transfers, warehouses, products }) {
   const router = useRouter()
   const [form, setForm] = useState({
      fromWarehouseId: '',
      toWarehouseId: '',
      productId: '',
      quantity: 1,
      reason: '',
   })

   async function createTransfer(event) {
      event.preventDefault()
      const response = await fetch('/api/stock-transfers', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            fromWarehouseId: form.fromWarehouseId,
            toWarehouseId: form.toWarehouseId,
            reason: form.reason,
            items: [{ productId: form.productId, quantity: form.quantity }],
         }),
      })
      if (!response.ok) {
         toast.error(await response.text())
         return
      }
      toast.success('Transfer created')
      router.refresh()
   }

   async function updateTransfer(id, status) {
      const response = await fetch(`/api/stock-transfers/${id}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ status }),
      })
      if (!response.ok) {
         toast.error(await response.text())
         return
      }
      toast.success('Transfer updated')
      router.refresh()
   }

   return (
      <div className="space-y-6">
         <form
            onSubmit={createTransfer}
            className="grid gap-3 rounded-md border p-4 md:grid-cols-3"
         >
            <select
               className="rounded-md border bg-background p-2 text-sm"
               value={form.fromWarehouseId}
               onChange={(event) =>
                  setForm({ ...form, fromWarehouseId: event.target.value })
               }
               required
            >
               <option value="">From warehouse</option>
               {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                     {warehouse.name}
                  </option>
               ))}
            </select>
            <select
               className="rounded-md border bg-background p-2 text-sm"
               value={form.toWarehouseId}
               onChange={(event) =>
                  setForm({ ...form, toWarehouseId: event.target.value })
               }
               required
            >
               <option value="">To warehouse</option>
               {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                     {warehouse.name}
                  </option>
               ))}
            </select>
            <select
               className="rounded-md border bg-background p-2 text-sm"
               value={form.productId}
               onChange={(event) =>
                  setForm({ ...form, productId: event.target.value })
               }
               required
            >
               <option value="">Product</option>
               {products.map((product) => (
                  <option key={product.id} value={product.id}>
                     {product.title}
                  </option>
               ))}
            </select>
            <Input
               type="number"
               min={1}
               value={form.quantity}
               onChange={(event) =>
                  setForm({ ...form, quantity: Number(event.target.value) })
               }
            />
            <Input
               placeholder="Reason"
               value={form.reason}
               onChange={(event) =>
                  setForm({ ...form, reason: event.target.value })
               }
            />
            <Button type="submit">Create transfer</Button>
         </form>
         <div className="rounded-md border">
            <table className="w-full text-sm">
               <thead>
                  <tr className="border-b text-left">
                     <th className="p-3">From</th>
                     <th className="p-3">To</th>
                     <th className="p-3">Status</th>
                     <th className="p-3">Items</th>
                     <th className="p-3">Actions</th>
                  </tr>
               </thead>
               <tbody>
                  {transfers.map((transfer) => (
                     <tr key={transfer.id} className="border-b">
                        <td className="p-3">{transfer.fromWarehouse.name}</td>
                        <td className="p-3">{transfer.toWarehouse.name}</td>
                        <td className="p-3">{transfer.status}</td>
                        <td className="p-3">
                           <code>{JSON.stringify(transfer.items)}</code>
                        </td>
                        <td className="flex gap-2 p-3">
                           {transfer.status === 'PENDING' && (
                              <Button
                                 size="sm"
                                 onClick={() =>
                                    updateTransfer(transfer.id, 'APPROVED')
                                 }
                              >
                                 Approve
                              </Button>
                           )}
                           {['PENDING', 'APPROVED'].includes(
                              transfer.status
                           ) && (
                              <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={() =>
                                    updateTransfer(transfer.id, 'COMPLETED')
                                 }
                              >
                                 Complete
                              </Button>
                           )}
                           {['PENDING', 'APPROVED'].includes(
                              transfer.status
                           ) && (
                              <Button
                                 size="sm"
                                 variant="destructive"
                                 onClick={() =>
                                    updateTransfer(transfer.id, 'CANCELLED')
                                 }
                              >
                                 Cancel
                              </Button>
                           )}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
   )
}
