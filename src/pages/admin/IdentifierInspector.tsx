import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Package, User, ShoppingCart, Tag, Clock, Search, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ParsedIds {
  product_id?: string;
  gift_product_id?: string;
  offer_id?: string;
  order_id?: string;
  customer_id?: string;
  created_at?: string;
  [k: string]: string | undefined;
}

interface Details {
  product?: any;
  gift?: any;
  offer?: any;
  order?: any;
  customer?: any;
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function parseBlock(text: string): ParsedIds {
  const out: ParsedIds = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([a-zA-Z_][\w]*)\s*[:=]\s*(.+)$/);
    if (m) {
      out[m[1]] = m[2].trim();
    } else {
      const u = line.match(UUID_RE);
      if (u && !out.product_id) out.product_id = u[0];
    }
  }
  return out;
}

const CopyChip = ({ label, value }: { label: string; value?: string | null }) => {
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        toast.success(`تم نسخ ${label}`);
      }}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted hover:bg-muted/70 border text-xs font-mono transition-colors"
      title={`نسخ ${label}`}
    >
      <Copy className="w-3 h-3" />
      <span className="opacity-70">{label}:</span>
      <span className="truncate max-w-[180px]">{value}</span>
    </button>
  );
};

const Section = ({ icon: Icon, title, children, empty }: any) => (
  <div className="rounded-lg border bg-card p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-primary" />
      <h3 className="font-semibold text-sm">{title}</h3>
    </div>
    {empty ? (
      <p className="text-xs text-muted-foreground">لا توجد بيانات</p>
    ) : (
      <div className="space-y-1.5 text-sm">{children}</div>
    )}
  </div>
);

const Row = ({ label, value }: { label: string; value: any }) => (
  <div className="flex items-start justify-between gap-2 py-1 border-b border-border/50 last:border-0">
    <span className="text-xs text-muted-foreground shrink-0">{label}</span>
    <span className="text-xs font-medium text-end break-all">{value ?? '—'}</span>
  </div>
);

