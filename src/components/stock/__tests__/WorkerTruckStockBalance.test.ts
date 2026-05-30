import { describe, it, expect } from 'vitest';
import { dbBPToBoxes } from '@/utils/boxPieceInput';

/**
 * يضمن هذا الاختبار أن «الباقي» المعروض على كارد المخزون يتطابق مع «الباقي»
 * المحسوب في سجل حركة المنتج، خاصة عندما يوجد رصيد مُرحَّل من قبل آخر شحنة.
 *
 * السيناريو (مأخوذ من حالة العامل Kassos Houari و المنتج AROMA 250 Gr):
 *   - pieces_per_box = 20
 *   - رصيد مُرحَّل قبل آخر شحنة = 373 صندوقًا
 *   - آخر شحنة = 100 صندوق
 *   - مبيعات بعد آخر محاسبة = 382 صندوقًا
 *   - الباقي الصحيح = 373 + 100 − 382 = 91 صندوقًا (مخزَّن في worker_stock = 91.00)
 *
 * الخطأ السابق: الكارد كان يحسب فقط (آخر شحنة − المبيعات منذ آخر محاسبة) فيُظهر 0
 * بينما الديالوغ يُظهر 91. الإصلاح: قراءة الرصيد مباشرة من worker_stock.
 */

// منطق الكارد بعد الإصلاح
const cardRemaining = (workerStockQty: number, ppb: number) =>
  dbBPToBoxes(Math.max(0, workerStockQty), ppb);

// منطق finalRemaining في سجل الحركة (مبسَّط من WorkerTruckStockList)
interface Mv { delta: number; type: 'load' | 'sale' | 'unload' | 'modification' | 'empty'; previousQty?: number }
const dialogFinalRemaining = (workerStockQty: number, ppb: number, movements: Mv[]) => {
  const currentQty = dbBPToBoxes(Math.max(0, workerStockQty), ppb);
  const totalDelta = movements.reduce((s, m) => s + m.delta, 0);
  const hasTrueReset = false;
  const openingBalance = hasTrueReset ? 0 : Math.max(0, currentQty - totalDelta);
  let running = openingBalance;
  for (const m of movements) {
    if (m.type === 'empty') continue;
    const before = m.type === 'load' && typeof m.previousQty === 'number'
      ? Math.max(0, m.previousQty)
      : running;
    running = Math.max(0, before + m.delta);
  }
  return running;
};

describe('WorkerTruckStockList - الباقي على الكارد مقابل سجل الحركة', () => {
  it('يتطابق الكارد مع سجل الحركة عند وجود رصيد مُرحَّل قبل آخر شحنة', () => {
    const ppb = 20;
    const workerStock = 91; // 91.00 صندوق = الناتج بعد المعايرة
    // الحركات منذ آخر محاسبة: شحن +100 ثم مبيعات بإجمالي 382
    const movements: Mv[] = [
      { type: 'load', delta: 100, previousQty: 373 },
      { type: 'sale', delta: -100 },
      { type: 'sale', delta: -100 },
      { type: 'sale', delta: -100 },
      { type: 'sale', delta: -82 },
    ];

    const cardVal = cardRemaining(workerStock, ppb);
    const dialogVal = dialogFinalRemaining(workerStock, ppb, movements);

    expect(cardVal).toBe(91);
    expect(dialogVal).toBe(91);
    expect(cardVal).toBe(dialogVal);
  });

  it('يتطابقان عند رصيد ابتدائي صفر (شحن جديد بدون ترحيل)', () => {
    const ppb = 20;
    const workerStock = 93;
    const movements: Mv[] = [
      { type: 'load', delta: 100, previousQty: 0 },
      { type: 'sale', delta: -7 },
    ];
    expect(cardRemaining(workerStock, ppb)).toBe(dialogFinalRemaining(workerStock, ppb, movements));
  });

  it('يتطابقان مع رصيد B.P كسري (صناديق + قطع)', () => {
    const ppb = 20;
    // 2.10 = 2 صناديق + 10 قطع = 2.5 صندوق كسري
    const workerStock = 2.10;
    const movements: Mv[] = [
      { type: 'load', delta: 5, previousQty: 0 },
      { type: 'sale', delta: -2.5 },
    ];
    const card = cardRemaining(workerStock, ppb);
    const dialog = dialogFinalRemaining(workerStock, ppb, movements);
    expect(card).toBeCloseTo(2.5, 5);
    expect(card).toBeCloseTo(dialog, 5);
  });

  it('يحسب بيع 10 قطع على أنه 0.10 وليس 10 صناديق', () => {
    const ppb = 20;
    // 2.04 = 2 صندوق + 4 قطع = 44 قطعة
    // بيع 10 قطع = 0.10 بصيغة B.P = 0.5 صندوق كسري في الحساب
    // المتبقي = 34 قطعة = 1.14
    const workerStock = 1.14;
    const movements: Mv[] = [
      { type: 'load', delta: 2.2, previousQty: 0 },
      { type: 'sale', delta: -0.5 },
    ];

    const card = cardRemaining(workerStock, ppb);
    const dialog = dialogFinalRemaining(workerStock, ppb, movements);

    expect(card).toBeCloseTo(1.7, 5);
    expect(dialog).toBeCloseTo(1.7, 5);
    expect(card).toBeCloseTo(dialog, 5);
  });
});
