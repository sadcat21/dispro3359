import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Package, TrendingUp, AlertTriangle, Gift, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type LedgerRow = {
  id: string;
  offer_id: string | null;
  product_id: string;
  worker_id: string | null;
  customer_id: string | null;
  branch_id: string | null;
  movement_type: string;
  sale_quantity: number;
  gift_quantity: number;
  sale_quantity_unit: string | null;
  gift_quantity_unit: string | null;
  signed_sale: number | null;
  signed_gift: number | null;
  running_sale_balance: number | null;
  running_gift_balance: number | null;
  reference_type: string | null;
  notes: string | null;
  created_at: string;
  offer_name: string | null;
  product_name: string | null;
  pieces_per_box: number | null;
  worker_name: string | null;
  customer_name: string | null;
  branch_name: string | null;
};

type BalanceRow = {
  offer_id: string | null;
  worker_id: string | null;
  product_id: string;
  branch_id: string | null;
  loaded_sale: number;
  loaded_gift: number;
  delivered_sale: number;
  delivered_gift: number;
  shortage_sale: number;
  shortage_gift: number;
  remaining_sale: number;
  remaining_gift: number;
  movements_count: number;
  last_movement_at: string;
};

type IntegrityIssue = {
  issue_type: string;
  issue_label: string;
  severity: string;
  promo_id: string | null;
  offer_id: string | null;
  product_id: string | null;
  worker_id: string | null;
  customer_id: string | null;
  sale_quantity: number | null;
  gift_quantity: number | null;
  created_at: string;
  expected: number | null;
  actual: number | null;
};

const movementLabels: Record<string, { label: string; color: string }> = {
  warehouse_to_worker: { label: "تحميل من المخزن", color: "bg-blue-100 text-blue-800" },
  worker_to_customer: { label: "تسليم للعميل", color: "bg-green-100 text-green-800" },
  shortage: { label: "شرود/نقص", color: "bg-red-100 text-red-800" },
  return_to_warehouse: { label: "إرجاع للمخزن", color: "bg-yellow-100 text-yellow-800" },
  adjustment: { label: "تسوية", color: "bg-purple-100 text-purple-800" },
};

const fmt = (n: number | null | undefined) => (n == null ? "-" : Number(n).toFixed(2));

// تحويل كمية بصيغة b.p (الجزء الصحيح = صناديق، العشري = قطع) إلى "X box + Y pcs"
const formatBoxPieces = (
  qty: number | null | undefined,
  unit: string | null | undefined,
  piecesPerBox: number | null | undefined
): string => {
  if (qty == null || qty === 0) return "0";
  const absQty = Math.abs(Number(qty));
  const sign = Number(qty) < 0 ? "-" : "";
  if (unit === "piece") {
    return `${sign}${Math.round(absQty)} pcs`;
  }
  const ppb = Math.max(Number(piecesPerBox) || 1, 1);
  const rounded = Math.round(absQty * 100) / 100;
  const boxes = Math.floor(rounded);
  const pieces = Math.round((rounded - boxes) * 100);
  if (boxes > 0 && pieces > 0) return `${sign}${boxes} box + ${pieces} pcs`;
  if (boxes > 0) return `${sign}${boxes} box`;
  if (pieces > 0) return `${sign}${pieces} pcs`;
  return "0";
};

