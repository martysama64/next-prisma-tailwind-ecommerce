import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const bannerSchema = z.object({
   label: z.string().min(1),
   image: z.string().min(1),
})

export async function GET(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })

      const banners = await prisma.banner.findMany({
         orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json(banners)
   } catch (error) {
      console.error('[BANNERS_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function POST(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })

      const body = bannerSchema.parse(await req.json())

      const banner = await prisma.banner.create({
         data: {
            label: body.label,
            image: body.image,
         },
      })

      return NextResponse.json(banner)
   } catch (error) {
      if (error instanceof z.ZodError) {
         return getErrorResponse(400, 'Invalid banner data', error)
      }

      console.error('[BANNERS_POST]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
