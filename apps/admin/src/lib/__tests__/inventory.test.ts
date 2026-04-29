import { describe, expect, test } from 'bun:test'
import {
   adjustInventory,
   completeStockTransfer,
   consumeReservationsForOrder,
   expireReservations,
   getAvailableQuantity,
   getInventoryAvailabilityStatus,
   notifyLowStockIfNeeded,
   releaseReservationsForOrder,
   reserveStockForOrder,
   selectWarehouseForOrder,
   validateTransferItems,
} from '../inventory'

describe('inventory helpers', () => {
   test('calculates available quantity', () => {
      expect(getAvailableQuantity({ quantity: 10, reservedQuantity: 3 })).toBe(7)
   })

   test('returns NOT_TRACKED for products without inventory tracking', () => {
      expect(
         getInventoryAvailabilityStatus(
            { trackInventory: false, allowBackorders: false },
            []
         )
      ).toBe('NOT_TRACKED')
   })

   test('returns IN_STOCK when available quantity is positive', () => {
      expect(
         getInventoryAvailabilityStatus(
            { trackInventory: true, allowBackorders: false },
            [{ quantity: 5, reservedQuantity: 2 }]
         )
      ).toBe('IN_STOCK')
   })

   test('returns BACKORDER when stock is unavailable but backorders are allowed', () => {
      expect(
         getInventoryAvailabilityStatus(
            { trackInventory: true, allowBackorders: true },
            [{ quantity: 0, reservedQuantity: 0 }]
         )
      ).toBe('BACKORDER')
   })

   test('returns OUT_OF_STOCK when no stock and no incoming transfers', () => {
      expect(
         getInventoryAvailabilityStatus(
            { trackInventory: true, allowBackorders: false },
            [{ quantity: 0, reservedQuantity: 0 }]
         )
      ).toBe('OUT_OF_STOCK')
   })

   test('returns INCOMING when stock is unavailable but transfer is pending', () => {
      expect(
         getInventoryAvailabilityStatus(
            { trackInventory: true, allowBackorders: false },
            [{ quantity: 0, reservedQuantity: 0 }],
            [{ status: 'PENDING' }]
         )
      ).toBe('INCOMING')
   })

   test('validates transfer items', () => {
      expect(
         validateTransferItems([
            { productId: 'product-1', quantity: 2 },
            { productId: 'product-2', quantity: 1 },
         ])
      ).toEqual([
         { productId: 'product-1', quantity: 2 },
         { productId: 'product-2', quantity: 1 },
      ])
   })

   test('rejects duplicate transfer products', () => {
      expect(() =>
         validateTransferItems([
            { productId: 'product-1', quantity: 2 },
            { productId: 'product-1', quantity: 1 },
         ])
      ).toThrow('Duplicate transfer item productId')
   })

   test('rejects negative transfer quantities', () => {
      expect(() =>
         validateTransferItems([{ productId: 'product-1', quantity: -1 }])
      ).toThrow()
   })

   test('selects availability statuses deterministically', () => {
      expect(
         getInventoryAvailabilityStatus(
            { trackInventory: true, allowBackorders: false },
            [{ quantity: 0, reservedQuantity: 0 }],
            [{ status: 'APPROVED' }]
         )
      ).toBe('INCOMING')
      expect(
         getInventoryAvailabilityStatus(
            { trackInventory: false, allowBackorders: true },
            []
         )
      ).toBe('NOT_TRACKED')
   })

   test('detects low stock from available quantity', async () => {
      const notified = await notifyLowStockIfNeeded(
         createLowStockTx({ availableQuantity: 1, reorderPoint: 2 }) as any,
         'inventory-1'
      )

      expect(notified).toBe(false)
   })

   test('does not detect low stock above reorder point', async () => {
      const notified = await notifyLowStockIfNeeded(
         createLowStockTx({ availableQuantity: 3, reorderPoint: 2 }) as any,
         'inventory-1'
      )

      expect(notified).toBe(false)
   })

   test('reserves stock and creates an active reservation', async () => {
      const calls: string[] = []
      const tx = createReserveTx({ rawResult: 1, calls })

      await reserveStockForOrder(
         tx as any,
         { id: 'order-1' },
         [{ productId: 'product-1', count: 2 }],
         'warehouse-1'
      )

      expect(calls).toContain('reservedQuantityIncremented')
      expect(calls).toContain('reservationCreated')
      expect(calls).toContain('reservationMovementCreated')
   })

   test('rejects reservation when stock is insufficient', async () => {
      const tx = createReserveTx({ rawResult: 0, calls: [] })

      await expect(
         reserveStockForOrder(
            tx as any,
            { id: 'order-1' },
            [{ productId: 'product-1', count: 20 }],
            'warehouse-1'
         )
      ).rejects.toThrow('Insufficient stock for product product-1')
   })

   test('allows backorder products to reserve without available stock', async () => {
      const calls: string[] = []
      const tx = createReserveTx({
         rawResult: 0,
         calls,
         allowBackorders: true,
         quantity: 0,
      })

      await reserveStockForOrder(
         tx as any,
         { id: 'order-1' },
         [{ productId: 'product-1', count: 2 }],
         'warehouse-1'
      )

      expect(calls).toContain('backorderReserved')
      expect(calls).not.toContain('reservedQuantityIncremented')
   })

   test('skips reservations for non-tracked products', async () => {
      const calls: string[] = []
      const tx = createReserveTx({ calls, trackInventory: false })

      await reserveStockForOrder(
         tx as any,
         { id: 'order-1' },
         [{ productId: 'product-1', count: 2 }],
         'warehouse-1'
      )

      expect(calls).not.toContain('reservationCreated')
      expect(calls).not.toContain('reservedQuantityIncremented')
   })

   test('selects a warehouse when the cart can be fulfilled', async () => {
      const warehouse = await selectWarehouseForOrder(
         createSelectWarehouseTx({ quantity: 5, reservedQuantity: 1 }) as any,
         [{ productId: 'product-1', count: 3 }]
      )

      expect(warehouse.id).toBe('warehouse-1')
   })

   test('throws clear insufficient stock behavior when no warehouse can fulfill', async () => {
      await expect(
         selectWarehouseForOrder(
            createSelectWarehouseTx({ quantity: 2, reservedQuantity: 0 }) as any,
            [{ productId: 'product-1', count: 3 }]
         )
      ).rejects.toThrow('No warehouse can fulfill the cart')
   })

   test('consumes active reservations when an order is shipped', async () => {
      const calls: any[] = []
      const tx = createConsumeReservationTx({ rawResult: 1, calls })

      const count = await consumeReservationsForOrder(tx as any, 'order-1')

      expect(count).toBe(1)
      expect(calls).toContain('executeRaw')
      expect(calls).toContain('reservationConsumed')
      expect(calls).toContain('movementCreated')
   })

   test('consume writes an OUT inventory movement', async () => {
      const movements: any[] = []
      const tx = createConsumeReservationTx({ rawResult: 1, calls: [], movements })

      await consumeReservationsForOrder(tx as any, 'order-1')

      expect(movements[0].data.type).toBe('OUT')
      expect(movements[0].data.quantity).toBe(-2)
   })

   test('rejects shipment when reserved stock cannot be consumed', async () => {
      const tx = createConsumeReservationTx({ rawResult: 0, calls: [] })

      await expect(
         consumeReservationsForOrder(tx as any, 'order-1')
      ).rejects.toThrow('Cannot consume reservation reservation-1')
   })

   test('releases active reservations when an order is cancelled', async () => {
      const calls: any[] = []
      const tx = createReleaseReservationTx({ calls })

      const count = await releaseReservationsForOrder(
         tx as any,
         'order-1',
         'RELEASED'
      )

      expect(count).toBe(1)
      expect(calls).toContain('inventoryReleased')
      expect(calls).toContain('reservationReleased')
      expect(calls).toContain('releaseMovementCreated')
   })

   test('release only queries ACTIVE reservations', async () => {
      const tx = createReleaseReservationTx({ calls: [] })

      await releaseReservationsForOrder(tx as any, 'order-1', 'RELEASED')

      expect(tx.inventoryReservation.lastFindMany.where).toEqual({
         orderId: 'order-1',
         status: 'ACTIVE',
      })
   })

   test('consume only queries ACTIVE reservations', async () => {
      const tx = createConsumeReservationTx({ rawResult: 1, calls: [] })

      await consumeReservationsForOrder(tx as any, 'order-1')
      expect(tx.inventoryReservation.lastFindMany.where).toEqual({
         orderId: 'order-1',
         status: 'ACTIVE',
      })
   })

   test('shipped order cannot consume the same reservation twice', async () => {
      const tx = createConsumeReservationTx({ rawResult: 1, calls: [] })

      await consumeReservationsForOrder(tx as any, 'order-1')
      tx.inventoryReservation.reservations = []

      const count = await consumeReservationsForOrder(tx as any, 'order-1')

      expect(count).toBe(0)
   })

   test('cancelled order does not consume stock after reservations release', async () => {
      const releaseTx = createReleaseReservationTx({ calls: [] })
      const consumeTx = createConsumeReservationTx({ rawResult: 1, calls: [] })

      await releaseReservationsForOrder(releaseTx as any, 'order-1', 'RELEASED')
      consumeTx.inventoryReservation.reservations = []

      const count = await consumeReservationsForOrder(consumeTx as any, 'order-1')

      expect(count).toBe(0)
   })

   test('adjustInventory writes an inventory movement', async () => {
      const movements: any[] = []
      const tx = createAdjustInventoryTx({ movements })

      const inventory = await adjustInventory(tx as any, {
         inventoryId: 'inventory-1',
         type: 'IN',
         quantity: 4,
         reason: 'Cycle count',
      })

      expect(inventory.quantity).toBe(9)
      expect(movements[0].data).toMatchObject({
         inventoryId: 'inventory-1',
         type: 'IN',
         quantity: 4,
         reason: 'Cycle count',
      })
   })

   test('adjustInventory rejects negative stock when backorders are disabled', async () => {
      const tx = createAdjustInventoryTx({ allowBackorders: false, quantity: 3 })

      await expect(
         adjustInventory(tx as any, {
            inventoryId: 'inventory-1',
            type: 'OUT',
            quantity: 4,
         })
      ).rejects.toThrow('Inventory quantity cannot become negative')
   })

   test('rejects transfer completion when source stock is unavailable', async () => {
      const tx = createTransferCompletionTx({ rawResult: 0 })

      await expect(
         completeStockTransfer(tx as any, 'transfer-1')
      ).rejects.toThrow('Insufficient transfer stock for product-1')
   })

   test('complete transfer moves stock to the destination warehouse', async () => {
      const calls: string[] = []
      const tx = createTransferCompletionTx({ rawResult: 1, calls })

      const transfer = await completeStockTransfer(tx as any, 'transfer-1')

      expect(transfer.status).toBe('COMPLETED')
      expect(calls).toContain('sourceDecremented')
      expect(calls).toContain('destinationUpserted')
   })

   test('complete transfer creates TRANSFER movements', async () => {
      const movements: any[] = []
      const tx = createTransferCompletionTx({ rawResult: 1, movements })

      await completeStockTransfer(tx as any, 'transfer-1')

      expect(movements[0].data).toHaveLength(2)
      expect(movements[0].data.every((item) => item.type === 'TRANSFER')).toBe(
         true
      )
      expect(movements[0].data.map((item) => item.quantity)).toEqual([-2, 2])
   })

   test('transfer destination inventory uses warehouse/product upsert', async () => {
      const upserts: any[] = []
      const tx = createTransferCompletionTx({ rawResult: 1, upserts })

      await completeStockTransfer(tx as any, 'transfer-1')

      expect(upserts[0].where.warehouseId_productId).toEqual({
         warehouseId: 'warehouse-2',
         productId: 'product-1',
      })
   })

   test('expireReservations releases expired active reservations', async () => {
      const calls: string[] = []
      const tx = createExpireReservationsTx({ calls })

      const count = await expireReservations(tx as any)

      expect(count).toBe(1)
      expect(tx.inventoryReservation.expiredQuery.where.status).toBe('ACTIVE')
      expect(calls).toContain('reservationExpired')
      expect(calls).toContain('orderCancelled')
   })
})

