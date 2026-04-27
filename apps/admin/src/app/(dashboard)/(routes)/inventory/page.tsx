import { Heading } from '@/components/ui/heading'
import { Separator } from '@/components/ui/separator'
import { getAvailableQuantity } from '@/lib/inventory'
import prisma from '@/lib/prisma'

import { InventoryClient } from './components/client'

export default async function InventoryPage({ searchParams }) {
   const warehouseId = searchParams?.warehouseId || undefined
   const productId = searchParams?.productId || undefined
   const lowStock = searchParams?.lowStock === 'true'

   const [inventoryRows, warehouses, products] = await Promise.all([
      prisma.inventory.findMany({
         where: { warehouseId, productId },
         include: { product: true, warehouse: true },
         orderBy: [{ updatedAt: 'desc' }],
      }),
      prisma.warehouse.findMany({ orderBy: { name: 'asc' } }),
      prisma.product.findMany({ orderBy: { title: 'asc' } }),
   ])

   const inventory = inventoryRows
      .map((row) => {
         const availableQuantity = getAvailableQuantity(row)
         return {
            ...row,
            availableQuantity,
            status:
               availableQuantity <= row.reorderPoint
                  ? 'Low stock'
                  : availableQuantity > 0
                    ? 'In stock'
                    : 'Out of stock',
         }
      })
      .filter((row) => !lowStock || row.availableQuantity <= row.reorderPoint)

   return (
      <div className="block space-y-4 my-6">
         <Heading
            title={`Inventory (${inventory.length})`}
            description="Manage stock levels by warehouse"
         />
         <Separator />
         <InventoryClient
            inventory={inventory}
            warehouses={warehouses}
            products={products}
         />
      </div>
   )
}
