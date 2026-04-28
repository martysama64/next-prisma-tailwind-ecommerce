'use client'

import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { CheckIcon, EyeIcon, XIcon } from 'lucide-react'
import Link from 'next/link'

export type OrderColumn = {
   id: string
   isPaid: boolean
   payable: string
   number: string
   createdAt: string
   status: string
}

async function cancelOrder(orderId: string) {
   const response = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Cancelled' }),
   })

   if (response.ok) window.location.reload()
}

export const columns: ColumnDef<OrderColumn>[] = [
   {
      accessorKey: 'number',
      header: 'Order Number',
   },
   {
      accessorKey: 'date',
      header: 'Date',
   },
   {
      accessorKey: 'payable',
      header: 'Payable',
   },
   {
      accessorKey: 'isPaid',
      header: 'Paid',
      cell: (props) => {
         return props.cell.getValue() ? <CheckIcon /> : <XIcon />
      },
   },
   {
      accessorKey: 'status',
      header: 'Status',
   },
   {
      id: 'actions',
      cell: ({ row }) => {
         const canCancel = row.original.status === 'Processing'

         return (
            <div className="flex gap-2">
               <Link href={`/profile/orders/${row.original.id}`}>
                  <Button size="sm" variant="outline">
                     <EyeIcon className="mr-2 h-4" /> View
                  </Button>
               </Link>
               {canCancel && (
                  <Button
                     size="sm"
                     variant="destructive"
                     onClick={() => cancelOrder(row.original.id)}
                  >
                     Cancel
                  </Button>
               )}
            </div>
         )
      },
   },
]

interface OrdersTableProps {
   data: OrderColumn[]
}

export const OrdersTable: React.FC<OrdersTableProps> = ({ data }) => {
   return <DataTable searchKey="products" columns={columns} data={data} />
}
