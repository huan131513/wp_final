import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

// Schema similar to location but wrapped in request
const requestSchema = z.object({
  data: z.any(), // We'll trust the structure for now or replicate location schema
})

// Create Request (Member)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    // Store the entire body as the data for the new location
    // We could validate it against locationSchema here if we want strictness
    
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
export async function GET(request: Request) {
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

    // If approved, we should actually create the location
    if (status === 'APPROVED') {
        // Fetch the full request data
        const fullReq = await prisma.facilityRequest.findUnique({ where: { id } })
        if (fullReq) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const locData = fullReq.data as any
            await prisma.location.create({
                data: {
                    ...locData,
                    // ensure we don't pass invalid fields if data is dirty
                }
            })
        }
    }

    return NextResponse.json(updatedRequest)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 })
  }
}
