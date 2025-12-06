import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const reportSchema = z.object({
  locationId: z.string().uuid(),
  content: z.string().min(1),
  type: z.enum(['CLEAN', 'NO_PAPER', 'DIRTY', 'MAINTENANCE', 'CLOGGED', 'OTHER']).default('OTHER'),
})

// Create Report (Member)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { locationId, content, type } = reportSchema.parse(body)

    const report = await prisma.report.create({
      data: {
        content,
        locationId,
        userId: session.user.id,
        type,
      },
    })

    return NextResponse.json(report)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }
}

// Get Reports (Admin)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const reports = await prisma.report.findMany({
      include: {
        user: { select: { name: true } },
        location: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(reports)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}

// Update Report Status & Reply (Admin)
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, status, adminReply } = body

    if (!id || !status) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const updatedReport = await prisma.report.update({
      where: { id },
      data: { 
        status,
        adminReply
      },
      include: { location: true } // Include location to get name for notification
    })

    // Create Notification if admin replied
    if (adminReply) {
        await prisma.notification.create({
            data: {
                userId: updatedReport.userId,
                title: '問題回報更新',
                message: `管理員已回覆您關於「${updatedReport.location.name}」的回報：${adminReply}`,
                type: 'REPLY',
                link: '/member/reports'
            }
        })
    }

    return NextResponse.json(updatedReport)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })
  }
}
