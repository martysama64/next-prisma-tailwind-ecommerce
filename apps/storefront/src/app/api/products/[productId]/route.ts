import {
   getAvailableQuantity,
   getInventoryAvailabilityStatus,
   validateTransferItems,
} from '@/lib/inventory'
import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(
   req: Request,
   { params }: { params: { productId: string } }
) {
   try {
      if (!params.productId) {
         return new NextResponse('Product id is required', { status: 400 })
      }

      const product = await prisma.product.findUniqueOrThrow({
         where: { id: params.productId },
         include: {
            categories: true,
            brand: true,
            inventories: {
               include: {
                  warehouse: true,
               },
            },
         },
      })

      const incomingTransfers = await prisma.stockTransfer.findMany({
         where: {
            status: { in: ['PENDING', 'APPROVED'] },
            toWarehouse: { isActive: true },
         },
      })

      const productIncomingTransfers = incomingTransfers.filter((transfer) => {
         try {
            return validateTransferItems(transfer.items).some(
               (item) => item.productId === product.id
            )
         } catch (error) {
            return false
         }
      })

      const totalQuantity = product.inventories.reduce(
         (total, inventory) => total + inventory.quantity,
         0
      )
      const totalReservedQuantity = product.inventories.reduce(
         (total, inventory) => total + inventory.reservedQuantity,
         0
      )
      const totalAvailableQuantity = product.inventories.reduce(
         (total, inventory) => total + getAvailableQuantity(inventory),
         0
      )

      const availability = {
         totalQuantity,
         totalReservedQuantity,
         totalAvailableQuantity,
         status: getInventoryAvailabilityStatus(
            product,
            product.inventories,
            productIncomingTransfers
         ),
         warehouses: product.inventories.map((inventory) => ({
            warehouseId: inventory.warehouseId,
            warehouseName: inventory.warehouse.name,
            address: inventory.warehouse.address,
            quantity: inventory.quantity,
            reservedQuantity: inventory.reservedQuantity,
            availableQuantity: getAvailableQuantity(inventory),
            reorderPoint: inventory.reorderPoint,
            incoming: productIncomingTransfers.some(
               (transfer) => transfer.toWarehouseId === inventory.warehouseId
            ),
         })),
      }

      return NextResponse.json({ ...product, availability })
   } catch (error) {
      console.error('[PRODUCT_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
