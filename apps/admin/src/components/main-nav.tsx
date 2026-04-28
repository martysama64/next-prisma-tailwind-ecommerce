'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export function MainNav({
   className,
   ...props
}: React.HTMLAttributes<HTMLElement>) {
   const pathname = usePathname()
   const [lowStockCount, setLowStockCount] = useState(0)

   useEffect(() => {
      async function loadLowStockCount() {
         try {
            const response = await fetch('/api/inventory?lowStock=true', {
               cache: 'no-store',
            })

            if (!response.ok) return

            const json = await response.json()
            setLowStockCount(Array.isArray(json) ? json.length : 0)
         } catch (error) {
            console.error({ error })
         }
      }

      loadLowStockCount()
   }, [])

   const routes = [
      {
         href: `/banners`,
         label: 'Banners',
         active: pathname.includes(`/banners`),
      },
      {
         href: `/categories`,
         label: 'Categories',
         active: pathname.includes(`/categories`),
      },
      {
         href: `/products`,
         label: 'Products',
         active: pathname.includes(`/products`),
      },
       {
          href: `/orders`,
          label: 'Orders',
          active: pathname.includes(`/orders`),
       },
       {
          href: `/warehouses`,
          label: 'Warehouses',
          active: pathname.includes(`/warehouses`),
       },
       {
          href: `/inventory`,
          label: 'Inventory',
          badge: lowStockCount,
          active: pathname.includes(`/inventory`),
       },
       {
          href: `/payments`,
          label: 'Payments',
          active: pathname.includes(`/payments`),
       },
      {
         href: `/users`,
         label: 'Users',
         active: pathname.includes(`/users`),
      },
      {
         href: `/brands`,
         label: 'Brands',
         active: pathname.includes(`/brands`),
      },
      {
         href: `/codes`,
         label: 'Codes',
         active: pathname.includes(`/codes`),
      },
   ]

   return (
      <nav
         className={cn('flex items-center space-x-4 lg:space-x-6', className)}
         {...props}
      >
         {routes.map((route) => (
            <span key={route.href} className="inline-flex items-center gap-1">
               <Link
                  href={route.href}
                  className={cn(
                     'text-sm transition-colors hover:text-primary',
                     route.active
                        ? 'font-semibold'
                        : 'font-light text-muted-foreground'
                  )}
               >
                  {route.label}
               </Link>
               {'badge' in route && route.badge > 0 && (
                  <Link
                     href="/inventory/low-stock"
                     className="rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground"
                  >
                     {route.badge}
                  </Link>
               )}
            </span>
         ))}
      </nav>
   )
}
