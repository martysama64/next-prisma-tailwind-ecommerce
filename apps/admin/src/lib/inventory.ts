import {
   Inventory,
   InventoryMovementType,
   InventoryReservationStatus,
   Prisma,
   Product,
   StockTransferStatus,
} from '@prisma/client'
import { z } from 'zod'

type InventoryTx = Prisma.TransactionClient

type CartItemForInventory = {
   productId: string
   count: number
   product?: Pick<Product, 'id' | 'trackInventory' | 'allowBackorders'>
}

type OrderForInventory = {
   id: string
}

export type InventoryAvailabilityStatus =
   | 'IN_STOCK'
   | 'OUT_OF_STOCK'
   | 'INCOMING'
   | 'BACKORDER'
   | 'NOT_TRACKED'

export const transferItemSchema = z.object({
   productId: z.string().min(1),
   quantity: z.coerce.number().int().positive(),
})

export const transferItemsSchema = z.array(transferItemSchema).min(1)

export const adjustInventorySchema = z.object({
   inventoryId: z.string().min(1),
   type: z.nativeEnum(InventoryMovementType),
   quantity: z.coerce.number().int().nonnegative(),
   reason: z.string().optional(),
   reference: z.string().optional(),
})

export const createStockTransferSchema = z.object({
   fromWarehouseId: z.string().min(1),
   toWarehouseId: z.string().min(1),
   items: transferItemsSchema,
   requestedBy: z.string().min(1),
   reason: z.string().optional(),
   reference: z.string().optional(),
})

export const updateStockTransferSchema = z.object({
   status: z.nativeEnum(StockTransferStatus).optional(),
   items: transferItemsSchema.optional(),
   approvedBy: z.string().min(1).optional(),
   reason: z.string().optional(),
   reference: z.string().optional(),
})

export type TransferItem = z.infer<typeof transferItemSchema>
export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>
export type CreateStockTransferInput = z.infer<typeof createStockTransferSchema>
export type UpdateStockTransferInput = z.infer<typeof updateStockTransferSchema>

export function getAvailableQuantity(
   inventory: Pick<Inventory, 'quantity' | 'reservedQuantity'>
) {
   return inventory.quantity - inventory.reservedQuantity
}

export function getInventoryAvailabilityStatus(
   product: Pick<Product, 'trackInventory' | 'allowBackorders'>,
   inventories: Pick<Inventory, 'quantity' | 'reservedQuantity'>[],
   incomingTransfers: { status: StockTransferStatus }[] = []
): InventoryAvailabilityStatus {
   if (!product.trackInventory) return 'NOT_TRACKED'

   const availableQuantity = inventories.reduce(
      (total, inventory) => total + getAvailableQuantity(inventory),
      0
   )

   if (availableQuantity > 0) return 'IN_STOCK'
   if (product.allowBackorders) return 'BACKORDER'

   const hasIncomingStock = incomingTransfers.some((transfer) =>
      ['PENDING', 'APPROVED'].includes(transfer.status)
   )

   return hasIncomingStock ? 'INCOMING' : 'OUT_OF_STOCK'
}

export function validateTransferItems(items: unknown): TransferItem[] {
   const parsedItems = transferItemsSchema.parse(items)
   const productIds = new Set<string>()

   for (const item of parsedItems) {
      if (productIds.has(item.productId)) {
         throw new Error(`Duplicate transfer item productId: ${item.productId}`)
      }

      productIds.add(item.productId)
   }

   return parsedItems
}

