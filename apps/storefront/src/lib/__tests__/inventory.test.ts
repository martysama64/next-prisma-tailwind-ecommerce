import { describe, expect, test } from 'bun:test'
import {
   consumeReservationsForOrder,
   getAvailableQuantity,
   getInventoryAvailabilityStatus,
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

   test('order creation reserves inventory', async () => {
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

   test('insufficient stock throws clear behavior', async () => {
      await expect(
         selectWarehouseForOrder(
            createSelectWarehouseTx({ quantity: 1, reservedQuantity: 0 }) as any,
            [{ productId: 'product-1', count: 2 }]
         )
      ).rejects.toThrow('No warehouse can fulfill the cart')
   })

   test('cancellation releases reservation', async () => {
      const calls: string[] = []
      const count = await releaseReservationsForOrder(
         createReleaseTx({ calls }) as any,
         'order-1',
         'RELEASED'
      )

      expect(count).toBe(1)
      expect(calls).toContain('inventoryReleased')
      expect(calls).toContain('reservationReleased')
   })

   test('backorder product can be ordered without available stock', async () => {
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
      expect(calls).toContain('reservationCreated')
   })

   test('non-tracked product skips reservation', async () => {
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

   test('shipping consumes active reservation and writes OUT movement', async () => {
      const movements: any[] = []
      const count = await consumeReservationsForOrder(
         createConsumeTx({ rawResult: 1, movements }) as any,
         'order-1'
      )

      expect(count).toBe(1)
      expect(movements[0].data.type).toBe('OUT')
      expect(movements[0].data.quantity).toBe(-2)
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

function createReleaseTx({ calls }) {
   return {
      inventoryReservation: {
         findMany: async () => [
            {
               id: 'reservation-1',
               inventoryId: 'inventory-1',
               warehouseId: 'warehouse-1',
               productId: 'product-1',
               quantity: 2,
            },
         ],
         update: async () => {
            calls.push('reservationReleased')
         },
      },
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

function createConsumeTx({ rawResult, movements }) {
   return {
      inventoryReservation: {
         findMany: async () => [
            {
               id: 'reservation-1',
               inventoryId: 'inventory-1',
               warehouseId: 'warehouse-1',
               productId: 'product-1',
               quantity: 2,
               product: { allowBackorders: false },
            },
         ],
         update: async () => undefined,
      },
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
         },
      },
      owner: {
         findMany: async () => [],
      },
      $executeRaw: async () => rawResult,
   }
}
