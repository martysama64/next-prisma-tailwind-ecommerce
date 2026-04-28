import prisma from '@/lib/prisma'
import { getAvailableQuantity } from '@/lib/inventory'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const inventoryCreateSchema = z.object({
   warehouseId: z.string().min(1),
   productId: z.string().min(1),
   quantity: z.coerce.number().int().nonnegative().default(0),
   reservedQuantity: z.coerce.number().int().nonnegative().default(0),
   reorderPoint: z.coerce.number().int().nonnegative().default(0),
   reorderQuantity: z.coerce.number().int().nonnegative().default(0),
   reason: z.string().optional(),
   reference: z.string().optional(),
})

export async function GET(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })

      const { searchParams } = new URL(req.url)
      const warehouseId = searchParams.get('warehouseId') || undefined
      const productId = searchParams.get('productId') || undefined
      const lowStock = searchParams.get('lowStock') === 'true'

      const inventory = await prisma.inventory.findMany({
         where: {
            warehouseId,
            productId,
         },
         include: {
            product: {
               include: {
                  brand: true,
                  categories: true,
               },
            },
            warehouse: true,
         },
         orderBy: [{ updatedAt: 'desc' }],
      })

      const filteredInventory = lowStock
         ? inventory.filter(
              (row) => getAvailableQuantity(row) <= row.reorderPoint
           )
         : inventory

      return NextResponse.json(filteredInventory)
   } catch (error) {
      console.error('[INVENTORY_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function POST(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })

      const body = inventoryCreateSchema.parse(await req.json())

      const inventory = await prisma.$transaction(async (tx) => {
         const existingInventory = await tx.inventory.findUnique({
            where: {
               warehouseId_productId: {
                  warehouseId: body.warehouseId,
                  productId: body.productId,
               },
            },
            select: { id: true },
         })

         if (existingInventory) {
            throw new Error('Inventory row already exists for this warehouse and product')
         }

         const product = await tx.product.findUniqueOrThrow({
            where: { id: body.productId },
            select: { allowBackorders: true },
         })

         if (body.reservedQuantity > body.quantity && !product.allowBackorders) {
            throw new Error('Reserved quantity cannot exceed quantity')
         }

         const inventory = await tx.inventory.create({
            data: {
               warehouseId: body.warehouseId,
               productId: body.productId,
               quantity: body.quantity,
               reservedQuantity: body.reservedQuantity,
               reorderPoint: body.reorderPoint,
               reorderQuantity: body.reorderQuantity,
            },
            include: {
               product: true,
               warehouse: true,
            },
         })

         if (body.quantity > 0) {
            await tx.inventoryMovement.create({
               data: {
                  inventoryId: inventory.id,
                  warehouseId: inventory.warehouseId,
                  productId: inventory.productId,
                  type: 'IN',
                  quantity: body.quantity,
                  reason: body.reason || 'Initial inventory row created',
                  reference: body.reference,
               },
            })
         }

         return inventory
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

      console.error('[INVENTORY_POST]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
