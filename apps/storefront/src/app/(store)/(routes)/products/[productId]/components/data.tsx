import { Separator } from '@/components/native/separator'
import { Badge } from '@/components/ui/badge'
import type { ProductWithIncludes } from '@/types/prisma'
import Link from 'next/link'

import CartButton from './cart_button'
import WishlistButton from './wishlist_button'

export const DataSection = async ({
   product,
}: {
   product: ProductWithIncludes & { availability?: any }
}) => {
   function Price() {
      if (product?.discount > 0) {
         const price = product?.price - product?.discount
         const percentage = (product?.discount / product?.price) * 100
         return (
            <div className="flex gap-2 items-center">
               <Badge className="flex gap-4" variant="destructive">
                  <div className="line-through">${product?.price}</div>
                  <div>%{percentage.toFixed(2)}</div>
               </Badge>
               <h2 className="">${price.toFixed(2)}</h2>
            </div>
         )
      }

      return <h2>${product?.price}</h2>
   }

   return (
      <div className="col-span-2 w-full rounded-lg bg-neutral-100 p-6 dark:bg-neutral-900">
         <h3 className="mb-4 text-xl font-medium">{product.title}</h3>
         <Separator />
         <div className="flex gap-2 mb-2 items-center">
            <p className="text-sm">Brand:</p>
            <Link href={`/products?brand=${product?.brand?.title}`}>
               <Badge variant="outline">{product?.brand?.title}</Badge>
            </Link>
         </div>
         <div className="flex gap-2 items-center">
            <p className="text-sm">Categories:</p>
            {product.categories.map(({ title }, index) => (
               <Link key={index} href={`/products?categories=${title}`}>
                  <Badge variant="outline">{title}</Badge>
               </Link>
            ))}
         </div>
          <Separator />
          <small>{product.description}</small>

          {product?.availability && (
             <>
                <Separator />
                <div className="space-y-2">
                   <div className="flex items-center gap-2">
                      <p className="text-sm">Availability:</p>
                      <Badge variant="outline">
                         {formatAvailability(product.availability.status)}
                      </Badge>
                   </div>
                   <div className="space-y-1 text-sm text-muted-foreground">
                      {product.availability.warehouses.length > 0 ? (
                         product.availability.warehouses.map((warehouse) => (
                            <div
                               key={warehouse.warehouseId}
                               className="flex justify-between rounded-md border p-2"
                            >
                               <span>{warehouse.warehouseName}</span>
                               <span>
                                  {warehouse.availableQuantity > 0
                                     ? `${warehouse.availableQuantity} available`
                                     : warehouse.incoming
                                       ? 'Expected soon'
                                       : 'Out of stock'}
                               </span>
                            </div>
                         ))
                      ) : (
                         <p>No warehouse inventory is configured.</p>
                      )}
                   </div>
                </div>
             </>
          )}

          <Separator />
         <div className="block space-y-2">
            <Price />
            <div className="flex gap-2">
               <CartButton product={product} />
               <WishlistButton product={product} />
            </div>
         </div>
      </div>
   )
}

function formatAvailability(status) {
   switch (status) {
      case 'IN_STOCK':
         return 'In stock'
      case 'INCOMING':
         return 'Expected soon'
      case 'BACKORDER':
         return 'Available on backorder'
      case 'NOT_TRACKED':
         return 'Inventory not tracked'
      default:
         return 'Out of stock'
   }
}
