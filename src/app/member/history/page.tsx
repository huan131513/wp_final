'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Review {
  id: string
  comment: string
  rating: number
  createdAt: string
  location: {
    name: string
    type: string
  }
}

export default function HistoryPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await fetch('/api/user/reviews')
        if (res.ok) {
          setReviews(await res.json())
        }
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
    fetchReviews()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">我的歷史回覆</h1>
            <Link href="/member" className="text-blue-600 hover:text-blue-800">
                ← 回會員中心
            </Link>
        </div>

        {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : reviews.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">
                尚無評論紀錄
            </div>
        ) : (
            <div className="space-y-4">
                {reviews.map(review => (
                    <div key={review.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className="font-bold text-lg text-gray-900">{review.location.name}</h3>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    {review.location.type}
                                </span>
                            </div>
                            <div className="text-sm text-gray-500">
                                {new Date(review.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                        <div className="flex items-center mb-2 text-yellow-400">
                            {'★'.repeat(review.rating)}
                            <span className="text-gray-300 ml-1 text-sm">
                                {'★'.repeat(5 - review.rating)}
                            </span>
                        </div>
                        <p className="text-gray-700">{review.comment}</p>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  )
}

