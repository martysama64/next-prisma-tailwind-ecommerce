import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const defaultWarehouse = {
   name: 'Default Warehouse',
   location: 'Default',
   address: 'Default warehouse address',
   isActive: true,
   contactPhone: null,
   contactEmail: null,
   code: 'DEFAULT',
   priority: 0,
}

async function main() {
   const warehouse = await prisma.warehouse.upsert({
      where: { code: defaultWarehouse.code },
      create: defaultWarehouse,
      update: {
         name: defaultWarehouse.name,
         location: defaultWarehouse.location,
         address: defaultWarehouse.address,
         isActive: defaultWarehouse.isActive,
         contactPhone: defaultWarehouse.contactPhone,
         contactEmail: defaultWarehouse.contactEmail,
         priority: defaultWarehouse.priority,
      },
   })

   const products = await prisma.product.findMany({
      select: {
         id: true,
         stock: true,
      },
   })

   let createdInventoryRows = 0

   for (const product of products) {
      const existingInventory = await prisma.inventory.findUnique({
         where: {
            warehouseId_productId: {
               warehouseId: warehouse.id,
               productId: product.id,
            },
         },
         select: { id: true },
      })

      if (existingInventory) continue

      await prisma.inventory.create({
         data: {
            warehouseId: warehouse.id,
            productId: product.id,
            quantity: product.stock,
            reservedQuantity: 0,
            reorderPoint: 0,
            reorderQuantity: 0,
         },
      })

      createdInventoryRows += 1
   }

   const updatedOrders = await prisma.order.updateMany({
      where: {
         warehouseId: null,
      },
      data: {
         warehouseId: warehouse.id,
      },
   })

   console.log(
      `Inventory backfill complete. Default warehouse: ${warehouse.id}. Created inventory rows: ${createdInventoryRows}. Updated orders: ${updatedOrders.count}.`
   )
}

main()
   .catch((error) => {
      console.error(error)
      process.exit(1)
   })
   .finally(async () => {
      await prisma.$disconnect()
   })
