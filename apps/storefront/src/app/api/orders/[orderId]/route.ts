import { releaseReservationsForOrder } from '@/lib/inventory'
import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(
   req: Request,
   { params }: { params: { orderId: string } }
) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })

      const order = await prisma.order.findFirst({
         where: { id: params.orderId, userId },
         include: {
            address: true,
            warehouse: true,
            orderItems: {
               include: {
                  product: true,
               },
            },
         },
      })

      if (!order) return new NextResponse('Order not found', { status: 404 })

      return NextResponse.json(order)
   } catch (error) {
      console.error('[ORDER_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function PATCH(
   req: Request,
   { params }: { params: { orderId: string } }
) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })

      const body = await req.json()

      if (body.status !== 'Cancelled') {
         return new NextResponse('Only cancellation is supported', {
            status: 400,
         })
      }

      const order = await prisma.$transaction(async (tx) => {
         const currentOrder = await tx.order.findUnique({
            where: { id: params.orderId, userId },
            select: { id: true, status: true },
         })

         if (!currentOrder) {
            throw new Error('Order not found')
         }

         if (currentOrder.status !== 'Processing') {
            throw new Error('Only processing orders can be cancelled')
         }

         await releaseReservationsForOrder(tx, params.orderId, 'RELEASED')

         return tx.order.update({
            where: { id: params.orderId, userId },
            data: { status: 'Cancelled' },
         })
      })

      return NextResponse.json(order)
   } catch (error) {
      if (error instanceof Error) {
         return new NextResponse(error.message, { status: 400 })
      }

      return new NextResponse('Internal error', { status: 500 })
   }
}
