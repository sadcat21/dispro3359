export type PendingOfferStatus = 'pending' | 'confirmed' | 'rejected';
export type PendingOfferSource = 'order' | 'direct_sale' | 'delivery_sale' | 'warehouse_sale';

export interface PendingOfferConfirmation {
  id: string;
  created_at: string;
  updated_at: string;
  order_id: string | null;
  order_item_id: string | null;
  offer_id: string | null;
  product_id: string;
  product_name: string | null;
  pieces_per_box: number;
  gift_product_id: string | null;
  gift_product_name: string | null;
  gift_boxes: number;
  gift_pieces: number;
  customer_id: string | null;
  customer_name: string | null;
  worker_id: string | null;
  worker_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  source: PendingOfferSource;
  status: PendingOfferStatus;
  confirmed_at: string | null;
  confirmed_by: string | null;
  notes: string | null;
}
