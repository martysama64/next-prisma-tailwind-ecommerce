'use client'

import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from '@/components/ui/table'
import { useEffect, useState } from 'react'

export default function InventoryMovementsPage() {
   const [movements, setMovements] = useState([])
   const [loading, setLoading] = useState(true)
   const [error, setError] = useState('')

   useEffect(() => {
      async function loadMovements() {
         try {
            setLoading(true)
            const response = await fetch('/api/inventory-movements', { cache: 'no-store' })
            if (!response.ok) throw new Error(await response.text())
            const json = await response.json()
            setMovements(Array.isArray(json) ? json : [])
         } catch (error) {
            console.error({ error })
            setError('Unable to load inventory movements.')
         } finally {
            setLoading(false)
         }
      }

      loadMovements()
   }, [])

   return (
      <div className="space-y-4 py-6">
         <div>
            <h1 className="text-2xl font-semibold">Inventory Movements</h1>
            <p className="text-sm text-muted-foreground">Audit trail for stock changes.</p>
         </div>
         {error && <p className="text-sm text-red-600">{error}</p>}
         <Table>
            <TableHeader>
               <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Created</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {loading ? (
                  <TableRow><TableCell colSpan={5}>Loading movements...</TableCell></TableRow>
               ) : movements.length === 0 ? (
                  <TableRow><TableCell colSpan={5}>No movements found.</TableCell></TableRow>
               ) : (
                  movements.map((movement) => (
                     <TableRow key={movement.id}>
                        <TableCell>{movement.type}</TableCell>
                        <TableCell>{movement.product?.title ?? movement.productId ?? '-'}</TableCell>
                        <TableCell>{movement.quantity}</TableCell>
                        <TableCell>{movement.reason ?? '-'}</TableCell>
                        <TableCell>{new Date(movement.createdAt).toLocaleString()}</TableCell>
                     </TableRow>
                  ))
               )}
            </TableBody>
         </Table>
      </div>
   )
}
