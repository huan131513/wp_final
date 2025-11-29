
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { use } from 'react'

export default function RedirectToMap({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)

  useEffect(() => {
    // Redirect to home page with the locationId query parameter
    if (id) {
        router.replace(`/?locationId=${id}`)
    } else {
        router.replace('/')
    }
  }, [router, id])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Redirecting to location...</p>
    </div>
  )
}
