import { Heading } from '@/components/ui/heading'
import { Separator } from '@/components/ui/separator'
import prisma from '@/lib/prisma'

import { WarehousesClient } from './components/client'

export default async function WarehousesPage() {
   const warehouses = await prisma.warehouse.findMany({
      include: { inventories: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
   })

   return (
      <div className="block space-y-4 my-6">
         <Heading
            title={`Warehouses (${warehouses.length})`}
            description="Manage stock locations"
         />
         <Separator />
         <WarehousesClient warehouses={warehouses} />
      </div>
   )
}