const formatDateEn = (d: string) =>
  new Date(d).toLocaleString("en-GB", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

export default function OfferLedger() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: ledger, isLoading } = useQuery({
    queryKey: ["offer-ledger-full"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_offer_ledger_full")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as LedgerRow[];
    },
  });

  const { data: balances } = useQuery({
    queryKey: ["offer-balances"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_offer_balances")
        .select("*")
        .order("last_movement_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BalanceRow[];
    },
  });

  const { data: workersMap } = useQuery({
    queryKey: ["workers-map"],
    queryFn: async () => {
      const { data } = await supabase.from("workers").select("id, full_name");
      const map: Record<string, string> = {};
      (data ?? []).forEach((w: any) => (map[w.id] = w.full_name));
      return map;
    },
  });

  const { data: productsMap } = useQuery({
    queryKey: ["products-map"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name");
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => (map[p.id] = p.name));
      return map;
    },
  });

  const { data: offersMap } = useQuery({
    queryKey: ["offers-map"],
    queryFn: async () => {
      const { data } = await supabase.from("product_offers").select("id, name");
      const map: Record<string, string> = {};
      (data ?? []).forEach((o: any) => (map[o.id] = o.name));
      return map;
    },
  });

  const { data: issues, refetch: refetchIssues, isFetching: loadingIssues } = useQuery({
    queryKey: ["offer-integrity-issues"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_offer_integrity_issues")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as IntegrityIssue[];
    },
  });

  const handleRepair = async () => {
    const { data, error } = await (supabase as any).rpc("repair_offer_ledger");
    if (error) {
      toast.error("فشل الإصلاح: " + error.message);
      return;
    }
    toast.success(`تم إصلاح ${data?.repaired ?? 0} حركة`);
    refetchIssues();
  };

  const filtered = useMemo(() => {
    if (!ledger) return [];
    const q = search.trim().toLowerCase();
    return ledger.filter((r) => {
      if (typeFilter !== "all" && r.movement_type !== typeFilter) return false;
      if (!q) return true;
      return [r.offer_name, r.product_name, r.worker_name, r.customer_name, r.branch_id, r.notes]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [ledger, search, typeFilter]);

  const totals = useMemo(() => {
    const t = { loaded: 0, delivered: 0, shortage: 0, gifts: 0 };
    (balances ?? []).forEach((b) => {
      t.loaded += Number(b.loaded_sale) || 0;
      t.delivered += Number(b.delivered_sale) || 0;
      t.shortage += Number(b.shortage_sale) || 0;
      t.gifts += Number(b.delivered_gift) || 0;
    });
    return t;
  }, [balances]);

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">دفتر حركة العروض</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">كمية محملة</p>
              <p className="text-xl font-bold">{fmt(totals.loaded)}</p>
            </div>
            <Package className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">مسلّمة للعملاء</p>
              <p className="text-xl font-bold">{fmt(totals.delivered)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">هدايا</p>
              <p className="text-xl font-bold">{fmt(totals.gifts)}</p>
            </div>
            <Gift className="h-8 w-8 text-purple-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">شرود/نقص</p>
              <p className="text-xl font-bold">{fmt(totals.shortage)}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ledger" className="w-full">
        <TabsList>
          <TabsTrigger value="ledger">سجل الحركات</TabsTrigger>
          <TabsTrigger value="balances">الأرصدة الحالية</TabsTrigger>
          <TabsTrigger value="integrity" className="relative">
            مراقبة السلامة
            {issues && issues.length > 0 && (
              <Badge className="mr-2 bg-red-500 text-white">{issues.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">حركات العروض</CardTitle>
              <div className="flex flex-wrap gap-2 pt-2">
                <Input
                  placeholder="بحث (عرض، منتج، عامل، عميل...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-xs"
                />
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحركات</SelectItem>
                    {Object.entries(movementLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>الحركة</TableHead>
                        <TableHead>العرض</TableHead>
                        <TableHead>المنتج</TableHead>
                        <TableHead>العامل</TableHead>
                        <TableHead>العميل</TableHead>
                        <TableHead className="text-center">بيع</TableHead>
                        <TableHead className="text-center">هدية</TableHead>
                        <TableHead className="text-center">تفاصيل العرض</TableHead>
                        <TableHead className="text-center">رصيد بيع</TableHead>
                        <TableHead className="text-center">رصيد هدية</TableHead>
                        <TableHead>ملاحظات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => {
                        const m = movementLabels[r.movement_type] ?? { label: r.movement_type, color: "" };
                        const saleDetail = formatBoxPieces(r.sale_quantity, r.sale_quantity_unit, r.pieces_per_box);
                        const giftDetail = formatBoxPieces(r.gift_quantity, r.gift_quantity_unit, r.pieces_per_box);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatDateEn(r.created_at)}
                            </TableCell>
                            <TableCell>
                              <Badge className={m.color} variant="secondary">
                                {m.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{r.offer_name ?? "-"}</TableCell>
                            <TableCell className="text-xs">{r.product_name ?? "-"}</TableCell>
                            <TableCell className="text-xs">{r.worker_name ?? "-"}</TableCell>
                            <TableCell className="text-xs">{r.customer_name ?? "-"}</TableCell>
                            <TableCell className="text-center font-mono">
                              <span className={Number(r.signed_sale) < 0 ? "text-red-600" : "text-green-600"}>
                                {fmt(r.signed_sale)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              <span className={Number(r.signed_gift) < 0 ? "text-red-600" : "text-green-600"}>
                                {fmt(r.signed_gift)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center text-xs whitespace-nowrap">
                              <div className="flex flex-col gap-0.5">
                                <span>
                                  <span className="text-muted-foreground">بيع:</span>{" "}
                                  <span className="font-mono">{saleDetail}</span>
                                </span>
                                {Number(r.gift_quantity) !== 0 && (
                                  <span>
                                    <span className="text-muted-foreground">هدية:</span>{" "}
                                    <span className="font-mono text-purple-600">{giftDetail}</span>
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-mono font-semibold">
                              {fmt(r.running_sale_balance)}
                            </TableCell>
                            <TableCell className="text-center font-mono font-semibold">
                              {fmt(r.running_gift_balance)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.notes ?? "-"}</TableCell>
                          </TableRow>
                        );
                      })}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                            لا توجد حركات
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">أرصدة العروض الحالية (لكل عامل/منتج/عرض)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>العرض</TableHead>
                      <TableHead>المنتج</TableHead>
                      <TableHead>العامل</TableHead>
                      <TableHead className="text-center">محمّل</TableHead>
                      <TableHead className="text-center">مسلّم</TableHead>
                      <TableHead className="text-center">هدايا</TableHead>
                      <TableHead className="text-center">شرود</TableHead>
                      <TableHead className="text-center">المتبقي (بيع)</TableHead>
                      <TableHead className="text-center">المتبقي (هدية)</TableHead>
                      <TableHead className="text-center">حركات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(balances ?? []).map((b, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{(b.offer_id && offersMap?.[b.offer_id]) || "—"}</TableCell>
                        <TableCell className="text-xs">{productsMap?.[b.product_id] ?? "—"}</TableCell>
                        <TableCell className="text-xs">{(b.worker_id && workersMap?.[b.worker_id]) || "—"}</TableCell>
                        <TableCell className="text-center font-mono">{fmt(b.loaded_sale)}</TableCell>
                        <TableCell className="text-center font-mono">{fmt(b.delivered_sale)}</TableCell>
                        <TableCell className="text-center font-mono">{fmt(b.delivered_gift)}</TableCell>
                        <TableCell className="text-center font-mono text-red-600">{fmt(b.shortage_sale)}</TableCell>
                        <TableCell className="text-center font-mono font-bold">
                          <span className={Number(b.remaining_sale) < 0 ? "text-red-600" : ""}>
                            {fmt(b.remaining_sale)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold">{fmt(b.remaining_gift)}</TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {b.movements_count}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!balances || balances.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          لا توجد أرصدة
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrity">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                مراقبة سلامة بيانات العروض
              </CardTitle>
              <Button onClick={handleRepair} disabled={loadingIssues} size="sm" variant="outline">
                <Wrench className="h-4 w-4 ml-2" />
                إصلاح الحركات الناقصة
              </Button>
            </CardHeader>
            <CardContent>
              {loadingIssues ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !issues || issues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ShieldCheck className="h-16 w-16 text-green-500 mb-3" />
                  <p className="text-lg font-semibold">جميع بيانات العروض سليمة ✓</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    لا توجد فجوات أو تعارضات في حركة العروض عبر النظام
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الخطورة</TableHead>
                        <TableHead>نوع المشكلة</TableHead>
                        <TableHead>المنتج</TableHead>
                        <TableHead>العامل</TableHead>
                        <TableHead>العرض</TableHead>
                        <TableHead className="text-center">المتوقع</TableHead>
                        <TableHead className="text-center">الفعلي</TableHead>
                        <TableHead>التاريخ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issues.map((it, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Badge
                              className={
                                it.severity === "critical"
                                  ? "bg-red-600 text-white"
                                  : it.severity === "high"
                                  ? "bg-orange-500 text-white"
                                  : "bg-yellow-500 text-white"
                              }
                            >
                              {it.severity === "critical" ? "حرج" : it.severity === "high" ? "عالي" : "متوسط"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-orange-500" />
                            {it.issue_label}
                          </TableCell>
                          <TableCell className="text-xs">{(it.product_id && productsMap?.[it.product_id]) || "—"}</TableCell>
                          <TableCell className="text-xs">{(it.worker_id && workersMap?.[it.worker_id]) || "—"}</TableCell>
                          <TableCell className="text-xs">{(it.offer_id && offersMap?.[it.offer_id]) || "—"}</TableCell>
                          <TableCell className="text-center font-mono text-xs">{fmt(it.expected)}</TableCell>
                          <TableCell className="text-center font-mono text-xs">{fmt(it.actual)}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {formatDateEn(it.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}