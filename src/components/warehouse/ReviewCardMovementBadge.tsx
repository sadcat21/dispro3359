import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';
import { useReviewItemMovements } from '@/hooks/useReviewItemMovements';

interface Props {
  productId: string | null;
  branchId: string | null;
  sinceIso: string | null;
  piecesPerBox: number;
}

/** شارة صغيرة تظهر فقط إن وُجدت حركة على المنتج بعد المراجعة */
const ReviewCardMovementBadge: React.FC<Props> = ({ productId, branchId, sinceIso, piecesPerBox }) => {
  const { data } = useReviewItemMovements({ productId, branchId, sinceIso, piecesPerBox });
  const count = data?.rows.length || 0;
  if (count === 0) return null;
  return (
    <Badge className="absolute top-1.5 end-1.5 text-[9px] px-1.5 py-0.5 gap-0.5 bg-blue-600 text-white shadow border-0">
      <Activity className="w-2.5 h-2.5" />
      حركة {count}
    </Badge>
  );
};

export default ReviewCardMovementBadge;
