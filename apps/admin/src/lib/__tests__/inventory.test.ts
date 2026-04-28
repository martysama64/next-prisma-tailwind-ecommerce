import { describe, expect, test } from 'bun:test'
import {
   consumeReservationsForOrder,
   getAvailableQuantity,
   getInventoryAvailabilityStatus,
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
