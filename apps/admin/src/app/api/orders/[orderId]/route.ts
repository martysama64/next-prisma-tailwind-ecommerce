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

      const body = await req.json()
      const status = body.status

      if (!status) {
         return new NextResponse('Status is required', { status: 400 })
      }

      const order = await prisma.$transaction(async (tx) => {
         const currentOrder = await tx.order.findUniqueOrThrow({
            where: { id: params.orderId },
            select: { id: true, status: true },
         })

         if (status === 'Shipped' && currentOrder.status !== 'Shipped') {
            await consumeReservationsForOrder(tx, params.orderId)
         }

         return tx.order.update({
            where: { id: params.orderId },
            data: {
               status,
               isCompleted: status === 'Shipped' ? true : body.isCompleted,
               isPaid: body.isPaid,
               shipping: body.shipping,
               payable: body.payable,
               discount: body.discount,
            },
            include: {
               orderItems: { include: { product: true } },
               warehouse: true,
            },
         })
      })

      return NextResponse.json(order)
   } catch (error) {
      if (
         error instanceof Error &&
         (error.message.includes('Cannot consume reservation') ||
            error.message.includes('Reservation stock is inconsistent'))
      ) {
         return NextResponse.json(
            { error: 'INSUFFICIENT_STOCK', message: error.message },
            { status: 409 }
         )
      }

      if (error instanceof Error) {
         console.error('[ORDER_PATCH]', error)
         return new NextResponse(error.message, { status: 400 })
      }

      console.error('[ORDER_PATCH]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
