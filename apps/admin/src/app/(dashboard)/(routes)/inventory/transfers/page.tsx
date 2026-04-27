'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from '@/components/ui/select'
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from '@/components/ui/table'
import { useEffect, useState } from 'react'

const statuses = ['PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED']

export default function InventoryTransfersPage() {
   const [transfers, setTransfers] = useState([])
   const [warehouses, setWarehouses] = useState([])
   const [products, setProducts] = useState([])
   const [loading, setLoading] = useState(true)
   const [saving, setSaving] = useState(false)
   const [error, setError] = useState('')
   const [form, setForm] = useState({
      fromWarehouseId: '',
      toWarehouseId: '',
      productId: '',
      quantity: 1,
      reason: '',
      reference: '',
   })

   async function loadTransfers() {
      try {
         setLoading(true)
         setError('')
         const [transfersResponse, warehousesResponse, productsResponse] = await Promise.all([
            fetch('/api/stock-transfers', { cache: 'no-store' }),
            fetch('/api/warehouses?isActive=true', { cache: 'no-store' }),
            fetch('/api/products', { cache: 'no-store' }),
         ])
         if (!transfersResponse.ok) throw new Error(await transfersResponse.text())
         if (!warehousesResponse.ok) throw new Error(await warehousesResponse.text())
         if (!productsResponse.ok) throw new Error(await productsResponse.text())
         const [transfersJson, warehousesJson, productsJson] = await Promise.all([
            transfersResponse.json(),
            warehousesResponse.json(),
            productsResponse.json(),
         ])
         setTransfers(Array.isArray(transfersJson) ? transfersJson : [])
         setWarehouses(Array.isArray(warehousesJson) ? warehousesJson : [])
         setProducts(Array.isArray(productsJson) ? productsJson : [])
      } catch (error) {
         console.error({ error })
         setError('Unable to load transfers.')
      } finally {
         setLoading(false)
      }
   }

   useEffect(() => {
      loadTransfers()
   }, [])

   async function createTransfer() {
      try {
         setSaving(true)
         setError('')
         const response = await fetch('/api/stock-transfers', {
            method: 'POST',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               fromWarehouseId: form.fromWarehouseId,
               toWarehouseId: form.toWarehouseId,
               items: [{ productId: form.productId, quantity: form.quantity }],
               reason: form.reason || undefined,
               reference: form.reference || undefined,
            }),
         })
         if (!response.ok) throw new Error(await response.text())
         setForm({ ...form, productId: '', quantity: 1, reason: '', reference: '' })
         await loadTransfers()
      } catch (error) {
         console.error({ error })
         setError(error instanceof Error ? error.message : 'Unable to create transfer.')
      } finally {
         setSaving(false)
      }
   }

   async function updateStatus(transfer, status) {
      try {
         setError('')
         const response = await fetch(`/api/stock-transfers/${transfer.id}`, {
            method: 'PATCH',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
         })
         if (!response.ok) throw new Error(await response.text())
         await loadTransfers()
      } catch (error) {
         console.error({ error })
         setError(error instanceof Error ? error.message : 'Unable to update transfer.')
      }
   }

   return (
      <div className="space-y-6 py-6">
         <div>
            <h1 className="text-2xl font-semibold">Stock Transfers</h1>
            <p className="text-sm text-muted-foreground">Move inventory between warehouses.</p>
         </div>

         <div className="grid gap-3 rounded-md border p-4 md:grid-cols-3">
            <Select value={form.fromWarehouseId} onValueChange={(value) => setForm({ ...form, fromWarehouseId: value })}>
               <SelectTrigger><SelectValue placeholder="From warehouse" /></SelectTrigger>
               <SelectContent>{warehouses.map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.toWarehouseId} onValueChange={(value) => setForm({ ...form, toWarehouseId: value })}>
               <SelectTrigger><SelectValue placeholder="To warehouse" /></SelectTrigger>
               <SelectContent>{warehouses.map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.productId} onValueChange={(value) => setForm({ ...form, productId: value })}>
               <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
               <SelectContent>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.title}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" min={1} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} placeholder="Quantity" />
            <Input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Reason" />
            <Input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="Reference" />
            <Button disabled={saving || !form.fromWarehouseId || !form.toWarehouseId || !form.productId} onClick={createTransfer}>
               {saving ? 'Creating...' : 'Create Transfer'}
            </Button>
         </div>

         {error && <p className="text-sm text-red-600">{error}</p>}

         <Table>
            <TableHeader>
               <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Update Status</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {loading ? (
                  <TableRow><TableCell colSpan={5}>Loading transfers...</TableCell></TableRow>
               ) : transfers.length === 0 ? (
                  <TableRow><TableCell colSpan={5}>No transfers found.</TableCell></TableRow>
               ) : (
                  transfers.map((transfer) => (
                     <TableRow key={transfer.id}>
                        <TableCell>{transfer.fromWarehouse?.name ?? transfer.fromWarehouseId}</TableCell>
                        <TableCell>{transfer.toWarehouse?.name ?? transfer.toWarehouseId}</TableCell>
                        <TableCell>{transfer.status}</TableCell>
                        <TableCell>{formatItems(transfer.items)}</TableCell>
                        <TableCell className="text-right">
                           <Select value={transfer.status} onValueChange={(value) => updateStatus(transfer, value)}>
                              <SelectTrigger className="ml-auto w-40"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                 {statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                              </SelectContent>
                           </Select>
                        </TableCell>
                     </TableRow>
                  ))
               )}
            </TableBody>
         </Table>
      </div>
   )
}

function formatItems(items) {
   if (!Array.isArray(items)) return '-'
   return items.map((item) => `${item.productId}: ${item.quantity}`).join(', ')
}
