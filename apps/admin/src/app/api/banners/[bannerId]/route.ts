import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const bannerSchema = z.object({
   label: z.string().min(1),
   image: z.string().min(1),
})

export async function GET(
   req: Request,
   { params }: { params: { bannerId: string } }
) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })
      if (!params.bannerId) {
         return new NextResponse('Banner id is required', { status: 400 })
      }

      const banner = await prisma.banner.findUnique({
         where: { id: params.bannerId },
      })

      return NextResponse.json(banner)
   } catch (error) {
      console.error('[BANNER_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function PATCH(
   req: Request,
   { params }: { params: { bannerId: string } }
) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })
      if (!params.bannerId) {
         return new NextResponse('Banner id is required', { status: 400 })
      }

      const body = bannerSchema.parse(await req.json())

      const banner = await prisma.banner.update({
         where: { id: params.bannerId },
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

      console.error('[BANNER_PATCH]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function DELETE(
   req: Request,
   { params }: { params: { bannerId: string } }
) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })
      if (!params.bannerId) {
         return new NextResponse('Banner id is required', { status: 400 })
      }

      const banner = await prisma.banner.delete({
         where: { id: params.bannerId },
      })

      return NextResponse.json(banner)
   } catch (error) {
      console.error('[BANNER_DELETE]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
