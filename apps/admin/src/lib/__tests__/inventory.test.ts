import { describe, expect, test } from 'bun:test'
import {
   completeStockTransfer,
   consumeReservationsForOrder,
   getAvailableQuantity,
   getInventoryAvailabilityStatus,
   releaseReservationsForOrder,
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

   test('consumes active reservations when an order is shipped', async () => {
      const calls: any[] = []
      const tx = createConsumeReservationTx({ rawResult: 1, calls })

      const count = await consumeReservationsForOrder(tx as any, 'order-1')

      expect(count).toBe(1)
      expect(calls).toContain('executeRaw')
      expect(calls).toContain('reservationConsumed')
      expect(calls).toContain('movementCreated')
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

   test('rejects transfer completion when source stock is unavailable', async () => {
      const tx = createTransferCompletionTx({ rawResult: 0 })

      await expect(
         completeStockTransfer(tx as any, 'transfer-1')
      ).rejects.toThrow('Insufficient transfer stock for product-1')
   })
})

function createConsumeReservationTx({ rawResult, calls }) {
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
         update: async () => {
            calls.push('reservationConsumed')
         },
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
         create: async () => {
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

function createTransferCompletionTx({ rawResult }) {
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
      },
      $executeRaw: async () => rawResult,
   }
}