function createReserveTx({
   rawResult = 1,
   calls,
   trackInventory = true,
   allowBackorders = false,
   quantity = 10,
}: {
   rawResult?: number
   calls: string[]
   trackInventory?: boolean
   allowBackorders?: boolean
   quantity?: number
}) {
   return {
      product: {
         findMany: async () => [
            { id: 'product-1', trackInventory, allowBackorders },
         ],
      },
      inventory: {
         findUnique: async () => ({
            id: 'inventory-1',
            warehouseId: 'warehouse-1',
            productId: 'product-1',
            quantity,
            reservedQuantity: 0,
         }),
         update: async () => {
            calls.push('backorderReserved')
         },
      },
      inventoryReservation: {
         create: async () => {
            calls.push('reservationCreated')
            return { id: 'reservation-1' }
         },
      },
      inventoryMovement: {
         create: async () => {
            calls.push('reservationMovementCreated')
         },
      },
      $executeRaw: async () => {
         calls.push('reservedQuantityIncremented')
         return rawResult
      },
   }
}

function createSelectWarehouseTx({ quantity, reservedQuantity }) {
   return {
      product: {
         findMany: async () => [
            {
               id: 'product-1',
               trackInventory: true,
               allowBackorders: false,
            },
         ],
      },
      warehouse: {
         findMany: async () => [
            {
               id: 'warehouse-1',
               isActive: true,
               inventories: [
                  {
                     productId: 'product-1',
                     quantity,
                     reservedQuantity,
                  },
               ],
            },
         ],
      },
   }
}

