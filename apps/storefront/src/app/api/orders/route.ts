import config from '@/config/site'
import Mail from '@/emails/order_notification_owner'
import {
   getAvailableQuantity,
   reserveStockForOrder,
   selectWarehouseForOrder,
} from '@/lib/inventory'
import prisma from '@/lib/prisma'
import { sendMail } from '@persepolis/mail'
import { render } from '@react-email/render'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      const orders = await prisma.order.findMany({
         where: {
            userId,
         },
         include: {
            address: true,
            payments: true,
            refund: true,
            orderItems: true,
         },
      })

      return NextResponse.json(orders)
   } catch (error) {
      console.error('[ORDERS_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function POST(req: Request) {
   let userId: string | null = null

   try {
      userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      const { addressId, discountCode, warehouseId } = await req.json()

      const order = await prisma.$transaction(async (tx) => {
         if (addressId) {
            await tx.address.findFirstOrThrow({
               where: { id: addressId, userId },
            })
         }

         const cart = await tx.cart.findUniqueOrThrow({
            where: { userId },
            include: {
               items: {
                  include: {
                     product: true,
                  },
               },
            },
         })

         if (!cart.items.length) {
            throw new OrderValidationError('Cart is empty')
         }

         const selectedWarehouse = await selectWarehouseForOrder(
            tx,
            cart.items,
            warehouseId
         )

         const insufficientStock = await getInsufficientStockItems(
            tx,
            cart.items,
            selectedWarehouse.id
         )

         if (insufficientStock.length) {
            throw new InsufficientStockError(insufficientStock)
         }

         let discountCodeRecord = null

         if (discountCode) {
            discountCodeRecord = await tx.discountCode.findUniqueOrThrow({
               where: { code: discountCode },
            })

            if (discountCodeRecord.stock < 1) {
               throw new OrderValidationError('Discount code is out of stock')
            }

            const updatedDiscountCodes = await tx.discountCode.updateMany({
               where: {
                  id: discountCodeRecord.id,
                  stock: { gte: 1 },
               },
               data: {
                  stock: { decrement: 1 },
               },
            })

            if (updatedDiscountCodes.count !== 1) {
               throw new OrderValidationError('Discount code is unavailable')
            }
         }

         const { tax, total, discount, payable } = calculateCosts({ cart })

         const createdOrder = await tx.order.create({
            data: {
               user: { connect: { id: userId } },
               warehouse: { connect: { id: selectedWarehouse.id } },
               status: 'Processing',
               total,
               tax,
               payable,
               discount,
               shipping: 0,
               ...(addressId && {
                  address: { connect: { id: addressId } },
               }),
               ...(discountCodeRecord && {
                  discountCode: { connect: { id: discountCodeRecord.id } },
               }),
               orderItems: {
                  create: cart.items.map((orderItem) => ({
                     count: orderItem.count,
                     price: orderItem.product.price,
                     discount: orderItem.product.discount,
                     product: {
                        connect: { id: orderItem.productId },
                     },
                  })),
               },
            },
         })

         await reserveStockForOrder(
            tx,
            createdOrder,
            cart.items,
            selectedWarehouse.id
         )

         await tx.cartItem.deleteMany({
            where: { cartId: userId },
         })

         return createdOrder
      })

      await sendOrderCreatedSideEffects(order)

      return NextResponse.json(order)
   } catch (error) {
      if (error instanceof InsufficientStockError) {
         return NextResponse.json(
            { error: 'INSUFFICIENT_STOCK', items: error.items },
            { status: 409 }
         )
      }

      if (error instanceof OrderValidationError) {
         return new NextResponse(error.message, { status: 400 })
      }

      if (
         error instanceof Error &&
         error.message.startsWith('Insufficient stock for product ')
      ) {
         return NextResponse.json(
            {
               error: 'INSUFFICIENT_STOCK',
               items: [
                  {
                     productId: error.message.replace(
                        'Insufficient stock for product ',
                        ''
                     ),
                  },
               ],
            },
            { status: 409 }
         )
      }

      if (
         error instanceof Error &&
         (error.message === 'No warehouse can fulfill the cart' ||
            error.message === 'No active warehouse is available')
      ) {
         const items = userId
            ? await getCurrentCartInsufficientStockItems(userId)
            : []

         return NextResponse.json(
            { error: 'INSUFFICIENT_STOCK', items },
            { status: 409 }
         )
      }

      console.error('[ORDER_POST]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

async function getCurrentCartInsufficientStockItems(userId: string) {
   const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
         items: {
            include: {
               product: {
                  include: {
                     inventories: true,
                  },
               },
            },
         },
      },
   })

   if (!cart) return []

   return cart.items
      .map((item) => {
         if (!item.product.trackInventory || item.product.allowBackorders) {
            return null
         }

         const available = item.product.inventories.reduce(
            (total, inventory) => total + getAvailableQuantity(inventory),
            0
         )

         if (available >= item.count) return null

         return {
            productId: item.productId,
            requested: item.count,
            available,
         }
      })
      .filter(Boolean)
}

function calculateCosts({ cart }) {
   let total = 0,
      discount = 0

   for (const item of cart?.items) {
      total += item?.count * item?.product?.price
      discount += item?.count * item?.product?.discount
   }

   const afterDiscount = total - discount
   const tax = afterDiscount * 0.09
   const payable = afterDiscount + tax

   return {
      total: parseFloat(total.toFixed(2)),
      discount: parseFloat(discount.toFixed(2)),
      afterDiscount: parseFloat(afterDiscount.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      payable: parseFloat(payable.toFixed(2)),
   }
}

async function getInsufficientStockItems(tx, cartItems, warehouseId: string) {
   const inventory = await tx.inventory.findMany({
      where: {
         warehouseId,
         productId: { in: cartItems.map((item) => item.productId) },
      },
   })

   return cartItems
      .map((item) => {
         if (!item.product.trackInventory || item.product.allowBackorders) {
            return null
         }

         const inventoryRow = inventory.find(
            (row) => row.productId === item.productId
         )
         const available = inventoryRow ? getAvailableQuantity(inventoryRow) : 0

         if (available >= item.count) return null

         return {
            productId: item.productId,
            requested: item.count,
            available,
         }
      })
      .filter(Boolean)
}

async function sendOrderCreatedSideEffects(order) {
   try {
      const owners = await prisma.owner.findMany()

      await prisma.notification.createMany({
         data: owners.map((owner) => ({
            userId: owner.id,
            content: `Order #${order.number} was created was created with a value of $${order.payable}.`,
         })),
      })

      for (const owner of owners) {
         await sendMail({
            name: config.name,
            to: owner.email,
            subject: 'An order was created.',
            html: await render(
               Mail({
                  id: order.id,
                  payable: order.payable.toFixed(2),
                  orderNum: order.number.toString(),
               })
            ),
         })
      }
   } catch (error) {
      console.error('[ORDER_POST_SIDE_EFFECTS]', error)
   }
}

class InsufficientStockError extends Error {
   items

   constructor(items) {
      super('Insufficient stock')
      this.items = items
   }
}

class OrderValidationError extends Error {}
