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
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function InventoryPage() {
   const [inventory, setInventory] = useState([])
   const [warehouses, setWarehouses] = useState([])
   const [warehouseId, setWarehouseId] = useState('all')
   const [loading, setLoading] = useState(true)
   const [saving, setSaving] = useState(false)
   const [error, setError] = useState('')
   const [adjusting, setAdjusting] = useState(null)
   const [quantity, setQuantity] = useState(0)
   const [reason, setReason] = useState('Inventory quantity adjusted')

   async function loadInventory(nextWarehouseId = warehouseId) {
      try {
         setLoading(true)
         setError('')
         const query = nextWarehouseId && nextWarehouseId !== 'all' ? `?warehouseId=${nextWarehouseId}` : ''
         const [inventoryResponse, warehouseResponse] = await Promise.all([
            fetch(`/api/inventory${query}`, { cache: 'no-store' }),
            fetch('/api/warehouses', { cache: 'no-store' }),
         ])
         if (!inventoryResponse.ok) throw new Error(await inventoryResponse.text())
         if (!warehouseResponse.ok) throw new Error(await warehouseResponse.text())
         const [inventoryJson, warehouseJson] = await Promise.all([
            inventoryResponse.json(),
            warehouseResponse.json(),
         ])
         setInventory(Array.isArray(inventoryJson) ? inventoryJson : [])
         setWarehouses(Array.isArray(warehouseJson) ? warehouseJson : [])
      } catch (error) {
         console.error({ error })
         setError('Unable to load inventory.')
      } finally {
         setLoading(false)
      }
   }

   useEffect(() => {
      loadInventory()
   }, [])

   function openAdjust(row) {
      setAdjusting(row)
      setQuantity(row.quantity)
      setReason('Inventory quantity adjusted')
   }

   async function saveAdjustment() {
      try {
         setSaving(true)
         setError('')
         const response = await fetch(`/api/inventory/${adjusting.id}`, {
            method: 'PATCH',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity, reason }),
         })
         if (!response.ok) throw new Error(await response.text())
         setAdjusting(null)
         await loadInventory()
      } catch (error) {
         console.error({ error })
         setError(error instanceof Error ? error.message : 'Unable to adjust inventory.')
      } finally {
         setSaving(false)
      }
   }

   return (
      <div className="space-y-4 py-6">
         <div className="flex items-center justify-between gap-4">
            <div>
               <h1 className="text-2xl font-semibold">Inventory</h1>
               <p className="text-sm text-muted-foreground">Track physical and reserved stock.</p>
            </div>
            <div className="flex gap-2">
               <Button variant="outline" onClick={() => exportInventoryCsv(inventory)}>Export CSV</Button>
               <Link href="/inventory/low-stock"><Button variant="outline">Low Stock</Button></Link>
               <Link href="/inventory/movements"><Button variant="outline">Movements</Button></Link>
               <Link href="/inventory/transfers"><Button variant="outline">Transfers</Button></Link>
            </div>
         </div>

         <div className="max-w-sm">
            <Select
               value={warehouseId}
               onValueChange={(value) => {
                  setWarehouseId(value)
                  loadInventory(value)
               }}
            >
               <SelectTrigger><SelectValue placeholder="Filter by warehouse" /></SelectTrigger>
               <SelectContent>
                  <SelectItem value="all">All warehouses</SelectItem>
                  {warehouses.map((warehouse) => (
                     <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
                  ))}
               </SelectContent>
            </Select>
         </div>

         {error && <p className="text-sm text-red-600">{error}</p>}

         <Table>
            <TableHeader>
               <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Reserved</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {loading ? (
                  <TableRow><TableCell colSpan={6}>Loading inventory...</TableCell></TableRow>
               ) : inventory.length === 0 ? (
                  <TableRow><TableCell colSpan={6}>No inventory rows found.</TableCell></TableRow>
               ) : (
                  inventory.map((row) => (
                     <TableRow key={row.id}>
                        <TableCell>{row.product?.title ?? row.productId}</TableCell>
                        <TableCell>{row.warehouse?.name ?? row.warehouseId}</TableCell>
                        <TableCell>{row.quantity}</TableCell>
                        <TableCell>{row.reservedQuantity}</TableCell>
                        <TableCell>{row.quantity - row.reservedQuantity}</TableCell>
                        <TableCell className="text-right">
                           <Button variant="outline" size="sm" onClick={() => openAdjust(row)}>Quick Adjust</Button>
                        </TableCell>
                     </TableRow>
                  ))
               )}
            </TableBody>
         </Table>

         <Dialog open={Boolean(adjusting)} onOpenChange={(open) => !open && setAdjusting(null)}>
            <DialogContent>
               <DialogHeader><DialogTitle>Quick Adjust Inventory</DialogTitle></DialogHeader>
               <div className="space-y-3">
                  <Input type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
                  <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" />
               </div>
               <DialogFooter>
                  <Button variant="outline" onClick={() => setAdjusting(null)}>Cancel</Button>
                  <Button disabled={saving} onClick={saveAdjustment}>{saving ? 'Saving...' : 'Save Adjustment'}</Button>
               </DialogFooter>
            </DialogContent>
         </Dialog>
      </div>
   )
}

function exportInventoryCsv(rows) {
   downloadCsv('inventory.csv', [
      ['product', 'warehouse', 'quantity', 'reservedQuantity', 'availableQuantity'],
      ...rows.map((row) => [
         row.product?.title ?? row.productId,
         row.warehouse?.name ?? row.warehouseId,
         row.quantity,
         row.reservedQuantity,
         row.quantity - row.reservedQuantity,
      ]),
   ])
}

function downloadCsv(filename, rows) {
   const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n')
   const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
   const link = document.createElement('a')
   link.href = url
   link.download = filename
   link.click()
   URL.revokeObjectURL(url)
}
