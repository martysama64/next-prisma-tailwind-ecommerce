import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const warehousePatchSchema = z.object({
   name: z.string().min(1).optional(),
   location: z.string().min(1).optional(),
   address: z.string().min(1).optional(),
   isActive: z.boolean().optional(),
   contactPhone: z.string().nullable().optional(),
   contactEmail: z.string().email().nullable().optional().or(z.literal('')),
   code: z.string().min(1).nullable().optional(),
   priority: z.coerce.number().int().optional(),
})

export async function PATCH(
   req: Request,
   { params }: { params: { warehouseId: string } }
) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })
      if (!params.warehouseId) {
         return new NextResponse('Warehouse id is required', { status: 400 })
      }

      const body = warehousePatchSchema.parse(await req.json())

      const warehouse = await prisma.warehouse.update({
         where: { id: params.warehouseId },
         data: {
            ...body,
            contactPhone:
               body.contactPhone === undefined ? undefined : body.contactPhone || null,
            contactEmail:
               body.contactEmail === undefined ? undefined : body.contactEmail || null,
            code: body.code === undefined ? undefined : body.code || null,
         },
      })

      return NextResponse.json(warehouse)
   } catch (error) {
      if (error instanceof z.ZodError) {
         return getErrorResponse(400, 'Invalid warehouse data', error)
      }

      console.error('[WAREHOUSE_PATCH]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function DELETE(
   req: Request,
   { params }: { params: { warehouseId: string } }
) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })
      if (!params.warehouseId) {
         return new NextResponse('Warehouse id is required', { status: 400 })
      }

      const warehouse = await prisma.warehouse.update({
         where: { id: params.warehouseId },
         data: { isActive: false },
      })

      return NextResponse.json(warehouse)
   } catch (error) {
      console.error('[WAREHOUSE_DELETE]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
