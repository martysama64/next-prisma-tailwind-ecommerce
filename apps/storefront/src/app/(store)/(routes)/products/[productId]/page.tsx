import Carousel from '@/components/native/Carousel'
import {
   getAvailableQuantity,
   getInventoryAvailabilityStatus,
   validateTransferItems,
} from '@/lib/inventory'
import prisma from '@/lib/prisma'
import { isVariableValid } from '@/lib/utils'
import { ChevronRightIcon } from 'lucide-react'
import type { Metadata, ResolvingMetadata } from 'next'
import Link from 'next/link'

import { DataSection } from './components/data'

type Props = {
   params: { productId: string }
   searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata(
   { params, searchParams }: Props,
   parent: ResolvingMetadata
): Promise<Metadata> {
   const product = await prisma.product.findUnique({
      where: {
         id: params.productId,
      },
   })

   if (!product) {
      return {
         title: 'Product not found',
      }
   }

   return {
      title: product.title,
      description: product.description,
      keywords: product.keywords,
      openGraph: {
         images: product.images,
      },
   }
}

export default async function Product({
   params,
}: {
   params: { productId: string }
}) {
   const product = await prisma.product.findUnique({
      where: {
         id: params.productId,
      },
      include: {
         brand: true,
         categories: true,
         inventories: {
            include: {
               warehouse: true,
            },
         },
      },
   })

   const incomingTransfers = await prisma.stockTransfer.findMany({
      where: {
         status: { in: ['PENDING', 'APPROVED'] },
         toWarehouse: { isActive: true },
      },
   })

   const productIncomingTransfers = incomingTransfers.filter((transfer) => {
      try {
         return validateTransferItems(transfer.items).some(
            (item) => item.productId === product?.id
         )
      } catch (error) {
         return false
      }
   })

   const productWithAvailability = product
      ? {
           ...product,
           availability: {
              status: getInventoryAvailabilityStatus(
                 product,
                 product.inventories,
                 productIncomingTransfers
              ),
              warehouses: product.inventories.map((inventory) => ({
                 warehouseId: inventory.warehouseId,
                 warehouseName: inventory.warehouse.name,
                 quantity: inventory.quantity,
                 reservedQuantity: inventory.reservedQuantity,
                 availableQuantity: getAvailableQuantity(inventory),
                 incoming: productIncomingTransfers.some(
                    (transfer) => transfer.toWarehouseId === inventory.warehouseId
                 ),
              })),
           },
        }
      : null

   if (isVariableValid(productWithAvailability)) {
      return (
         <>
            <Breadcrumbs product={productWithAvailability} />
            <div className="mt-6 grid grid-cols-1 gap-2 md:grid-cols-3">
               <ImageColumn product={productWithAvailability} />
               <DataSection product={productWithAvailability} />
            </div>
         </>
      )
   }
}

const ImageColumn = ({ product }) => {
   return (
      <div className="relative min-h-[50vh] w-full col-span-1">
         <Carousel images={product?.images} />
      </div>
   )
}

const Breadcrumbs = ({ product }) => {
   return (
      <nav className="flex text-muted-foreground" aria-label="Breadcrumb">
         <ol className="inline-flex items-center gap-2">
            <li className="inline-flex items-center">
               <Link
                  href="/"
                  className="inline-flex items-center text-sm font-medium"
               >
                  Home
               </Link>
            </li>
            <li>
               <div className="flex items-center gap-2">
                  <ChevronRightIcon className="h-4" />
                  <Link className="text-sm font-medium" href="/products">
                     Products
                  </Link>
               </div>
            </li>
            <li aria-current="page">
               <div className="flex items-center gap-2">
                  <ChevronRightIcon className="h-4" />
                  <span className="text-sm font-medium">{product?.title}</span>
               </div>
            </li>
         </ol>
      </nav>
   )
}
