'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'react-hot-toast'

export function InventoryClient({ inventory, warehouses, products }) {
   const router = useRouter()
   const searchParams = useSearchParams()
   const [editingId, setEditingId] = useState(null)
   const [form, setForm] = useState({
      quantity: 0,
      reorderPoint: 0,
      reorderQuantity: 0,
      reason: '',
   })

   function startEdit(row) {
      setEditingId(row.id)
      setForm({
         quantity: row.quantity,
         reorderPoint: row.reorderPoint,
         reorderQuantity: row.reorderQuantity,
         reason: 'Admin adjustment',
      })
   }

   async function saveAdjustment(event) {
      event.preventDefault()
      const response = await fetch(`/api/inventory/${editingId}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(form),
      })

      if (!response.ok) {
         toast.error('Could not update inventory')
         return
      }

      toast.success('Inventory updated')
      setEditingId(null)
      router.refresh()
   }

   function updateFilter(key, value) {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      router.push(`/inventory?${params.toString()}`)
   }

   function exportCsv() {
      const rows = [
         [
            'Product',
            'Warehouse',
            'Quantity',
            'Reserved',
            'Available',
            'Reorder Point',
            'Reorder Quantity',
            'Status',
         ],
         ...inventory.map((row) => [
            row.product.title,
            row.warehouse.name,
            row.quantity,
            row.reservedQuantity,
            row.availableQuantity,
            row.reorderPoint,
            row.reorderQuantity,
            row.status,
         ]),
      ]
      const csv = rows
         .map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
         )
         .join('\n')
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'inventory.csv'
      link.click()
      URL.revokeObjectURL(url)
   }

   return (
      <div className="space-y-4">
         <div className="grid gap-2 md:grid-cols-4">
            <select
               className="rounded-md border bg-background p-2 text-sm"
               defaultValue={searchParams.get('warehouseId') || ''}
               onChange={(event) =>
                  updateFilter('warehouseId', event.target.value)
               }
            >
               <option value="">All warehouses</option>
               {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                     {warehouse.name}
                  </option>
               ))}
            </select>
            <select
               className="rounded-md border bg-background p-2 text-sm"
               defaultValue={searchParams.get('productId') || ''}
               onChange={(event) =>
                  updateFilter('productId', event.target.value)
               }
            >
               <option value="">All products</option>
               {products.map((product) => (
                  <option key={product.id} value={product.id}>
                     {product.title}
                  </option>
               ))}
            </select>
            <Button
               variant={
                  searchParams.get('lowStock') === 'true'
                     ? 'default'
                     : 'outline'
               }
               onClick={() =>
                  updateFilter(
                     'lowStock',
                     searchParams.get('lowStock') === 'true' ? '' : 'true'
                  )
               }
            >
               Low stock only
            </Button>
            <Button variant="outline" onClick={exportCsv}>
               Export CSV
            </Button>
         </div>

         {editingId && (
            <form
               onSubmit={saveAdjustment}
               className="grid gap-3 rounded-md border p-4 md:grid-cols-4"
            >
               <Input
                  type="number"
                  value={form.quantity}
                  onChange={(event) =>
                     setForm({ ...form, quantity: Number(event.target.value) })
                  }
               />
               <Input
                  type="number"
                  value={form.reorderPoint}
                  onChange={(event) =>
                     setForm({
                        ...form,
                        reorderPoint: Number(event.target.value),
                     })
                  }
               />
               <Input
                  type="number"
                  value={form.reorderQuantity}
                  onChange={(event) =>
                     setForm({
                        ...form,
                        reorderQuantity: Number(event.target.value),
                     })
                  }
               />
               <Input
                  value={form.reason}
                  onChange={(event) =>
                     setForm({ ...form, reason: event.target.value })
                  }
               />
               <div className="flex gap-2">
                  <Button type="submit">Save</Button>
                  <Button
                     type="button"
                     variant="outline"
                     onClick={() => setEditingId(null)}
                  >
                     Cancel
                  </Button>
               </div>
            </form>
         )}

         <div className="rounded-md border">
            <table className="w-full text-sm">
               <thead>
                  <tr className="border-b text-left">
                     <th className="p-3">Product</th>
                     <th className="p-3">Warehouse</th>
                     <th className="p-3">Quantity</th>
                     <th className="p-3">Reserved</th>
                     <th className="p-3">Available</th>
                     <th className="p-3">Reorder point</th>
                     <th className="p-3">Reorder qty</th>
                     <th className="p-3">Status</th>
                     <th className="p-3">Actions</th>
                  </tr>
               </thead>
               <tbody>
                  {inventory.map((row) => (
                     <tr key={row.id} className="border-b">
                        <td className="p-3">{row.product.title}</td>
                        <td className="p-3">{row.warehouse.name}</td>
                        <td className="p-3">{row.quantity}</td>
                        <td className="p-3">{row.reservedQuantity}</td>
                        <td className="p-3">{row.availableQuantity}</td>
                        <td className="p-3">{row.reorderPoint}</td>
                        <td className="p-3">{row.reorderQuantity}</td>
                        <td className="p-3">{row.status}</td>
                        <td className="p-3">
                           <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEdit(row)}
                           >
                              Adjust
                           </Button>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
   )
}
