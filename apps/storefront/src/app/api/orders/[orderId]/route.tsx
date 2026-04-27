import { releaseReservationsForOrder } from '@/lib/inventory'
import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(
   req: Request,
   { params }: { params: { orderId: string } }
) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      if (!params.orderId) {
         return new NextResponse('orderId is required', { status: 400 })
      }

      const order = await prisma.order.findUniqueOrThrow({
         where: {
            userId,
            id: params.orderId,
         },
         include: {
            address: true,
            discountCode: true,
            user: true,
            payments: {
               include: {
                  provider: true,
               },
            },
            orderItems: {
               include: {
                  product: { include: { brand: true, categories: true } },
               },
            },
            refund: true,
         },
      })

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

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      if (!params.orderId) {
         return new NextResponse('orderId is required', { status: 400 })
      }

      const { status } = await req.json()

      if (status !== 'Cancelled') {
         return new NextResponse('Only cancellation is supported', {
            status: 400,
         })
      }

      const order = await prisma.$transaction(async (tx) => {
         const existingOrder = await tx.order.findFirstOrThrow({
            where: {
               id: params.orderId,
               userId,
            },
            include: {
               reservations: true,
            },
         })

         if (existingOrder.status === 'Shipped') {
            throw new Error('Shipped orders cannot be cancelled')
         }

         await releaseReservationsForOrder(tx, existingOrder.id, 'RELEASED')

         return tx.order.update({
            where: { id: existingOrder.id },
            data: {
               status: 'Cancelled',
               isCompleted: false,
            },
            include: {
               address: true,
               discountCode: true,
               user: true,
               warehouse: true,
               reservations: true,
               payments: {
                  include: {
                     provider: true,
                  },
               },
               orderItems: {
                  include: {
                     product: { include: { brand: true, categories: true } },
                  },
               },
               refund: true,
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
