import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, Search, AlertTriangle, Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  useInvestigations,
  SEVERITY_META,
  STATUS_META,
  type InvestigationStatus,
} from '@/hooks/useInvestigations';

const Investigations: React.FC = () => {
  const { dir } = useLanguage();
  const navigate = useNavigate();
  const [status, setStatus] = useState<InvestigationStatus | 'all'>('all');
  const { data: cases = [], isLoading } = useInvestigations({ status });

  return (
    <div className="p-4 space-y-4" dir={dir}>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
          <ChevronLeft className="w-4 h-4" /> رجوع
        </Button>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Search className="w-5 h-5" /> قضايا التحقيق
        </h2>
        <div />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">الحالة:</span>
        {(['all', 'open', 'in_progress', 'concluded'] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? 'default' : 'outline'}
            onClick={() => setStatus(s)}
          >
            {s === 'all' ? 'الكل' : STATUS_META[s].ar}
          </Button>
        ))}
      </div>

      <ScrollArea className="max-h-[75vh]">
        <div className="space-y-2">
          {isLoading && <p className="text-center text-sm text-muted-foreground py-8">جاري التحميل...</p>}
          {!isLoading && cases.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">لا توجد قضايا</p>
          )}
          {cases.map((c) => {
            const overdue =
              c.deadline && c.status !== 'concluded' && differenceInDays(new Date(c.deadline), new Date()) < 0;
            const sev = SEVERITY_META[c.severity];
            const st = STATUS_META[c.status];
            return (
              <Card
                key={c.id}
                className="p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => navigate(`/admin/investigations/${c.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">#{c.case_number}</span>
                      <Badge variant="outline" className={`text-[10px] ${st.cls}`}>{st.ar}</Badge>
                      <Badge variant="outline" className={`text-[10px] ${sev.cls}`}>خطورة {sev.ar}</Badge>
                      {overdue && (
                        <Badge variant="outline" className="text-[10px] bg-red-100 text-red-700 border-red-300 gap-1">
                          <AlertTriangle className="w-3 h-3" /> متأخرة
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-semibold mt-1 truncate">{c.title}</p>
                    {c.summary && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.summary}</p>
                    )}
                  </div>
                  <div className="text-left text-[10px] text-muted-foreground shrink-0 space-y-0.5">
                    <div>{format(new Date(c.opened_at), 'dd/MM/yyyy')}</div>
                    {c.deadline && (
                      <div className="flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {format(new Date(c.deadline), 'dd/MM/yyyy')}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default Investigations;
