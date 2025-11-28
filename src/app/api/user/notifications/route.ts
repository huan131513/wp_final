import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.name) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const user = await prisma.user.findUnique({ where: { name: session.user.name } })
    if (!user) return new NextResponse('User not found', { status: 404 })

    const notifications = await prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(notifications)
  } catch (error) {
    console.error(error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function PATCH(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.name) return new NextResponse('Unauthorized', { status: 401 })
  
    try {
      const body = await request.json()
      const { notificationId, markAll } = body
      
      const user = await prisma.user.findUnique({ where: { name: session.user.name } })
      if (!user) return new NextResponse('User not found', { status: 404 })

      if (markAll) {
          await prisma.notification.updateMany({
              where: { userId: user.id, isRead: false },
              data: { isRead: true }
          })
          return NextResponse.json({ message: 'All marked as read' })
      }

      if (notificationId) {
          await prisma.notification.update({
              where: { id: notificationId },
              data: { isRead: true }
          })
          return NextResponse.json({ message: 'Marked as read' })
      }

      return new NextResponse('Invalid request', { status: 400 })
    } catch (error) {
      console.error(error)
      return new NextResponse('Internal Server Error', { status: 500 })
    }
}
