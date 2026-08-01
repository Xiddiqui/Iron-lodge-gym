import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { feeId, paymentMethod } = body;

  if (!feeId) {
    return NextResponse.json({ error: 'feeId is required' }, { status: 400 });
  }

  const validMethods = ['cash', 'online', 'card', 'other'];
  if (paymentMethod && !validMethods.includes(paymentMethod)) {
    return NextResponse.json({ error: `paymentMethod must be one of: ${validMethods.join(', ')}` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('fee_records')
    .update({
      paid: true,
      paid_at: new Date().toISOString(),
      payment_method: paymentMethod || 'cash',
      collected_by: user.id,
    })
    .eq('id', feeId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Fee collected', record: data });
}
