'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
   Form,
   FormControl,
   FormDescription,
   FormField,
   FormItem,
   FormLabel,
   FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from '@/components/ui/select'
import type { OrderWithIncludes } from '@/types/prisma'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import * as z from 'zod'

const formSchema = z.object({
   status: z.string().min(1),
   shipping: z.coerce.number().min(0),
   payable: z.coerce.number().min(0),
   discount: z.coerce.number().min(0),
   isPaid: z.boolean().default(false).optional(),
   isCompleted: z.boolean().default(false).optional(),
})

type ProductFormValues = z.infer<typeof formSchema>

interface ProductFormProps {
   initialData: OrderWithIncludes | null
}

export const OrderForm: React.FC<ProductFormProps> = ({ initialData }) => {
   const params = useParams()
   const router = useRouter()

   const [loading, setLoading] = useState(false)

   const toastMessage = 'Order updated.'
   const action = 'Save changes'

   const defaultValues = initialData
      ? {
           ...initialData,
        }
      : {
           status: '---',
           shipping: 0,
           payable: 0,
           discount: 0,
           isPaid: false,
           isCompleted: false,
        }

   const form = useForm<ProductFormValues>({
      resolver: zodResolver(formSchema),
      defaultValues,
   })

   const onSubmit = async (data: ProductFormValues) => {
      try {
         setLoading(true)

         const response = initialData
            ? await fetch(`/api/orders/${params.orderId}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
             })
            : await fetch(`/api/orders`, {
                method: 'POST',
                body: JSON.stringify(data),
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
             })

         if (!response.ok) {
            const message =
               response.status === 409
                  ? 'INSUFFICIENT_STOCK'
                  : await response.text()
            throw new Error(message)
         }

         router.refresh()
         router.push(`/orders/${params.orderId}`)
         toast.success(toastMessage)
      } catch (error: any) {
         toast.error(error?.message || 'Something went wrong.')
      } finally {
         setLoading(false)
      }
   }

   return (
      <Form {...form}>
         <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="block space-y-2 w-full"
         >
            <FormField
               control={form.control}
               name="status"
               render={({ field }) => (
                  <FormItem>
                     <FormLabel>Status</FormLabel>
                     <Select
                        disabled={loading}
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue={field.value}
                     >
                        <FormControl>
                           <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                           </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           <SelectItem value="Processing">Processing</SelectItem>
                           <SelectItem value="Shipped">Shipped</SelectItem>
                           <SelectItem value="Delivered">Delivered</SelectItem>
                           <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                     </Select>
                     <FormMessage />
                  </FormItem>
               )}
            />
            <FormField
               control={form.control}
               name="shipping"
               render={({ field }) => (
                  <FormItem>
                     <FormLabel>Price</FormLabel>
                     <FormControl>
                        <Input
                           type="number"
                           disabled={loading}
                           placeholder="9.99"
                           {...field}
                        />
                     </FormControl>
                     <FormMessage />
                  </FormItem>
               )}
            />
            <FormField
               control={form.control}
               name="payable"
               render={({ field }) => (
                  <FormItem>
                     <FormLabel>Discount</FormLabel>
                     <FormControl>
                        <Input
                           type="number"
                           disabled={loading}
                           placeholder="9.99"
                           {...field}
                        />
                     </FormControl>
                     <FormMessage />
                  </FormItem>
               )}
            />
            <FormField
               control={form.control}
               name="discount"
               render={({ field }) => (
                  <FormItem>
                     <FormLabel>Discount</FormLabel>
                     <FormControl>
                        <Input
                           type="number"
                           disabled={loading}
                           placeholder="9.99"
                           {...field}
                        />
                     </FormControl>
                     <FormMessage />
                  </FormItem>
               )}
            />
            <FormField
               control={form.control}
               name="isPaid"
               render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                     <FormControl>
                        <Checkbox
                           checked={field.value}
                           onCheckedChange={field.onChange}
                        />
                     </FormControl>
                     <div className="space-y-1 leading-none">
                        <FormLabel>Featured</FormLabel>
                        <FormDescription>
                           This product will appear on the home page
                        </FormDescription>
                     </div>
                  </FormItem>
               )}
            />
            <FormField
               control={form.control}
               name="isCompleted"
               render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                     <FormControl>
                        <Checkbox
                           checked={field.value}
                           onCheckedChange={field.onChange}
                        />
                     </FormControl>
                     <div className="space-y-1 leading-none">
                        <FormLabel>Available</FormLabel>
                        <FormDescription>
                           This product will appear in the store.
                        </FormDescription>
                     </div>
                  </FormItem>
               )}
            />
            <Button disabled={loading} className="ml-auto" type="submit">
               {action}
            </Button>
         </form>
      </Form>
   )
}
