import { Heading } from '@/components/ui/heading'
import { Separator } from '@/components/ui/separator'
import prisma from '@/lib/prisma'
import Link from 'next/link'

export default async function InventoryMovementsPage({ searchParams }) {
   const movements = await prisma.inventoryMovement.findMany({
      where: {
         type: searchParams?.type || undefined,
         warehouseId: searchParams?.warehouseId || undefined,
         productId: searchParams?.productId || undefined,
         createdAt:
            searchParams?.fromDate || searchParams?.toDate
               ? {
                    gte: searchParams?.fromDate
                       ? new Date(searchParams.fromDate)
                       : undefined,
                    lte: searchParams?.toDate
                       ? new Date(searchParams.toDate)
                       : undefined,
                 }
               : undefined,
      },
      include: { product: true, warehouse: true, transfer: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
   })
   const [warehouses, products] = await Promise.all([
      prisma.warehouse.findMany({ orderBy: { name: 'asc' } }),
      prisma.product.findMany({ orderBy: { title: 'asc' } }),
   ])

   return (
      <div className="block space-y-4 my-6">
         <Heading
            title="Inventory movements"
            description="Audit trail for stock changes"
         />
         <Separator />
         <form className="grid gap-2 md:grid-cols-5">
            <select
               name="type"
               defaultValue={searchParams?.type || ''}
               className="rounded-md border bg-background p-2 text-sm"
            >
               <option value="">All types</option>
               <option value="IN">IN</option>
               <option value="OUT">OUT</option>
               <option value="ADJUSTMENT">ADJUSTMENT</option>
               <option value="TRANSFER">TRANSFER</option>
            </select>
            <select
               name="warehouseId"
               defaultValue={searchParams?.warehouseId || ''}
               className="rounded-md border bg-background p-2 text-sm"
            >
               <option value="">All warehouses</option>
               {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                     {warehouse.name}
                  </option>
               ))}
            </select>
            <select
               name="productId"
               defaultValue={searchParams?.productId || ''}
               className="rounded-md border bg-background p-2 text-sm"
            >
               <option value="">All products</option>
               {products.map((product) => (
                  <option key={product.id} value={product.id}>
                     {product.title}
                  </option>
               ))}
            </select>
            <input
               name="fromDate"
               type="date"
               defaultValue={searchParams?.fromDate || ''}
               className="rounded-md border bg-background p-2 text-sm"
            />
            <input
               name="toDate"
               type="date"
               defaultValue={searchParams?.toDate || ''}
               className="rounded-md border bg-background p-2 text-sm"
            />
            <button className="rounded-md border p-2 text-sm">Filter</button>
            <Link
               className="rounded-md border p-2 text-center text-sm"
               href="/inventory/movements"
            >
               Clear
            </Link>
         </form>
         <div className="rounded-md border">
            <table className="w-full text-sm">
               <thead>
                  <tr className="border-b text-left">
                     <th className="p-3">Date</th>
                     <th className="p-3">Type</th>
                     <th className="p-3">Product</th>
                     <th className="p-3">Warehouse</th>
                     <th className="p-3">Quantity</th>
                     <th className="p-3">Reason</th>
                     <th className="p-3">Reference</th>
                  </tr>
               </thead>
               <tbody>
                  {movements.map((movement) => (
                     <tr key={movement.id} className="border-b">
                        <td className="p-3">
                           {movement.createdAt.toUTCString()}
                        </td>
                        <td className="p-3">{movement.type}</td>
                        <td className="p-3">{movement.product?.title}</td>
                        <td className="p-3">{movement.warehouse?.name}</td>
                        <td className="p-3">{movement.quantity}</td>
                        <td className="p-3">{movement.reason}</td>
                        <td className="p-3">{movement.reference}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
   )
}
