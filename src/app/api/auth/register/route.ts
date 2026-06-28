import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password, firmName, country } = body

    // Validation
    if (!name || !email || !password || !firmName) {
      return NextResponse.json(
        { error: 'Name, email, password, and firm name are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existing = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create firm + user in a transaction
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14) // 14-day free trial

    const result = await db.$transaction(async (tx) => {
      const firm = await tx.firm.create({
        data: {
          name: firmName,
          subscriptionTier: 'starter',
          subscriptionStatus: 'trialing',
          trialEndsAt,
          country: country || 'US',
          settings: JSON.stringify({}),
        },
      })

      const user = await tx.user.create({
        data: {
          firmId: firm.id,
          email: email.toLowerCase(),
          name,
          password: hashedPassword,
          role: 'admin', // First user is the firm admin
          status: 'active',
          emailVerified: new Date(),
        },
      })

      // Create a default PBC template for the new firm
      await tx.pbcTemplate.create({
        data: {
          firmId: firm.id,
          name: 'Standard 1040 Individual',
          description: 'Comprehensive PBC list for individual tax returns',
          clientType: 'individual',
          engagementType: '1040',
          items: JSON.stringify([
            { documentType: 'W-2', description: 'All W-2 wage statements (2025)', category: 'income', required: true, priority: 'high' },
            { documentType: '1099-NEC', description: '1099-NEC for freelance/contract work', category: 'income', required: true, priority: 'high' },
            { documentType: '1099-INT', description: '1099-INT for bank interest', category: 'income', required: true, priority: 'medium' },
            { documentType: '1098', description: 'Form 1098 mortgage interest statement', category: 'deduction', required: true, priority: 'medium' },
            { documentType: 'Drivers-License', description: "Copy of driver's license (ID verification)", category: 'identity', required: true, priority: 'high' },
          ]),
          isDefault: true,
        },
      })

      return { firm, user }
    })

    return NextResponse.json({
      success: true,
      user: { id: result.user.id, email: result.user.email, name: result.user.name },
      firm: { id: result.firm.id, name: result.firm.name },
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    )
  }
}
