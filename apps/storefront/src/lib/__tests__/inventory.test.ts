import { describe, expect, test } from 'bun:test'
import {
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
})
