import { createStockTransfer, createStockTransferSchema } from '@/lib/inventory'
import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export async function GET(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })

      const { searchParams } = new URL(req.url)
      const status = searchParams.get('status') || undefined
      const fromWarehouseId = searchParams.get('fromWarehouseId') || undefined
      const toWarehouseId = searchParams.get('toWarehouseId') || undefined

      const transfers = await prisma.stockTransfer.findMany({
         where: {
            status: status as any,
            fromWarehouseId,
            toWarehouseId,
         },
         include: {
            fromWarehouse: true,
            toWarehouse: true,
            movements: true,
         },
         orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json(transfers)
   } catch (error) {
      console.error('[STOCK_TRANSFERS_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function POST(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })

      const body = createStockTransferSchema.parse({
         ...(await req.json()),
         requestedBy: userId,
      })

      const transfer = await prisma.$transaction((tx) =>
         createStockTransfer(tx, body)
      )

      return NextResponse.json(transfer)
   } catch (error) {
      if (error instanceof z.ZodError) {
         return getErrorResponse(400, 'Invalid stock transfer data', error)
      }

      if (error instanceof Error) {
         return new NextResponse(error.message, { status: 400 })
      }

      console.error('[STOCK_TRANSFERS_POST]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
