import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { status } = body // APPROVED or REJECTED

    const facilityRequest = await prisma.facilityRequest.findUnique({
        where: { id }
    })

    if (!facilityRequest) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (status === 'APPROVED') {
        // Create the location
        // Cast data to any to access properties
        const locationData = facilityRequest.data as any
        
        await prisma.location.create({
            data: {
                ...locationData,
                id: undefined, // Ensure no ID conflict
            }
        })
    }

    const updatedRequest = await prisma.facilityRequest.update({
      where: { id },
      data: { status },
    })

    return NextResponse.json(updatedRequest)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 })
  }
}

