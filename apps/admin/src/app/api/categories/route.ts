import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const categorySchema = z.object({
   title: z.string().min(1),
   description: z.string().optional(),
   bannerId: z.string().min(1),
})

export async function POST(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      const { title, description, bannerId } = categorySchema.parse(
         await req.json()
      )

      // Create a new category
      const category = await prisma.category.create({
         data: {
            title,
            description,
            banners: {
               connect: {
                  id: bannerId,
               },
            },
         },
      })

      return NextResponse.json(category)
   } catch (error) {
      if (error instanceof z.ZodError) {
         return getErrorResponse(400, 'Invalid category data', error)
      }

      console.error('[CATEGORIES_POST]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function GET(req: Request) {
   try {
      // Find all categories
      const categories = await prisma.category.findMany()

      return NextResponse.json(categories)
   } catch (error) {
      console.error('[CATEGORIES_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
