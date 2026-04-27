'use client'

import { Button } from '@/components/ui/button'
import {
   Dialog,
   DialogContent,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from '@/components/ui/table'
import { useEffect, useState } from 'react'

const emptyWarehouse = {
   id: '',
   name: '',
   location: '',
   address: '',
   contactPhone: '',
   contactEmail: '',
   code: '',
   priority: 0,
   isActive: true,
}

export default function WarehousesPage() {
   const [warehouses, setWarehouses] = useState([])
   const [loading, setLoading] = useState(true)
   const [saving, setSaving] = useState(false)
   const [error, setError] = useState('')
   const [open, setOpen] = useState(false)
   const [form, setForm] = useState(emptyWarehouse)

   async function loadWarehouses() {
      try {
         setLoading(true)
         setError('')
         const response = await fetch('/api/warehouses', { cache: 'no-store' })
         if (!response.ok) throw new Error(await response.text())
         const json = await response.json()
         setWarehouses(Array.isArray(json) ? json : [])
      } catch (error) {
         console.error({ error })
         setError('Unable to load warehouses.')
      } finally {
         setLoading(false)
      }
   }

   useEffect(() => {
      loadWarehouses()
   }, [])

   function openCreate() {
      setForm(emptyWarehouse)
      setOpen(true)
   }

   function openEdit(warehouse) {
      setForm({ ...emptyWarehouse, ...warehouse })
      setOpen(true)
   }

   async function saveWarehouse() {
      try {
         setSaving(true)
         setError('')
         const isEditing = Boolean(form.id)
         const response = await fetch(
            isEditing ? `/api/warehouses/${form.id}` : '/api/warehouses',
            {
               method: isEditing ? 'PATCH' : 'POST',
               cache: 'no-store',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                  name: form.name,
                  location: form.location,
                  address: form.address,
                  contactPhone: form.contactPhone || null,
                  contactEmail: form.contactEmail || null,
                  code: form.code || null,
                  priority: form.priority,
                  isActive: form.isActive,
               }),
            }
         )
         if (!response.ok) throw new Error(await response.text())
         setOpen(false)
         await loadWarehouses()
      } catch (error) {
         console.error({ error })
         setError(error instanceof Error ? error.message : 'Unable to save warehouse.')
      } finally {
         setSaving(false)
      }
   }

   async function toggleWarehouse(warehouse) {
      try {
         setError('')
         const response = await fetch(`/api/warehouses/${warehouse.id}`, {
            method: 'PATCH',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !warehouse.isActive }),
         })
         if (!response.ok) throw new Error(await response.text())
         await loadWarehouses()
      } catch (error) {
         console.error({ error })
         setError('Unable to update warehouse.')
      }
   }

   return (
      <div className="space-y-4 py-6">
         <div className="flex items-center justify-between">
            <div>
               <h1 className="text-2xl font-semibold">Warehouses</h1>
               <p className="text-sm text-muted-foreground">Manage stock locations.</p>
            </div>
            <Button onClick={openCreate}>Create Warehouse</Button>
         </div>

         {error && <p className="text-sm text-red-600">{error}</p>}

         <Table>
            <TableHeader>
               <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {loading ? (
                  <TableRow><TableCell colSpan={4}>Loading warehouses...</TableCell></TableRow>
               ) : warehouses.length === 0 ? (
                  <TableRow><TableCell colSpan={4}>No warehouses found.</TableCell></TableRow>
               ) : (
                  warehouses.map((warehouse) => (
                     <TableRow key={warehouse.id}>
                        <TableCell>{warehouse.name}</TableCell>
                        <TableCell>{warehouse.location}</TableCell>
                        <TableCell>{warehouse.isActive ? 'Yes' : 'No'}</TableCell>
                        <TableCell className="text-right space-x-2">
                           <Button variant="outline" size="sm" onClick={() => openEdit(warehouse)}>Edit</Button>
                           <Button variant="outline" size="sm" onClick={() => toggleWarehouse(warehouse)}>
                              {warehouse.isActive ? 'Deactivate' : 'Activate'}
                           </Button>
                        </TableCell>
                     </TableRow>
                  ))
               )}
            </TableBody>
         </Table>

         <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
               <DialogHeader>
                  <DialogTitle>{form.id ? 'Edit Warehouse' : 'Create Warehouse'}</DialogTitle>
               </DialogHeader>
               <div className="space-y-3">
                  <Input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                  <Input placeholder="Location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
                  <Input placeholder="Address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
                  <Input placeholder="Contact phone" value={form.contactPhone ?? ''} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} />
                  <Input placeholder="Contact email" value={form.contactEmail ?? ''} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} />
                  <Input placeholder="Code" value={form.code ?? ''} onChange={(event) => setForm({ ...form, code: event.target.value })} />
                  <Input type="number" placeholder="Priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} />
                  <label className="flex items-center gap-2 text-sm">
                     <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
                     Active
                  </label>
               </div>
               <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button disabled={saving} onClick={saveWarehouse}>{saving ? 'Saving...' : 'Save'}</Button>
               </DialogFooter>
            </DialogContent>
         </Dialog>
      </div>
   )
}
