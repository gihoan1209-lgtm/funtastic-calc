import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// GET /api/products — list all products
export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('calc_products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products: data })
}

// POST /api/products — save a product
export async function POST(req) {
  const body = await req.json()
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('calc_products')
    .insert([{
      name: body.name,
      cost: body.cost,
      b2b_price: body.b2b_price,
      b2c_price: body.b2c_price,
      b2b_margin: body.b2b_margin,
      b2c_margin: body.b2c_margin,
    }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ product: data })
}

// DELETE /api/products — delete by id
export async function DELETE(req) {
  const { id } = await req.json()
  const supabase = getSupabase()

  const { error } = await supabase
    .from('calc_products')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
