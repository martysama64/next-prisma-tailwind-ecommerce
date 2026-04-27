import {
   adjustInventory,
   adjustInventorySchema,
   getAvailableQuantity,
} from '@/lib/inventory'
import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { InventoryMovementType } from '@prisma/client'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const inventoryPatchSchema = z.object({
   quantity: z.coerce.number().int().nonnegative().optional(),
   reservedQuantity: z.coerce.number().int().nonnegative().optional(),
   reorderPoint: z.coerce.number().int().nonnegative().optional(),
   reorderQuantity: z.coerce.number().int().nonnegative().optional(),
   reason: z.string().optional(),
   reference: z.string().optional(),
})

export async function PATCH(
   req: Request,
   { params }: { params: { inventoryId: string } }
) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })
      if (!params.inventoryId) {
         return new NextResponse('Inventory id is required', { status: 400 })
      }

      const body = inventoryPatchSchema.parse(await req.json())

      const inventory = await prisma.$transaction(async (tx) => {
         const currentInventory = await tx.inventory.findUniqueOrThrow({
            where: { id: params.inventoryId },
            include: { product: true },
         })

         let updatedInventory: {
            id: string
            warehouseId: string
            productId: string
            quantity: number
            reservedQuantity: number
         } = currentInventory

         if (body.quantity !== undefined) {
            updatedInventory = await adjustInventory(
               tx,
               adjustInventorySchema.parse({
                  inventoryId: params.inventoryId,
                  type: InventoryMovementType.ADJUSTMENT,
                  quantity: body.quantity,
                  reason: body.reason || 'Inventory quantity adjusted',
                  reference: body.reference,
               })
            )
         }

         const nextReservedQuantity =
            body.reservedQuantity ?? updatedInventory.reservedQuantity
         const nextQuantity = body.quantity ?? updatedInventory.quantity

         if (
            nextReservedQuantity > nextQuantity &&
            !currentInventory.product.allowBackorders
         ) {
            throw new Error('Reserved quantity cannot exceed quantity')
         }

         const reservedQuantityChanged =
            body.reservedQuantity !== undefined &&
            body.reservedQuantity !== updatedInventory.reservedQuantity

         if (reservedQuantityChanged) {
            await tx.inventoryMovement.create({
               data: {
                  inventoryId: updatedInventory.id,
                  warehouseId: updatedInventory.warehouseId,
                  productId: updatedInventory.productId,
                  type: 'ADJUSTMENT',
                  quantity:
                     body.reservedQuantity - updatedInventory.reservedQuantity,
                  reason: body.reason || 'Reserved quantity adjusted',
                  reference: body.reference,
               },
            })
         }

         return tx.inventory.update({
            where: { id: params.inventoryId },
            data: {
               reservedQuantity: body.reservedQuantity,
               reorderPoint: body.reorderPoint,
               reorderQuantity: body.reorderQuantity,
            },
            include: {
               product: true,
               warehouse: true,
            },
         })
      })

      return NextResponse.json({
         ...inventory,
         availableQuantity: getAvailableQuantity(inventory),
      })
   } catch (error) {
      if (error instanceof z.ZodError) {
         return getErrorResponse(400, 'Invalid inventory data', error)
      }

      if (error instanceof Error) {
         return new NextResponse(error.message, { status: 400 })
      }

      console.error('[INVENTORY_PATCH]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
