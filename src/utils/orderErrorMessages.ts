/**
 * Convert Supabase/Postgres errors thrown during order creation
 * into short, user-friendly Arabic messages.
 *
 * Covers the 3-layer duplicate-order defense:
 *  1. unique index on client_request_id
 *  2. 60-second duplicate trigger (same customer + worker)
 *  3. 5-minute anti-spam trigger (>=5 orders per customer)
 */
export interface OrderErrorInfo {
  title: string;
  description?: string;
  isDuplicate: boolean;
}

export function getOrderErrorMessage(error: unknown): OrderErrorInfo {
  const err = error as { code?: string; message?: string; details?: string } | null;
  const code = err?.code ?? '';
  const msg = `${err?.message ?? ''} ${err?.details ?? ''}`.toLowerCase();

  // 1. Unique violation on client_request_id (double-submit retry)
  if (code === '23505' && msg.includes('client_request_id')) {
    return {
      title: 'تم تجاهل الطلبية المكررة',
      description: 'تم إرسال نفس الطلبية مسبقاً.',
      isDuplicate: true,
    };
  }

  // 2. 60-second duplicate trigger
  if (
    msg.includes('duplicate_order') ||
    msg.includes('within 60') ||
    msg.includes('خلال 60') ||
    msg.includes('prevent_order_duplicates')
  ) {
    return {
      title: 'يرجى الانتظار',
      description: 'لا يمكن إنشاء طلبية أخرى لنفس العميل خلال دقيقة واحدة.',
      isDuplicate: true,
    };
  }

  // 3. Anti-spam trigger (5 orders in 5 minutes)
  if (
    msg.includes('order_rate_limit') ||
    msg.includes('too many orders') ||
    msg.includes('rate limit')
  ) {
    return {
      title: 'تم تجاوز الحد المسموح',
      description: 'تم إنشاء عدد كبير من الطلبيات لهذا العميل خلال فترة قصيرة. حاول لاحقاً.',
      isDuplicate: true,
    };
  }

  // Generic unique violation
  if (code === '23505') {
    return {
      title: 'طلبية مكررة',
      description: 'هذه الطلبية موجودة مسبقاً.',
      isDuplicate: true,
    };
  }

  return {
    title: 'فشل إنشاء الطلبية',
    description: err?.message || 'حدث خطأ غير متوقع.',
    isDuplicate: false,
  };
}
