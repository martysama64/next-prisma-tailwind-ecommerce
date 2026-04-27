import Footer from '@/components/native/Footer'
import Header from '@/components/native/nav/parent'
import prisma from '@/lib/prisma'

export default async function DashboardLayout({
   children,
}: {
   children: React.ReactNode
}) {
   const [categories, brands] = await Promise.all([
      prisma.category.findMany({
         orderBy: { title: 'asc' },
         select: { id: true, title: true },
      }),
      prisma.brand.findMany({
         orderBy: { title: 'asc' },
         select: { id: true, title: true },
      }),
   ])

   return (
      <>
         <Header categories={categories} brands={brands} />
         <div className="px-[1.4rem] md:px-[4rem] lg:px-[6rem] xl:px-[8rem] 2xl:px-[12rem]">
            {children}
         </div>
         <Footer />
      </>
   )
}
