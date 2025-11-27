import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const reportSchema = z.object({
  locationId: z.string().uuid(),
  content: z.string().min(1),
})

// Create Report (Member)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { locationId, content } = reportSchema.parse(body)

    const report = await prisma.report.create({
      data: {
        content,
        locationId,
        userId: session.user.id,
      },
    })

    return NextResponse.json(report)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }
}

// Get Reports (Admin)
export async function GET(request: Request) {
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
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}

