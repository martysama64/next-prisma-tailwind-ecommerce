import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const productSchema = z.object({
   title: z.string().min(1),
   images: z.array(z.string()).default([]),
   price: z.coerce.number().min(1),
   discount: z.coerce.number().min(0),
   stock: z.coerce.number().int().min(0),
   categoryId: z.string().min(1),
   isFeatured: z.boolean().optional().default(false),
   isAvailable: z.boolean().optional().default(false),
   trackInventory: z.boolean().optional().default(true),
   allowBackorders: z.boolean().optional().default(false),
})

export async function POST(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      const data = productSchema.parse(await req.json())

      const product = await prisma.product.create({
         data: {
            title: data.title,
            images: data.images,
            price: data.price,
            discount: data.discount,
            stock: data.stock,
            isFeatured: data.isFeatured,
            isAvailable: data.isAvailable,
            trackInventory: data.trackInventory,
            allowBackorders: data.allowBackorders,
            keywords: [],
            categories: {
               connect: { id: data.categoryId },
            },
            brand: {
               connectOrCreate: {
                  where: { title: 'Default Brand' },
                  create: { title: 'Default Brand' },
               },
            },
         },
      })

      return NextResponse.json(product)
   } catch (error) {
      if (error instanceof z.ZodError) {
         return getErrorResponse(400, 'Invalid product data', error)
      }

      console.error('[PRODUCTS_POST]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function GET(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      const { searchParams } = new URL(req.url)
      const categoryId = searchParams.get('categoryId') || undefined
      const isFeatured = searchParams.get('isFeatured')

      const products = await prisma.product.findMany()

      return NextResponse.json(products)
   } catch (error) {
      console.error('[PRODUCTS_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