export default function IdentifierInspector() {
  const [text, setText] = useState('');
  const [details, setDetails] = useState<Details>({});
  const [loading, setLoading] = useState(false);

  const parsed = useMemo(() => parseBlock(text), [text]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const out: Details = {};
      const tasks: Promise<any>[] = [];

      if (parsed.product_id) {
        tasks.push(Promise.resolve(
          supabase.from('products').select('*').eq('id', parsed.product_id).maybeSingle()
        ).then(({ data }: any) => { out.product = data; }));
      }
      if (parsed.gift_product_id) {
        tasks.push(Promise.resolve(
          supabase.from('products').select('*').eq('id', parsed.gift_product_id).maybeSingle()
        ).then(({ data }: any) => { out.gift = data; }));
      }
      if (parsed.offer_id) {
        tasks.push(Promise.resolve(
          (supabase as any).from('product_offers').select('*').eq('id', parsed.offer_id).maybeSingle()
        ).then(({ data }: any) => { out.offer = data; }));
      }
      if (parsed.order_id) {
        tasks.push(Promise.resolve(
          (supabase as any).from('orders').select('*').eq('id', parsed.order_id).maybeSingle()
        ).then(({ data }: any) => { out.order = data; }));
      }
      if (parsed.customer_id) {
        tasks.push(Promise.resolve(
          (supabase as any).from('customers').select('*').eq('id', parsed.customer_id).maybeSingle()
        ).then(({ data }: any) => { out.customer = data; }));
      }

      if (tasks.length === 0) {
        setDetails({});
        return;
      }
      setLoading(true);
      await Promise.allSettled(tasks);
      if (!cancelled) {
        setDetails(out);
        setLoading(false);
      }
    };
    const t = setTimeout(run, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [parsed.product_id, parsed.gift_product_id, parsed.offer_id, parsed.order_id, parsed.customer_id]);

  const hasAny = Object.keys(parsed).length > 0;

  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Search className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">مستكشف المعرفات</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">ألصق كتلة المعرفات المنسوخة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`product_id: ...\noffer_id: ...\norder_id: ...\ncustomer_id: ...\ncreated_at: ...`}
            rows={6}
            className="font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                try {
                  const t = await navigator.clipboard.readText();
                  setText(t);
                } catch { toast.error('تعذّر القراءة من الحافظة'); }
              }}
            >
              لصق من الحافظة
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setText('')}>مسح</Button>
            {loading && <Badge variant="secondary" className="ms-auto animate-pulse">جاري التحميل…</Badge>}
          </div>

          {hasAny && (
            <div className="flex flex-wrap gap-2 pt-2 border-t animate-in fade-in duration-300">
              <CopyChip label="product_id" value={parsed.product_id} />
              <CopyChip label="gift_product_id" value={parsed.gift_product_id} />
              <CopyChip label="offer_id" value={parsed.offer_id} />
              <CopyChip label="order_id" value={parsed.order_id} />
              <CopyChip label="customer_id" value={parsed.customer_id} />
              <CopyChip label="created_at" value={parsed.created_at} />
            </div>
          )}
        </CardContent>
      </Card>

      {hasAny && (
        <Tabs defaultValue="overview" className="animate-in fade-in duration-300">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="product" disabled={!parsed.product_id && !parsed.gift_product_id}>المنتج</TabsTrigger>
            <TabsTrigger value="offer" disabled={!parsed.offer_id}>العرض</TabsTrigger>
            <TabsTrigger value="order" disabled={!parsed.order_id}>الطلبية</TabsTrigger>
            <TabsTrigger value="customer" disabled={!parsed.customer_id}>العميل</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-3 grid gap-3 md:grid-cols-2 data-[state=active]:animate-in data-[state=active]:fade-in">
            {parsed.product_id && (
              <Section icon={Package} title="المنتج" empty={!details.product}>
                <Row label="الاسم" value={details.product?.name} />
                <Row label="الكود" value={details.product?.product_code} />
                <Row label="السعر" value={details.product?.price} />
              </Section>
            )}
            {parsed.gift_product_id && (
              <Section icon={Gift} title="منتج الهدية" empty={!details.gift}>
                <Row label="الاسم" value={details.gift?.name} />
                <Row label="الكود" value={details.gift?.product_code} />
              </Section>
            )}
            {parsed.offer_id && (
              <Section icon={Tag} title="العرض" empty={!details.offer}>
                <Row label="النوع" value={details.offer?.offer_type} />
                <Row label="مفعّل" value={details.offer?.is_active ? 'نعم' : 'لا'} />
              </Section>
            )}
            {parsed.order_id && (
              <Section icon={ShoppingCart} title="الطلبية" empty={!details.order}>
                <Row label="الحالة" value={details.order?.status} />
                <Row label="الإجمالي" value={details.order?.total} />
                <Row label="تاريخ الإنشاء" value={details.order?.created_at?.slice(0, 19).replace('T', ' ')} />
              </Section>
            )}
            {parsed.customer_id && (
              <Section icon={User} title="العميل" empty={!details.customer}>
                <Row label="الاسم" value={details.customer?.name || details.customer?.store_name} />
                <Row label="الهاتف" value={details.customer?.phone} />
                <Row label="الولاية" value={details.customer?.wilaya} />
              </Section>
            )}
            {parsed.created_at && (
              <Section icon={Clock} title="التوقيت">
                <Row label="created_at" value={parsed.created_at} />
                <Row label="محلي" value={(() => { try { return new Date(parsed.created_at!).toLocaleString('ar'); } catch { return '—'; } })()} />
              </Section>
            )}
          </TabsContent>

          {(['product', 'offer', 'order', 'customer'] as const).map((tab) => {
            const data =
              tab === 'product' ? details.product :
              tab === 'offer' ? details.offer :
              tab === 'order' ? details.order :
              details.customer;
            return (
              <TabsContent key={tab} value={tab} className="mt-3 data-[state=active]:animate-in data-[state=active]:fade-in">
                <Card>
                  <CardContent className="p-4">
                    {!data ? (
                      <p className="text-sm text-muted-foreground">لا توجد بيانات.</p>
                    ) : (
                      <div className="space-y-1">
                        {Object.entries(data).map(([k, v]) => (
                          <Row key={k} label={k} value={typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
