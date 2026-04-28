'use client'

import { Button } from '@/components/ui/button'
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from '@/components/ui/table'
import { useEffect, useState } from 'react'

export default function LowStockPage() {
   const [rows, setRows] = useState([])
   const [loading, setLoading] = useState(true)
   const [error, setError] = useState('')

   useEffect(() => {
      async function loadRows() {
         try {
            setLoading(true)
            const response = await fetch('/api/inventory?lowStock=true', {
               cache: 'no-store',
            })
            if (!response.ok) throw new Error(await response.text())
            const json = await response.json()
            setRows(Array.isArray(json) ? json : [])
         } catch (error) {
            console.error({ error })
            setError('Unable to load low-stock products.')
         } finally {
            setLoading(false)
         }
      }

      loadRows()
   }, [])

   return (
      <div className="space-y-4 py-6">
         <div className="flex items-center justify-between">
            <div>
               <h1 className="text-2xl font-semibold">Low Stock</h1>
               <p className="text-sm text-muted-foreground">
                  Inventory rows at or below their reorder point.
               </p>
            </div>
            <Button variant="outline" onClick={() => exportCsv(rows)}>
               Export CSV
            </Button>
         </div>

         {error && <p className="text-sm text-red-600">{error}</p>}

         <Table>
            <TableHeader>
               <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Reorder Point</TableHead>
                  <TableHead>Reorder Quantity</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {loading ? (
                  <TableRow><TableCell colSpan={5}>Loading low-stock rows...</TableCell></TableRow>
               ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={5}>No low-stock rows found.</TableCell></TableRow>
               ) : (
                  rows.map((row) => (
                     <TableRow key={row.id}>
                        <TableCell>{row.product?.title ?? row.productId}</TableCell>
                        <TableCell>{row.warehouse?.name ?? row.warehouseId}</TableCell>
                        <TableCell>{row.quantity - row.reservedQuantity}</TableCell>
                        <TableCell>{row.reorderPoint}</TableCell>
                        <TableCell>{row.reorderQuantity}</TableCell>
                     </TableRow>
                  ))
               )}
            </TableBody>
         </Table>
      </div>
   )
}

function exportCsv(rows) {
   const csvRows = [
      ['product', 'warehouse', 'available', 'reorderPoint', 'reorderQuantity'],
      ...rows.map((row) => [
         row.product?.title ?? row.productId,
         row.warehouse?.name ?? row.warehouseId,
         row.quantity - row.reservedQuantity,
         row.reorderPoint,
         row.reorderQuantity,
      ]),
   ]

   downloadCsv('low-stock.csv', csvRows)
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
