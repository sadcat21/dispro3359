import { useMemo, useState } from 'react';
import { useSalesTracking, aggregateSalesByProduct, SalesTrackingRow } from '@/hooks/useSalesTracking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Gift, TrendingUp, Truck, Store, Warehouse, Search, CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const SOURCE_META: Record<string, { label: string; icon: any; className: string }> = {
  direct_sale: { label: 'Vente directe', icon: Store, className: 'bg-primary/10 text-primary border-primary/30' },
  delivery_sale: { label: 'Livraison', icon: Truck, className: 'bg-accent/10 text-accent-foreground border-accent/30' },
  warehouse_sale: { label: 'Dépôt', icon: Warehouse, className: 'bg-secondary text-secondary-foreground border-border' },
};

const fmtQty = (boxes: number, pieces: number) => {
  if (!boxes && !pieces) return '—';
  if (!pieces) return `${boxes} c`;
  if (!boxes) return `${pieces} p`;
  return `${boxes} c + ${pieces} p`;
};

const fmtBP = (boxes: number, pieces: number) => {
  if (!boxes && !pieces) return '—';
  return `${boxes || 0}.${pieces || 0}`;
};

export default function SalesTrackingLedger() {
  const [source, setSource] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [workerId, setWorkerId] = useState<string>('all');
  const [productId, setProductId] = useState<string>('all');
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const { data: rows = [], isLoading } = useSalesTracking({
    source: source === 'all' ? undefined : (source as any),
    from: fromDate ? fromDate.toISOString() : undefined,
    to: toDate ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000).toISOString() : undefined,
  });

  const workerOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.worker_id) m.set(r.worker_id, r.worker_name || '—');
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const productOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.product_id) m.set(r.product_id, r.product_name || '—');
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (workerId !== 'all' && r.worker_id !== workerId) return false;
      if (productId !== 'all' && r.product_id !== productId) return false;
      if (s) {
        const hit = [r.product_name, r.worker_name, r.customer_name, r.branch_name]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(s));
        if (!hit) return false;
      }
      return true;
    });
  }, [rows, search, workerId, productId]);

  const stats = useMemo(() => {
    const acc = { total: 0, boxes: 0, pieces: 0, giftBoxes: 0, giftPieces: 0, amount: 0 };
    for (const r of filtered) {
      acc.total += 1;
      acc.boxes += r.sold_boxes || 0;
      acc.pieces += r.sold_pieces || 0;
      acc.giftBoxes += r.gift_boxes || 0;
      acc.giftPieces += r.gift_pieces || 0;
      acc.amount += Number(r.total_price || 0);
    }
    return acc;
  }, [filtered]);

  const byProduct = useMemo(() => aggregateSalesByProduct(filtered), [filtered]);

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Suivi des ventes</h1>
          <p className="text-sm text-muted-foreground">Toutes les ventes et cadeaux par source</p>
        </div>
        <Badge variant="outline" className="text-sm">{filtered.length} enregistrements</Badge>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={TrendingUp} label="Chiffre d'affaires" value={`${stats.amount.toLocaleString()} DA`} accent="primary" />
        <StatCard icon={Package} label="Quantités vendues" value={fmtQty(stats.boxes, stats.pieces)} />
        <StatCard icon={Gift} label="Cadeaux" value={fmtQty(stats.giftBoxes, stats.giftPieces)} accent="accent" />
        <StatCard icon={Store} label="Nombre d'opérations" value={stats.total.toString()} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher (produit, employé, client, dépôt)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les sources</SelectItem>
              <SelectItem value="direct_sale">Vente directe</SelectItem>
              <SelectItem value="delivery_sale">Livraison</SelectItem>
              <SelectItem value="warehouse_sale">Dépôt</SelectItem>
            </SelectContent>
          </Select>
          <Select value={workerId} onValueChange={setWorkerId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="البائع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل البائعين</SelectItem>
              {workerOptions.map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="المنتج" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المنتجات</SelectItem>
              {productOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('w-[160px] justify-start font-normal', !fromDate && 'text-muted-foreground')}>
                <CalendarIcon className="ml-2 h-4 w-4" />
                {fromDate ? format(fromDate, 'yyyy-MM-dd') : 'من تاريخ'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus className={cn('p-3 pointer-events-auto')} />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('w-[160px] justify-start font-normal', !toDate && 'text-muted-foreground')}>
                <CalendarIcon className="ml-2 h-4 w-4" />
                {toDate ? format(toDate, 'yyyy-MM-dd') : 'إلى تاريخ'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus className={cn('p-3 pointer-events-auto')} />
            </PopoverContent>
          </Popover>
          {(fromDate || toDate) && (
            <Button variant="ghost" size="icon" onClick={() => { setFromDate(undefined); setToDate(undefined); }}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="rows">
        <TabsList>
          <TabsTrigger value="rows">Opérations</TabsTrigger>
          <TabsTrigger value="products">Par produit</TabsTrigger>
        </TabsList>

        <TabsContent value="rows">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Chargement...</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Aucune donnée</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Vendu</TableHead>
                      <TableHead className="text-center">B.P</TableHead>
                      <TableHead>Cadeau</TableHead>
                      <TableHead className="text-center">B.P</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead className="text-center">B.P</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Employé</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Dépôt</TableHead>
                    </TableRow>
                    <TotalsRowOps stats={stats} />
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 500).map((r) => <RowItem key={r.id} r={r} />)}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Vendu</TableHead>
                    <TableHead className="text-center">B.P</TableHead>
                    <TableHead>Cadeau</TableHead>
                    <TableHead className="text-center">B.P</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="text-center">B.P</TableHead>
                    <TableHead>Montant</TableHead>
                  </TableRow>
                    <TotalsRowProducts byProduct={byProduct} />
                </TableHeader>
                <TableBody>
                  {byProduct.map((p) => (
                    <TableRow key={p.productId}>
                      <TableCell className="font-medium">{p.productName || '—'}</TableCell>
                      <TableCell>{fmtQty(p.soldBoxes, p.soldPieces)}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{fmtBP(p.soldBoxes, p.soldPieces)}</TableCell>
                      <TableCell className="font-medium">{fmtQty(p.giftBoxes, p.giftPieces)}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{fmtBP(p.giftBoxes, p.giftPieces)}</TableCell>
                      <TableCell className="font-semibold">{fmtQty(p.totalBoxes, p.totalPieces)}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{fmtBP(p.totalBoxes, p.totalPieces)}</TableCell>
                      <TableCell>{p.totalAmount.toLocaleString()} DA</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: 'primary' | 'accent' }) {
  const tone = accent === 'primary' ? 'from-primary/15 to-primary/5 border-primary/20'
    : accent === 'accent' ? 'from-accent/15 to-accent/5 border-accent/20'
    : 'from-secondary to-background border-border';
  return (
    <Card className={`bg-gradient-to-br ${tone}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <Icon className="h-4 w-4" /> {label}
        </div>
        <div className="text-lg font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function RowItem({ r }: { r: SalesTrackingRow }) {
  // moved below
  const meta = SOURCE_META[r.source] || SOURCE_META.direct_sale;
  const Icon = meta.icon;
  return (
    <TableRow>
      <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.sold_at), 'yyyy-MM-dd HH:mm')}</TableCell>
      <TableCell>
        <Badge variant="outline" className={`${meta.className} gap-1`}>
          <Icon className="h-3 w-3" /> {meta.label}
        </Badge>
      </TableCell>
      <TableCell className="font-medium">{r.product_name || '—'}</TableCell>
      <TableCell>{fmtQty(r.sold_boxes, r.sold_pieces)}</TableCell>
      <TableCell className="text-center font-mono text-xs">{fmtBP(r.sold_boxes, r.sold_pieces)}</TableCell>
      <TableCell>
        {(r.gift_boxes || r.gift_pieces) ? (
          <Badge variant="outline" className="bg-accent/10 text-foreground border-accent/40 gap-1">
            <Gift className="h-3 w-3" /> {fmtQty(r.gift_boxes, r.gift_pieces)}
          </Badge>
        ) : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-center font-mono text-xs">{fmtBP(r.gift_boxes, r.gift_pieces)}</TableCell>
      <TableCell className="font-semibold">{fmtQty(r.total_boxes, r.total_pieces)}</TableCell>
      <TableCell className="text-center font-mono text-xs">{fmtBP(r.total_boxes, r.total_pieces)}</TableCell>
      <TableCell className="whitespace-nowrap">{Number(r.total_price || 0).toLocaleString()} DA</TableCell>
      <TableCell className="text-xs">{r.worker_name || '—'}</TableCell>
      <TableCell className="text-xs">{r.customer_name || '—'}</TableCell>
      <TableCell className="text-xs">{r.branch_name || '—'}</TableCell>
    </TableRow>
  );
}

function TotalsRowOps({ stats }: { stats: { total: number; boxes: number; pieces: number; giftBoxes: number; giftPieces: number; amount: number } }) {
  const totalBoxes = stats.boxes + stats.giftBoxes;
  const totalPieces = stats.pieces + stats.giftPieces;
  return (
    <TableRow className="bg-muted/60 font-semibold">
      <TableCell colSpan={3} className="text-xs">المجموع ({stats.total})</TableCell>
      <TableCell>{fmtQty(stats.boxes, stats.pieces)}</TableCell>
      <TableCell className="text-center font-mono text-xs">{fmtBP(stats.boxes, stats.pieces)}</TableCell>
      <TableCell>{fmtQty(stats.giftBoxes, stats.giftPieces)}</TableCell>
      <TableCell className="text-center font-mono text-xs">{fmtBP(stats.giftBoxes, stats.giftPieces)}</TableCell>
      <TableCell>{fmtQty(totalBoxes, totalPieces)}</TableCell>
      <TableCell className="text-center font-mono text-xs">{fmtBP(totalBoxes, totalPieces)}</TableCell>
      <TableCell className="whitespace-nowrap">{stats.amount.toLocaleString()} DA</TableCell>
      <TableCell colSpan={3} />
    </TableRow>
  );
}

function TotalsRowProducts({ byProduct }: { byProduct: Array<{ soldBoxes: number; soldPieces: number; giftBoxes: number; giftPieces: number; totalBoxes: number; totalPieces: number; totalAmount: number }> }) {
  const t = byProduct.reduce(
    (a, p) => ({
      sB: a.sB + p.soldBoxes, sP: a.sP + p.soldPieces,
      gB: a.gB + p.giftBoxes, gP: a.gP + p.giftPieces,
      tB: a.tB + p.totalBoxes, tP: a.tP + p.totalPieces,
      amt: a.amt + p.totalAmount,
    }),
    { sB: 0, sP: 0, gB: 0, gP: 0, tB: 0, tP: 0, amt: 0 },
  );
  return (
    <TableRow className="bg-muted/60 font-semibold">
      <TableCell className="text-xs">المجموع ({byProduct.length})</TableCell>
      <TableCell>{fmtQty(t.sB, t.sP)}</TableCell>
      <TableCell className="text-center font-mono text-xs">{fmtBP(t.sB, t.sP)}</TableCell>
      <TableCell>{fmtQty(t.gB, t.gP)}</TableCell>
      <TableCell className="text-center font-mono text-xs">{fmtBP(t.gB, t.gP)}</TableCell>
      <TableCell>{fmtQty(t.tB, t.tP)}</TableCell>
      <TableCell className="text-center font-mono text-xs">{fmtBP(t.tB, t.tP)}</TableCell>
      <TableCell className="whitespace-nowrap">{t.amt.toLocaleString()} DA</TableCell>
    </TableRow>
  );
}