export async function selectWarehouseForOrder(
   tx: InventoryTx,
   cartItems: CartItemForInventory[],
   requestedWarehouseId?: string
) {
   if (!cartItems.length) throw new Error('Cart is empty')

   if (requestedWarehouseId) {
      const warehouse = await tx.warehouse.findFirst({
         where: { id: requestedWarehouseId, isActive: true },
      })

      if (!warehouse) throw new Error('Requested warehouse is not available')

      return warehouse
   }

   const products = await getProductsForCartItems(tx, cartItems)
   const warehouses = await tx.warehouse.findMany({
      where: { isActive: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      include: {
         inventories: {
            where: {
               productId: {
                  in: cartItems.map((item) => item.productId),
               },
            },
         },
      },
   })

   if (!warehouses.length) throw new Error('No active warehouse is available')

   for (const warehouse of warehouses) {
      const canFulfillCart = cartItems.every((item) => {
         const product = products.get(item.productId)
         if (!product?.trackInventory || product.allowBackorders) return true

         const inventory = warehouse.inventories.find(
            (row) => row.productId === item.productId
         )

         return inventory ? getAvailableQuantity(inventory) >= item.count : false
      })

      if (canFulfillCart) return warehouse
   }

   const allInsufficientItemsAllowBackorders = cartItems.every((item) => {
      const product = products.get(item.productId)
      return !product?.trackInventory || product.allowBackorders
   })

   if (allInsufficientItemsAllowBackorders) return warehouses[0]

   throw new Error('No warehouse can fulfill the cart')
}

export async function reserveStockForOrder(
   tx: InventoryTx,
   order: OrderForInventory,
   cartItems: CartItemForInventory[],
   warehouseId: string
) {
   const products = await getProductsForCartItems(tx, cartItems)

   for (const item of cartItems) {
      const product = products.get(item.productId)
      if (!product?.trackInventory) continue

      const inventory = await getOrCreateInventoryForReservation(
         tx,
         warehouseId,
         item.productId,
         product.allowBackorders
      )

      if (product.allowBackorders) {
         await tx.inventory.update({
            where: { id: inventory.id },
            data: { reservedQuantity: { increment: item.count } },
         })
      } else {
         const updatedRows = await reserveAvailableInventoryRow(
            tx,
            inventory.id,
            item.count
         )

         if (updatedRows !== 1) {
            throw new Error(`Insufficient stock for product ${item.productId}`)
         }
      }

      const reservation = await tx.inventoryReservation.create({
         data: {
            inventoryId: inventory.id,
            warehouseId,
            productId: item.productId,
            orderId: order.id,
            quantity: item.count,
            status: 'ACTIVE',
            expiresAt: getReservationExpirationDate(),
         },
      })

      await tx.inventoryMovement.create({
         data: {
            inventoryId: inventory.id,
            warehouseId,
            productId: item.productId,
            orderId: order.id,
            type: 'ADJUSTMENT',
            quantity: item.count,
            reason: 'Reservation created',
            reference: reservation.id,
         },
      })
   }
}

export async function releaseReservationsForOrder(
   tx: InventoryTx,
   orderId: string,
   releaseStatus: Extract<
      InventoryReservationStatus,
      'RELEASED' | 'EXPIRED'
   > = 'RELEASED'
) {
   const reservations = await tx.inventoryReservation.findMany({
      where: { orderId, status: 'ACTIVE' },
   })

   for (const reservation of reservations) {
      const updatedRows = await tx.inventory.updateMany({
         where: {
            id: reservation.inventoryId,
            reservedQuantity: { gte: reservation.quantity },
         },
         data: {
            reservedQuantity: { decrement: reservation.quantity },
         },
      })

      if (updatedRows.count !== 1) {
         throw new Error(`Reservation stock is inconsistent: ${reservation.id}`)
      }

      await tx.inventoryReservation.update({
         where: { id: reservation.id },
         data: { status: releaseStatus },
      })

      await tx.inventoryMovement.create({
         data: {
            inventoryId: reservation.inventoryId,
            warehouseId: reservation.warehouseId,
            productId: reservation.productId,
            orderId,
            type: 'ADJUSTMENT',
            quantity: -reservation.quantity,
            reason:
               releaseStatus === 'EXPIRED'
                  ? 'Reservation expired'
                  : 'Reservation released',
            reference: reservation.id,
         },
      })
   }

   return reservations.length
}

export async function consumeReservationsForOrder(
   tx: InventoryTx,
   orderId: string
) {
   const reservations = await tx.inventoryReservation.findMany({
      where: { orderId, status: 'ACTIVE' },
      include: { product: true },
   })

   for (const reservation of reservations) {
      if (reservation.product.allowBackorders) {
         await tx.inventory.update({
            where: { id: reservation.inventoryId },
            data: {
               reservedQuantity: { decrement: reservation.quantity },
               quantity: { decrement: reservation.quantity },
            },
         })
      } else {
         const updatedRows = await consumeInventoryRow(
            tx,
            reservation.inventoryId,
            reservation.quantity
         )

         if (updatedRows !== 1) {
            throw new Error(`Cannot consume reservation ${reservation.id}`)
         }
      }

      await tx.inventoryReservation.update({
         where: { id: reservation.id },
         data: { status: 'CONSUMED' },
      })

      await tx.inventoryMovement.create({
         data: {
            inventoryId: reservation.inventoryId,
            warehouseId: reservation.warehouseId,
            productId: reservation.productId,
            orderId,
            type: 'OUT',
            quantity: -reservation.quantity,
            reason: 'Order shipped',
            reference: reservation.id,
         },
      })

      await notifyLowStockIfNeeded(tx, reservation.inventoryId)
   }

   return reservations.length
}

export async function expireReservations(tx: InventoryTx) {
   const expiredReservations = await tx.inventoryReservation.findMany({
      where: {
         status: 'ACTIVE',
         expiresAt: { lt: new Date() },
      },
      select: { orderId: true },
      distinct: ['orderId'],
   })

   let expiredCount = 0

   for (const reservation of expiredReservations) {
      expiredCount += await releaseReservationsForOrder(
         tx,
         reservation.orderId,
         'EXPIRED'
      )

      await tx.order.updateMany({
         where: {
            id: reservation.orderId,
            isPaid: false,
         },
         data: { status: 'Cancelled' },
      })
   }

   return expiredCount
}

export async function adjustInventory(
   tx: InventoryTx,
   input: AdjustInventoryInput
) {
   const data = adjustInventorySchema.parse(input)
   const inventory = await tx.inventory.findUniqueOrThrow({
      where: { id: data.inventoryId },
      include: { product: true },
   })

   const nextQuantity = getAdjustedQuantity(inventory.quantity, data)

   if (nextQuantity < 0 && !inventory.product.allowBackorders) {
      throw new Error('Inventory quantity cannot become negative')
   }

   if (
      nextQuantity < inventory.reservedQuantity &&
      !inventory.product.allowBackorders
   ) {
      throw new Error('Inventory quantity cannot be lower than reserved stock')
   }

   const updatedInventory = await tx.inventory.update({
      where: { id: inventory.id },
      data: { quantity: nextQuantity },
   })

   await tx.inventoryMovement.create({
      data: {
         inventoryId: inventory.id,
         warehouseId: inventory.warehouseId,
         productId: inventory.productId,
         type: data.type,
         quantity: nextQuantity - inventory.quantity,
         reason: data.reason,
         reference: data.reference,
      },
   })

   await notifyLowStockIfNeeded(tx, inventory.id)

   return updatedInventory
}

export async function createStockTransfer(
   tx: InventoryTx,
   input: CreateStockTransferInput
) {
   const data = createStockTransferSchema.parse(input)
   const items = validateTransferItems(data.items)

   if (data.fromWarehouseId === data.toWarehouseId) {
      throw new Error('Transfer warehouses must be different')
   }

   await validateActiveTransferWarehouses(
      tx,
      data.fromWarehouseId,
      data.toWarehouseId
   )

   await validateTransferProducts(tx, items)

   return tx.stockTransfer.create({
      data: {
         fromWarehouseId: data.fromWarehouseId,
         toWarehouseId: data.toWarehouseId,
         items,
         requestedBy: data.requestedBy,
         reason: data.reason,
         reference: data.reference,
      },
   })
}

export async function updateStockTransfer(
   tx: InventoryTx,
   transferId: string,
   input: UpdateStockTransferInput
) {
   const data = updateStockTransferSchema.parse(input)
   const transfer = await tx.stockTransfer.findUniqueOrThrow({
      where: { id: transferId },
   })

   if (transfer.status === 'COMPLETED') {
      throw new Error('Completed transfers cannot be modified')
   }

   if (data.items) {
      validateTransferItems(data.items)
   }

   if (data.status === 'COMPLETED') {
      return completeStockTransfer(tx, transferId)
   }

   return tx.stockTransfer.update({
      where: { id: transferId },
      data: {
         status: data.status,
         items: data.items,
         approvedBy: data.approvedBy,
         approvedAt:
            data.status === 'APPROVED' && transfer.status !== 'APPROVED'
               ? new Date()
               : undefined,
         cancelledAt: data.status === 'CANCELLED' ? new Date() : undefined,
         reason: data.reason,
         reference: data.reference,
      },
   })
}

export async function completeStockTransfer(
   tx: InventoryTx,
   transferId: string
) {
   const transfer = await tx.stockTransfer.findUniqueOrThrow({
      where: { id: transferId },
      include: {
         fromWarehouse: true,
         toWarehouse: true,
      },
   })

   if (transfer.status === 'COMPLETED') return transfer
   if (transfer.status === 'CANCELLED') {
      throw new Error('Cancelled transfers cannot be completed')
   }
   if (!transfer.fromWarehouse.isActive || !transfer.toWarehouse.isActive) {
      throw new Error('Transfer warehouses must be active')
   }

   const items = validateTransferItems(transfer.items)
   await validateTransferProducts(tx, items)

   for (const item of items) {
      const product = await tx.product.findUniqueOrThrow({
         where: { id: item.productId },
         select: { allowBackorders: true },
      })

      const sourceInventory = await tx.inventory.findUnique({
         where: {
            warehouseId_productId: {
               warehouseId: transfer.fromWarehouseId,
               productId: item.productId,
            },
         },
      })

      if (!sourceInventory) {
         throw new Error(`Source inventory not found for ${item.productId}`)
      }

      if (product.allowBackorders) {
         await tx.inventory.update({
            where: { id: sourceInventory.id },
            data: { quantity: { decrement: item.quantity } },
         })
      } else {
         const updatedRows = await transferOutInventoryRow(
            tx,
            sourceInventory.id,
            item.quantity
         )

         if (updatedRows !== 1) {
            throw new Error(`Insufficient transfer stock for ${item.productId}`)
         }
      }

      const destinationInventory = await tx.inventory.upsert({
         where: {
            warehouseId_productId: {
               warehouseId: transfer.toWarehouseId,
               productId: item.productId,
            },
         },
         create: {
            warehouseId: transfer.toWarehouseId,
            productId: item.productId,
            quantity: item.quantity,
            reservedQuantity: 0,
            reorderPoint: 0,
            reorderQuantity: 0,
         },
         update: {
            quantity: { increment: item.quantity },
         },
      })

      await tx.inventoryMovement.createMany({
         data: [
            {
               inventoryId: sourceInventory.id,
               warehouseId: transfer.fromWarehouseId,
               productId: item.productId,
               transferId: transfer.id,
               type: 'TRANSFER',
               quantity: -item.quantity,
               reason: 'Transfer out',
               reference: transfer.reference,
            },
            {
               inventoryId: destinationInventory.id,
               warehouseId: transfer.toWarehouseId,
               productId: item.productId,
               transferId: transfer.id,
               type: 'TRANSFER',
               quantity: item.quantity,
               reason: 'Transfer in',
               reference: transfer.reference,
            },
         ],
      })

      await notifyLowStockIfNeeded(tx, sourceInventory.id)
   }

   return tx.stockTransfer.update({
      where: { id: transfer.id },
      data: {
         status: 'COMPLETED',
         completedAt: new Date(),
      },
   })
}

export async function notifyLowStockIfNeeded(
   tx: InventoryTx,
   inventoryId: string
) {
   const inventory = await tx.inventory.findUnique({
      where: { id: inventoryId },
      select: {
         quantity: true,
         reservedQuantity: true,
         reorderPoint: true,
      },
   })

   if (!inventory) return false

   const isLowStock = getAvailableQuantity(inventory) <= inventory.reorderPoint

   if (!isLowStock) return false

   return queueLowStockNotificationPlaceholder(inventoryId)
}

export async function queueLowStockNotificationPlaceholder(_inventoryId: string) {
   return true
}

async function getProductsForCartItems(
   tx: InventoryTx,
   cartItems: CartItemForInventory[]
) {
   const providedProducts = cartItems
      .map((item) => item.product)
      .filter(Boolean) as Pick<
      Product,
      'id' | 'trackInventory' | 'allowBackorders'
   >[]

   const products = new Map(
      providedProducts.map((product) => [product.id, product])
   )

   const missingProductIds = cartItems
      .map((item) => item.productId)
      .filter((productId) => !products.has(productId))

   if (missingProductIds.length) {
      const dbProducts = await tx.product.findMany({
         where: { id: { in: missingProductIds } },
         select: {
            id: true,
            trackInventory: true,
            allowBackorders: true,
         },
      })

      for (const product of dbProducts) {
         products.set(product.id, product)
      }
   }

   return products
}

async function getOrCreateInventoryForReservation(
   tx: InventoryTx,
   warehouseId: string,
   productId: string,
   allowBackorders: boolean
) {
   const inventory = await tx.inventory.findUnique({
      where: {
         warehouseId_productId: {
            warehouseId,
            productId,
         },
      },
   })

   if (inventory) return inventory
   if (!allowBackorders) throw new Error(`Inventory not found for ${productId}`)

   return tx.inventory.create({
      data: {
         warehouseId,
         productId,
         quantity: 0,
         reservedQuantity: 0,
         reorderPoint: 0,
         reorderQuantity: 0,
      },
   })
}

async function reserveAvailableInventoryRow(
   tx: InventoryTx,
   inventoryId: string,
   quantity: number
) {
   return tx.$executeRaw`
      UPDATE "Inventory"
      SET "reservedQuantity" = "reservedQuantity" + ${quantity}, "updatedAt" = NOW()
      WHERE "id" = ${inventoryId}
      AND ("quantity" - "reservedQuantity") >= ${quantity}
   `
}

async function consumeInventoryRow(
   tx: InventoryTx,
   inventoryId: string,
   quantity: number
) {
   return tx.$executeRaw`
      UPDATE "Inventory"
      SET "reservedQuantity" = "reservedQuantity" - ${quantity},
          "quantity" = "quantity" - ${quantity},
          "updatedAt" = NOW()
      WHERE "id" = ${inventoryId}
      AND "reservedQuantity" >= ${quantity}
      AND "quantity" >= ${quantity}
   `
}

async function transferOutInventoryRow(
   tx: InventoryTx,
   inventoryId: string,
   quantity: number
) {
   return tx.$executeRaw`
      UPDATE "Inventory"
      SET "quantity" = "quantity" - ${quantity}, "updatedAt" = NOW()
      WHERE "id" = ${inventoryId}
      AND ("quantity" - "reservedQuantity") >= ${quantity}
   `
}

function getReservationExpirationDate() {
   const expiresAt = new Date()
   expiresAt.setHours(expiresAt.getHours() + 24)
   return expiresAt
}

function getAdjustedQuantity(
   currentQuantity: number,
   input: AdjustInventoryInput
) {
   switch (input.type) {
      case 'IN':
         return currentQuantity + input.quantity
      case 'OUT':
         return currentQuantity - input.quantity
      case 'ADJUSTMENT':
         return input.quantity
      default:
         throw new Error(`Unsupported adjustment type: ${input.type}`)
   }
}

async function validateActiveTransferWarehouses(
   tx: InventoryTx,
   fromWarehouseId: string,
   toWarehouseId: string
) {
   const warehouses = await tx.warehouse.findMany({
      where: {
         id: { in: [fromWarehouseId, toWarehouseId] },
         isActive: true,
      },
      select: { id: true },
   })

   if (warehouses.length !== 2) {
      throw new Error('Source and destination warehouses must be active')
   }
}

async function validateTransferProducts(
   tx: InventoryTx,
   items: TransferItem[]
) {
   const products = await tx.product.findMany({
      where: {
         id: { in: items.map((item) => item.productId) },
      },
      select: { id: true },
   })

   if (products.length !== items.length) {
      throw new Error('One or more transfer products do not exist')
   }
}
