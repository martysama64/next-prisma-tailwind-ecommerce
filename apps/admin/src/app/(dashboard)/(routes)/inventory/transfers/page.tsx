import { Heading } from '@/components/ui/heading'
import { Separator } from '@/components/ui/separator'
import prisma from '@/lib/prisma'

import { TransfersClient } from './components/client'

export default async function InventoryTransfersPage() {
   const [transfers, warehouses, products] = await Promise.all([
      prisma.stockTransfer.findMany({
         include: { fromWarehouse: true, toWarehouse: true, movements: true },
         orderBy: { createdAt: 'desc' },
      }),
      prisma.warehouse.findMany({
         where: { isActive: true },
         orderBy: { name: 'asc' },
      }),
      prisma.product.findMany({ orderBy: { title: 'asc' } }),
   ])

   return (
      <div className="block space-y-4 my-6">
         <Heading
            title={`Stock transfers (${transfers.length})`}
            description="Move stock between warehouses"
         />
         <Separator />
         <TransfersClient
            transfers={transfers}
            warehouses={warehouses}
            products={products}
         />
      </div>
   )
}
