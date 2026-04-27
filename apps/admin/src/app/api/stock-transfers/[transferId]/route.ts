import { updateStockTransfer, updateStockTransferSchema } from '@/lib/inventory'
import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export async function PATCH(
   req: Request,
   { params }: { params: { transferId: string } }
) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })
      if (!params.transferId) {
         return new NextResponse('Transfer id is required', { status: 400 })
      }

      const body = await req.json()
      const input = updateStockTransferSchema.parse({
         ...body,
         approvedBy: body.status === 'APPROVED' ? userId : body.approvedBy,
      })

      const transfer = await prisma.$transaction((tx) =>
         updateStockTransfer(tx, params.transferId, input)
      )

      return NextResponse.json(transfer)
   } catch (error) {
      if (error instanceof z.ZodError) {
         return getErrorResponse(400, 'Invalid stock transfer data', error)
      }

      if (error instanceof Error) {
         return new NextResponse(error.message, { status: 400 })
      }

      console.error('[STOCK_TRANSFER_PATCH]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
