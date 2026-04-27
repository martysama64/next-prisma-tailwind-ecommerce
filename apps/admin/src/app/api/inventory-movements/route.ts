import prisma from '@/lib/prisma'
import { InventoryMovementType } from '@prisma/client'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })

      const { searchParams } = new URL(req.url)
      const warehouseId = searchParams.get('warehouseId') || undefined
      const productId = searchParams.get('productId') || undefined
      const inventoryId = searchParams.get('inventoryId') || undefined
      const orderId = searchParams.get('orderId') || undefined
      const transferId = searchParams.get('transferId') || undefined
      const type = searchParams.get('type') as InventoryMovementType | null
      const fromDate = searchParams.get('fromDate')
      const toDate = searchParams.get('toDate')

      const movements = await prisma.inventoryMovement.findMany({
         where: {
            warehouseId,
            productId,
            inventoryId,
            orderId,
            transferId,
            type: type || undefined,
            createdAt:
               fromDate || toDate
                  ? {
                       gte: fromDate ? new Date(fromDate) : undefined,
                       lte: toDate ? new Date(toDate) : undefined,
                    }
                  : undefined,
         },
         include: {
            warehouse: true,
            product: true,
            inventory: true,
            order: true,
            transfer: true,
         },
         orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json(movements)
   } catch (error) {
      console.error('[INVENTORY_MOVEMENTS_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
