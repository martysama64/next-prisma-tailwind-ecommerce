import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const categorySchema = z.object({
   title: z.string().min(1),
   description: z.string().optional(),
   bannerId: z.string().min(1),
})

export async function GET(
   req: Request,
   { params }: { params: { categoryId: string } }
) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      if (!params.categoryId) {
         return new NextResponse('Category id is required', { status: 400 })
      }

      const category = await prisma.category.findUnique({
         where: {
            id: params.categoryId,
         },
      })

      return NextResponse.json(category)
   } catch (error) {
      console.error('[CATEGORY_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function DELETE(
   req: Request,
   { params }: { params: { categoryId: string } }
) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      if (!params.categoryId) {
         return new NextResponse('Category id is required', { status: 400 })
      }

      const category = await prisma.category.delete({
         where: {
            id: params.categoryId,
         },
      })

      return NextResponse.json(category)
   } catch (error) {
      console.error('[CATEGORY_DELETE]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function PATCH(
   req: Request,
   { params }: { params: { categoryId: string } }
) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      const { title, description, bannerId } = categorySchema.parse(
         await req.json()
      )

      if (!params.categoryId) {
         return new NextResponse('Category id is required', { status: 400 })
      }

      const updatedCategory = await prisma.category.update({
         where: {
            id: params.categoryId,
         },
         data: {
            title,
            description,
            banners: {
               set: {
                  id: bannerId,
               },
            },
         },
      })

      return NextResponse.json(updatedCategory)
   } catch (error) {
      if (error instanceof z.ZodError) {
         return getErrorResponse(400, 'Invalid category data', error)
      }

      console.error('[CATEGORY_PATCH]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
