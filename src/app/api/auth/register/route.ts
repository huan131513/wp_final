import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { z } from 'zod'

const PASSWORD_MIN = 8
const PASSWORD_MAX = 64

const registerSchema = z.object({
  name: z.string().trim().min(1, '請輸入使用者名稱'),
  password: z
    .string()
    .min(PASSWORD_MIN, `密碼長度至少 ${PASSWORD_MIN} 字元`)
    .max(PASSWORD_MAX, `密碼長度不可超過 ${PASSWORD_MAX} 字元`)
    .refine((val) => /[A-Za-z]/.test(val), '密碼需包含英文')
    .refine((val) => /\d/.test(val), '密碼需包含數字'),
  // 向後相容：舊版前端可能不會送 confirmPassword
  confirmPassword: z.string().optional(),
}).superRefine((data, ctx) => {
  if (typeof data.confirmPassword === 'string' && data.confirmPassword !== data.password) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confirmPassword'],
      message: '密碼與確認密碼不一致',
    })
  }
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, password } = registerSchema.parse(body)

    const existingUser = await prisma.user.findUnique({
      where: { name },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: '使用者名稱已被使用' },
        { status: 400 }
      )
    }

    const hashedPassword = await hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        password: hashedPassword,
        role: 'MEMBER',
      },
    })

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    console.error(error)
    if (error instanceof z.ZodError) {
      // 統一回傳易讀錯誤字串，避免前端顯示 [object Object]
      const message = error.issues?.[0]?.message || '輸入資料不正確'
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Something went wrong' },
      { status: 500 }
    )
  }
}

