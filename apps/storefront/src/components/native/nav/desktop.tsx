'use client'

import {
   NavigationMenu,
   NavigationMenuContent,
   NavigationMenuItem,
   NavigationMenuLink,
   NavigationMenuList,
   NavigationMenuTrigger,
   navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'
import config from '@/config/site'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { forwardRef } from 'react'

export function MainNav({ categories = [], brands = [] }) {
   return (
      <div className="hidden md:flex gap-4">
         <Link href="/" className="flex items-center">
            <span className="hidden font-medium sm:inline-block">
               {config.name}
            </span>
         </Link>
         <NavMenu categories={categories} brands={brands} />
      </div>
   )
}

export function NavMenu({ categories = [], brands = [] }) {
   const categoryItems = Array.isArray(categories) ? categories : []
   const brandItems = Array.isArray(brands) ? brands : []

   return (
      <NavigationMenu>
         <NavigationMenuList>
            <NavigationMenuItem>
               <Link href="/products" legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                     <div className="font-normal text-foreground/70">
                        Products
                     </div>
                  </NavigationMenuLink>
               </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
               <NavigationMenuTrigger>
                  <div className="font-normal text-foreground/70">
                     Categories
                  </div>
               </NavigationMenuTrigger>
               <NavigationMenuContent>
                  <ul className="grid w-[400px] gap-2 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                     {categoryItems.length > 0 ? (
                        categoryItems.map((category) => (
                           <ListItem
                              key={category.id}
                              href={`/products?category=${encodeURIComponent(category.title)}`}
                              title={category.title}
                           >
                              Browse products in {category.title}.
                           </ListItem>
                        ))
                     ) : (
                        <li className="p-3 text-sm text-muted-foreground">
                           No categories available.
                        </li>
                     )}
                  </ul>
               </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
               <NavigationMenuTrigger>
                  <div className="font-normal text-foreground/70">Brands</div>
               </NavigationMenuTrigger>
               <NavigationMenuContent>
                  <ul className="grid w-[400px] gap-2 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                     {brandItems.length > 0 ? (
                        brandItems.map((brand) => (
                           <ListItem
                              key={brand.id}
                              title={brand.title}
                              href={`/products?brand=${encodeURIComponent(brand.title)}`}
                           >
                              Browse products from {brand.title}.
                           </ListItem>
                        ))
                     ) : (
                        <li className="p-3 text-sm text-muted-foreground">
                           No brands available.
                        </li>
                     )}
                  </ul>
               </NavigationMenuContent>
            </NavigationMenuItem>
         </NavigationMenuList>
      </NavigationMenu>
   )
}

const ListItem = forwardRef<
   React.ElementRef<'a'>,
   React.ComponentPropsWithoutRef<'a'>
>(({ className, title, children, href, ...props }, ref) => {
   return (
      <li>
         <NavigationMenuLink asChild>
            <Link
               href={href}
               ref={ref}
               className={cn(
                  'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
                  className
               )}
               {...props}
            >
               <div className="text-sm font-medium leading-none">{title}</div>
               <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                  {children}
               </p>
            </Link>
         </NavigationMenuLink>
      </li>
   )
})

ListItem.displayName = 'ListItem'
