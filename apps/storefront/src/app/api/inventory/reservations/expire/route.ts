import { expireReservations } from '@/lib/inventory'
import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')
      const cronSecret = req.headers.get('X-CRON-SECRET')
      const expectedCronSecret = process.env.CRON_SECRET

      if (!userId && (!expectedCronSecret || cronSecret !== expectedCronSecret)) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      const expiredCount = await prisma.$transaction(async (tx) => {
         return expireReservations(tx)
      })

      return NextResponse.json({
         expiredCount,
      })
   } catch (error) {
      console.error('[INVENTORY_RESERVATIONS_EXPIRE_POST]', error)

      if (error instanceof Error) {
         return new NextResponse(error.message, { status: 400 })
      }

      return new NextResponse('Internal error', { status: 500 })
   }
}
