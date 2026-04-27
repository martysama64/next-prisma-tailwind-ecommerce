import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const warehouseSchema = z.object({
   name: z.string().min(1),
   location: z.string().min(1),
   address: z.string().min(1),
   isActive: z.boolean().optional(),
   contactPhone: z.string().nullable().optional(),
   contactEmail: z.string().email().nullable().optional().or(z.literal('')),
   code: z.string().min(1).nullable().optional(),
   priority: z.coerce.number().int().optional(),
})

export async function GET(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })

      const { searchParams } = new URL(req.url)
      const isActive = searchParams.get('isActive')

      const warehouses = await prisma.warehouse.findMany({
         where: {
            isActive: isActive ? isActive === 'true' : undefined,
         },
         include: {
            inventories: true,
         },
         orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      })

      return NextResponse.json(warehouses)
   } catch (error) {
      console.error('[WAREHOUSES_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function POST(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) return new NextResponse('Unauthorized', { status: 401 })

      const body = warehouseSchema.parse(await req.json())

      const warehouse = await prisma.warehouse.create({
         data: {
            name: body.name,
            location: body.location,
            address: body.address,
            isActive: body.isActive ?? true,
            contactPhone: body.contactPhone || null,
            contactEmail: body.contactEmail || null,
            code: body.code || null,
            priority: body.priority ?? 0,
         },
      })

      return NextResponse.json(warehouse)
   } catch (error) {
      if (error instanceof z.ZodError) {
         return getErrorResponse(400, 'Invalid warehouse data', error)
      }

      console.error('[WAREHOUSES_POST]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
