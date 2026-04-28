import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const productPatchSchema = z.object({
   title: z.string().min(1),
   images: z.array(z.string()).default([]),
   price: z.coerce.number().min(1),
   discount: z.coerce.number().min(0),
   stock: z.coerce.number().int().min(0),
   categoryId: z.string().min(1),
   brandId: z.string().min(1),
   isFeatured: z.boolean().optional().default(false),
   isAvailable: z.boolean().optional().default(false),
   trackInventory: z.boolean().optional().default(true),
   allowBackorders: z.boolean().optional().default(false),
})

export async function GET(
   req: Request,
   { params }: { params: { productId: string } }
) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      if (!params.productId) {
         return new NextResponse('Product id is required', { status: 400 })
      }

      const product = await prisma.product.findUniqueOrThrow({
         where: {
            id: params.productId,
         },
      })

      return NextResponse.json(product)
   } catch (error) {
      console.error('[PRODUCT_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function DELETE(
   req: Request,
   { params }: { params: { productId: string } }
) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      const product = await prisma.product.delete({
         where: {
            id: params.productId,
         },
      })

      return NextResponse.json(product)
   } catch (error) {
      console.error('[PRODUCT_DELETE]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function PATCH(
   req: Request,
   { params }: { params: { productId: string } }
) {
   try {
      if (!params.productId) {
         return new NextResponse('Product Id is required', { status: 400 })
      }

      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      const data = productPatchSchema.parse(await req.json())

      const product = await prisma.product.update({
         where: {
            id: params.productId,
         },
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
            categories: {
               set: [{ id: data.categoryId }],
            },
            brand: {
               connect: { id: data.brandId },
            },
         },
      })

      return NextResponse.json(product)
   } catch (error) {
      if (error instanceof z.ZodError) {
         return getErrorResponse(400, 'Invalid product data', error)
      }

      console.error('[PRODUCT_PATCH]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
