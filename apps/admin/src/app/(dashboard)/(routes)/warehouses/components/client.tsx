'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'react-hot-toast'

export function WarehousesClient({ warehouses }) {
   const router = useRouter()
   const [editingId, setEditingId] = useState(null)
   const [form, setForm] = useState({
      name: '',
      location: '',
      address: '',
      contactPhone: '',
      contactEmail: '',
      code: '',
      priority: 0,
      isActive: true,
   })

   function editWarehouse(warehouse) {
      setEditingId(warehouse.id)
      setForm({
         name: warehouse.name,
         location: warehouse.location,
         address: warehouse.address,
         contactPhone: warehouse.contactPhone || '',
         contactEmail: warehouse.contactEmail || '',
         code: warehouse.code || '',
         priority: warehouse.priority || 0,
         isActive: warehouse.isActive,
      })
   }

   async function submit(event) {
      event.preventDefault()
      const url = editingId ? `/api/warehouses/${editingId}` : '/api/warehouses'
      const method = editingId ? 'PATCH' : 'POST'

      const response = await fetch(url, {
         method,
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(form),
      })

      if (!response.ok) {
         toast.error('Could not save warehouse')
         return
      }

      toast.success('Warehouse saved')
      setEditingId(null)
      setForm({
         name: '',
         location: '',
         address: '',
         contactPhone: '',
         contactEmail: '',
         code: '',
         priority: 0,
         isActive: true,
      })
      router.refresh()
   }

   async function deactivate(id) {
      const response = await fetch(`/api/warehouses/${id}`, {
         method: 'DELETE',
      })
      if (!response.ok) {
         toast.error('Could not deactivate warehouse')
         return
      }
      toast.success('Warehouse deactivated')
      router.refresh()
   }

   async function toggleActive(warehouse) {
      const response = await fetch(`/api/warehouses/${warehouse.id}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ isActive: !warehouse.isActive }),
      })
      if (!response.ok) {
         toast.error('Could not update status')
         return
      }
      router.refresh()
   }

   return (
      <div className="space-y-6">
         <form
            onSubmit={submit}
            className="grid gap-3 rounded-md border p-4 md:grid-cols-3"
         >
            <Input
               placeholder="Name"
               value={form.name}
               onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
               }
            />
            <Input
               placeholder="Location"
               value={form.location}
               onChange={(event) =>
                  setForm({ ...form, location: event.target.value })
               }
            />
            <Input
               placeholder="Address"
               value={form.address}
               onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
               }
            />
            <Input
               placeholder="Contact phone"
               value={form.contactPhone}
               onChange={(event) =>
                  setForm({ ...form, contactPhone: event.target.value })
               }
            />
            <Input
               placeholder="Contact email"
               value={form.contactEmail}
               onChange={(event) =>
                  setForm({ ...form, contactEmail: event.target.value })
               }
            />
            <Input
               placeholder="Code"
               value={form.code}
               onChange={(event) =>
                  setForm({ ...form, code: event.target.value })
               }
            />
            <Input
               type="number"
               placeholder="Priority"
               value={form.priority}
               onChange={(event) =>
                  setForm({ ...form, priority: Number(event.target.value) })
               }
            />
            <label className="flex items-center gap-2 text-sm">
               <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                     setForm({ ...form, isActive: event.target.checked })
                  }
               />
               Active
            </label>
            <div className="flex gap-2">
               <Button type="submit">{editingId ? 'Update' : 'Create'}</Button>
               {editingId && (
                  <Button
                     type="button"
                     variant="outline"
                     onClick={() => setEditingId(null)}
                  >
                     Cancel
                  </Button>
               )}
            </div>
         </form>

         <div className="rounded-md border">
            <table className="w-full text-sm">
               <thead>
                  <tr className="border-b text-left">
                     <th className="p-3">Name</th>
                     <th className="p-3">Location</th>
                     <th className="p-3">Status</th>
                     <th className="p-3">Product count</th>
                     <th className="p-3">Actions</th>
                  </tr>
               </thead>
               <tbody>
                  {warehouses.map((warehouse) => (
                     <tr key={warehouse.id} className="border-b">
                        <td className="p-3">{warehouse.name}</td>
                        <td className="p-3">{warehouse.location}</td>
                        <td className="p-3">
                           {warehouse.isActive ? 'Active' : 'Inactive'}
                        </td>
                        <td className="p-3">{warehouse.inventories.length}</td>
                        <td className="flex gap-2 p-3">
                           <Button
                              size="sm"
                              variant="outline"
                              onClick={() => editWarehouse(warehouse)}
                           >
                              Edit
                           </Button>
                           <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleActive(warehouse)}
                           >
                              {warehouse.isActive ? 'Deactivate' : 'Activate'}
                           </Button>
                           <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deactivate(warehouse.id)}
                           >
                              Delete
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
