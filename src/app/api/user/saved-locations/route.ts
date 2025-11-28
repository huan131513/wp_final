import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.name) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const user = await prisma.user.findUnique({
        where: { name: session.user.name },
        include: {
            savedLocations: {
                include: {
                    location: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }
        }
    })

    if (!user) return new NextResponse('User not found', { status: 404 })

    return NextResponse.json(user.savedLocations)
  } catch (error) {
    console.error(error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.name) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const { locationId } = await request.json()
    const user = await prisma.user.findUnique({ where: { name: session.user.name } })
    
    if (!user) return new NextResponse('User not found', { status: 404 })

    await prisma.savedLocation.create({
        data: {
            userId: user.id,
            locationId
        }
    })

    return NextResponse.json({ message: 'Location saved' })
  } catch (error) {
    console.error(error)
    // Check for unique constraint violation
    return new NextResponse('Already saved or error', { status: 400 })
  }
}

export async function DELETE(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.name) return new NextResponse('Unauthorized', { status: 401 })
  
    try {
      const { searchParams } = new URL(request.url)
      const locationId = searchParams.get('locationId')
      
      if (!locationId) return new NextResponse('Missing locationId', { status: 400 })

      const user = await prisma.user.findUnique({ where: { name: session.user.name } })
      if (!user) return new NextResponse('User not found', { status: 404 })
  
      await prisma.savedLocation.deleteMany({
          where: {
              userId: user.id,
              locationId
          }
      })
  
      return NextResponse.json({ message: 'Location removed' })
    } catch (error) {
      console.error(error)
      return new NextResponse('Internal Server Error', { status: 500 })
    }
  }

