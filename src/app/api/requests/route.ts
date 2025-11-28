import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Create Request (Member)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    
    const facilityRequest = await prisma.facilityRequest.create({
      data: {
        data: body,
        userId: session.user.id,
      },
    })

    return NextResponse.json(facilityRequest)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 })
  }
}

// Get Requests (Admin)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const requests = await prisma.facilityRequest.findMany({
      include: {
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(requests)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
  }
}

// Update Request Status & Reply (Admin)
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

    const updatedRequest = await prisma.facilityRequest.update({
      where: { id },
      data: { 
        status,
        adminReply
      },
    })

    // Create Notification Logic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reqData = updatedRequest.data as any
    const locationName = reqData.name || '新地點'
    
    let notifTitle = ''
    let notifMessage = ''

    if (status === 'APPROVED') {
        notifTitle = '地點申請已核准'
        notifMessage = `恭喜！您申請的地點「${locationName}」已通過審核並加入地圖。`
        
        // Create location
        await prisma.location.create({
             data: {
                 ...reqData,
             }
         })

    } else if (status === 'REJECTED') {
        notifTitle = '地點申請未通過'
        notifMessage = `抱歉，您申請的地點「${locationName}」未通過審核。` + (adminReply ? ` 原因：${adminReply}` : '')
    }

    if (notifTitle) {
        await prisma.notification.create({
            data: {
                userId: updatedRequest.userId,
                title: notifTitle,
                message: notifMessage,
                type: 'APPROVAL',
                link: '/member/requests'
            }
        })
    }

    return NextResponse.json(updatedRequest)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 })
  }
}
