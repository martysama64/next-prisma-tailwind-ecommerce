import prisma from '@/lib/prisma'
import { getAvailableQuantity } from '@/lib/inventory'
import { NextResponse } from 'next/server'

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
