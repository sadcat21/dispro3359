import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Users, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  store_name?: string | null;
  sector_id?: string | null;
  created_at: string;
}

interface Group {
  key: string;
  name: string;
  phone: string;
  rows: CustomerRow[];
}

const normPhone = (p: string | null | undefined) =>
  (p || '').replace(/\s+/g, '').trim();

export default function DuplicateCustomers() {
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [keepSelection, setKeepSelection] = useState<Record<string, string>>({});
  const [sectors, setSectors] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [{ data: customers, error }, { data: secs }] = await Promise.all([
      supabase.from('customers').select('id, name, phone, store_name, sector_id, created_at').limit(10000),
      supabase.from('sectors').select('id, name').limit(2000),
    ]);
    if (error) {
      toast.error('فشل تحميل العملاء');
      setLoading(false);
      return;
    }
    const secMap: Record<string, string> = {};
    (secs || []).forEach((s: any) => { secMap[s.id] = s.name; });
    setSectors(secMap);

    const map = new Map<string, CustomerRow[]>();
    (customers || []).forEach((c: any) => {
      const name = (c.name || '').trim();
      const phone = normPhone(c.phone);
      if (!name || !phone) return;
      const key = `${name}||${phone}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });

    const dupGroups: Group[] = [];
    map.forEach((rows, key) => {
      if (rows.length > 1) {
        const [name, phone] = key.split('||');
        dupGroups.push({ key, name, phone, rows: rows.sort((a, b) => a.created_at.localeCompare(b.created_at)) });
      }
    });
    dupGroups.sort((a, b) => b.rows.length - a.rows.length);
    setGroups(dupGroups);

    const initialKeep: Record<string, string> = {};
    dupGroups.forEach(g => { initialKeep[g.key] = g.rows[0].id; });
    setKeepSelection(initialKeep);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const merge = async (g: Group) => {
    const keepId = keepSelection[g.key];
    if (!keepId) {
      toast.error('اختر السجل الذي تريد الاحتفاظ به');
      return;
    }
    const dropIds = g.rows.filter(r => r.id !== keepId).map(r => r.id);
    if (!dropIds.length) return;
    if (!confirm(`سيتم دمج ${dropIds.length} سجل في السجل المحدد. هل أنت متأكد؟`)) return;
    setMerging(g.key);
    const { error } = await supabase.rpc('merge_customers' as any, { keep_id: keepId, drop_ids: dropIds });
    setMerging(null);
    if (error) {
      toast.error('فشل الدمج: ' + error.message);
      return;
    }
    toast.success('تم الدمج بنجاح');
    setGroups(prev => prev.filter(x => x.key !== g.key));
  };

  const totalDuplicates = useMemo(
    () => groups.reduce((sum, g) => sum + (g.rows.length - 1), 0),
    [groups]
  );

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">دمج العملاء المكررين</h1>
        </div>
        <div className="text-sm text-muted-foreground">
          {groups.length} مجموعة • {totalDuplicates} سجل زائد
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : groups.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" />
          <p className="text-lg">لا توجد تكرارات</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <Card key={g.key} className="p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <div className="font-semibold">{g.name}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">{g.phone}</div>
                </div>
                <Button
                  size="sm"
                  onClick={() => merge(g)}
                  disabled={merging === g.key}
                >
                  {merging === g.key && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  دمج ({g.rows.length - 1})
                </Button>
              </div>
              <div className="space-y-2">
                {g.rows.map(r => (
                  <label
                    key={r.id}
                    className={`flex items-center gap-3 p-2 rounded border cursor-pointer hover:bg-muted/50 ${
                      keepSelection[g.key] === r.id ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`keep-${g.key}`}
                      checked={keepSelection[g.key] === r.id}
                      onChange={() => setKeepSelection(s => ({ ...s, [g.key]: r.id }))}
                    />
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <span className="text-muted-foreground">المحل: <span className="text-foreground">{r.store_name || '—'}</span></span>
                      <span className="text-muted-foreground">القطاع: <span className="text-foreground">{r.sector_id ? sectors[r.sector_id] || '—' : '—'}</span></span>
                      <span className="text-muted-foreground">التاريخ: <span className="text-foreground">{format(new Date(r.created_at), 'yyyy-MM-dd')}</span></span>
                      <span className="text-muted-foreground text-xs" dir="ltr">{r.id.slice(0, 8)}…</span>
                    </div>
                    {keepSelection[g.key] === r.id && (
                      <span className="text-xs text-primary font-medium">يُحتفظ به</span>
                    )}
                  </label>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