function createLowStockTx({ availableQuantity, reorderPoint }) {
   return {
      inventory: {
         findUnique: async () => ({
            quantity: availableQuantity,
            reservedQuantity: 0,
            reorderPoint,
            reorderQuantity: 5,
            product: { title: 'Product' },
            warehouse: { name: 'Warehouse' },
         }),
      },
      owner: {
         findMany: async () => [],
      },
   }
}

function createConsumeReservationTx({ rawResult, calls, movements = [] }) {
   const inventoryReservation = {
      reservations: [
         {
            id: 'reservation-1',
            inventoryId: 'inventory-1',
            warehouseId: 'warehouse-1',
            productId: 'product-1',
            quantity: 2,
            product: { allowBackorders: false },
         },
      ],
      lastFindMany: null,
      findMany: async (query) => {
         inventoryReservation.lastFindMany = query
         return inventoryReservation.reservations
      },
      update: async () => {
         calls.push('reservationConsumed')
      },
   }

   return {
      inventoryReservation,
      inventory: {
         findUnique: async () => ({
            id: 'inventory-1',
            quantity: 10,
            reservedQuantity: 0,
            reorderPoint: 0,
            reorderQuantity: 0,
            product: { title: 'Product' },
            warehouse: { name: 'Warehouse' },
         }),
      },
      inventoryMovement: {
         create: async (data) => {
            movements.push(data)
            calls.push('movementCreated')
         },
      },
      owner: {
         findMany: async () => [],
      },
      $executeRaw: async () => {
         calls.push('executeRaw')
         return rawResult
      },
   }
}

