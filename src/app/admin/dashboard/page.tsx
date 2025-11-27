import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'
import Link from 'next/link'

export default async function Dashboard() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/admin')
  }

  return (
    <div className="relative">
      <div className="absolute top-8 right-8 z-10">
        <Link 
          href="/"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors font-medium"
        >
          完成
        </Link>
      </div>
      <DashboardClient />
    </div>
  )
}
