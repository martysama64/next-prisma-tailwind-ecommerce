import { consumeReservationsForOrder } from '@/lib/inventory'
import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PATCH(
   req: Request,
   { params }: { params: { orderId: string } }
) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })
      if (!params.orderId) {
         return new NextResponse('Order id is required', { status: 400 })
      }

      const { status } = await req.json()

      const order = await prisma.$transaction(async (tx) => {
         const existingOrder = await tx.order.findUniqueOrThrow({
            where: { id: params.orderId },
         })

         if (status === 'Shipped' && existingOrder.status !== 'Shipped') {
            await consumeReservationsForOrder(tx, existingOrder.id)
         }

         return tx.order.update({
            where: { id: existingOrder.id },
            data: {
               status,
               isCompleted: status === 'Delivered',
            },
            include: {
               warehouse: true,
               reservations: true,
               orderItems: { include: { product: true } },
            },
         })
      })

      return NextResponse.json(order)
   } catch (error) {
      if (error instanceof Error) {
         return new NextResponse(error.message, { status: 400 })
      }

      console.error('[ORDER_PATCH]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