function createReleaseReservationTx({ calls }) {
   const inventoryReservation = {
      lastFindMany: null,
      findMany: async (query) => {
         inventoryReservation.lastFindMany = query
         return [
            {
               id: 'reservation-1',
               inventoryId: 'inventory-1',
               warehouseId: 'warehouse-1',
               productId: 'product-1',
               quantity: 2,
            },
         ]
      },
      update: async ({ data }) => {
         calls.push(data.status === 'EXPIRED' ? 'reservationExpired' : 'reservationReleased')
      },
   }

   return {
      inventoryReservation,
      inventory: {
         updateMany: async () => {
            calls.push('inventoryReleased')
            return { count: 1 }
         },
      },
      inventoryMovement: {
         create: async () => {
            calls.push('releaseMovementCreated')
         },
      },
   }
}

function createAdjustInventoryTx({
   movements = [],
   allowBackorders = false,
   quantity = 5,
}: {
   movements?: any[]
   allowBackorders?: boolean
   quantity?: number
} = {}) {
   let findUniqueCalls = 0

   return {
      inventory: {
         findUniqueOrThrow: async () => ({
            id: 'inventory-1',
            warehouseId: 'warehouse-1',
            productId: 'product-1',
            quantity,
            reservedQuantity: 0,
            product: { allowBackorders },
         }),
         update: async ({ data }) => ({
            id: 'inventory-1',
            quantity: data.quantity,
         }),
         findUnique: async () => {
            findUniqueCalls += 1
            return findUniqueCalls
               ? {
                    quantity,
                    reservedQuantity: 0,
                    reorderPoint: 0,
                    reorderQuantity: 0,
                    product: { title: 'Product' },
                    warehouse: { name: 'Warehouse' },
                 }
               : null
         },
      },
      inventoryMovement: {
         create: async (data) => {
            movements.push(data)
         },
      },
      owner: {
         findMany: async () => [],
      },
   }
}

