import prisma from '@/lib/prisma'

import { ProductForm } from './components/product-form'

export default async function ProductPage({
   params,
}: {
   params: { productId: string }
}) {
   const product = await prisma.product.findUnique({
      where: {
         id: params.productId,
      },
      include: {
         categories: true,
         brand: true,
      },
   })

   const categories = await prisma.category.findMany()
   const brands = await prisma.brand.findMany({ orderBy: { title: 'asc' } })
   const warehouses = await prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
   })

   return (
      <div className="flex-col">
         <div className="flex-1 space-y-4 pt-6 pb-12">
            <ProductForm
               categories={categories}
               brands={brands}
               warehouses={warehouses}
               initialData={product}
            />
         </div>
      </div>
   )
}