function createTransferCompletionTx({
   rawResult,
   calls = [],
   movements = [],
   upserts = [],
}) {
   return {
      stockTransfer: {
         findUniqueOrThrow: async () => ({
            id: 'transfer-1',
            fromWarehouseId: 'warehouse-1',
            toWarehouseId: 'warehouse-2',
            status: 'APPROVED',
            items: [{ productId: 'product-1', quantity: 2 }],
            reference: 'transfer-ref',
            fromWarehouse: { isActive: true },
            toWarehouse: { isActive: true },
         }),
         update: async ({ data }) => ({ id: 'transfer-1', ...data }),
      },
      product: {
         findMany: async () => [{ id: 'product-1' }],
         findUniqueOrThrow: async () => ({ allowBackorders: false }),
      },
      inventory: {
         findUnique: async () => ({
            id: 'inventory-1',
            warehouseId: 'warehouse-1',
            productId: 'product-1',
            quantity: 1,
            reservedQuantity: 0,
         }),
         upsert: async (data) => {
            calls.push('destinationUpserted')
            upserts.push(data)
            return {
               id: 'inventory-2',
               warehouseId: 'warehouse-2',
               productId: 'product-1',
            }
         },
      },
      inventoryMovement: {
         createMany: async (data) => {
            movements.push(data)
         },
      },
      owner: {
         findMany: async () => [],
      },
      $executeRaw: async () => {
         calls.push('sourceDecremented')
         return rawResult
      },
   }
}

function createExpireReservationsTx({ calls }) {
   const releaseTx = createReleaseReservationTx({ calls })
   const inventoryReservation = {
      ...releaseTx.inventoryReservation,
      expiredQuery: null,
      findMany: async (query) => {
         if (query.distinct) {
            inventoryReservation.expiredQuery = query
            return [{ orderId: 'order-1' }]
         }

         return releaseTx.inventoryReservation.findMany(query)
      },
   }

   return {
      ...releaseTx,
      inventoryReservation,
      order: {
         updateMany: async () => {
            calls.push('orderCancelled')
         },
      },
   }
}
