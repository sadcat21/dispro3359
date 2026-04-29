import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileText, Trash2, Download, Search, Loader2, FolderOpen, Eye, Upload, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { isAdminRole } from '@/lib/utils';

interface SharedInvoiceRow {
  id: string;
  customer_name: string;
  invoice_number: string;
  invoice_date: string;
  pdf_path: string;
  pdf_url: string;
  target_branch_id: string | null;
  uploaded_by: string | null;
  notes: string | null;
  created_at: string;
  branches?: { name: string } | null;
}

const SharedInvoices: React.FC = () => {
  const { workerId, role } = useAuth();
  const { t, dir } = useLanguage();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SharedInvoiceRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [targetBranch, setTargetBranch] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const isAdmin = isAdminRole(role);
  const canUpload = isAdmin; // المدير العام / مساعد المدير العام

  const { data: branches } = useQuery({
    queryKey: ['branches-for-shared'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: canUpload,
  });

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['shared-invoices-list', workerId, isAdmin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_invoices')
        .select('*, branches:target_branch_id(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as SharedInvoiceRow[];
    },
    enabled: !!workerId,
  });

  const resetForm = () => {
    setCustomerName(''); setInvoiceNumber(''); setInvoiceDate(new Date().toISOString().slice(0, 10));
    setTargetBranch(''); setNotes(''); setFile(null);
  };

  const handleUpload = async () => {
    if (!customerName.trim() || !invoiceNumber.trim() || !invoiceDate || !file) {
      toast.error(t('shared_invoices.required_fields'));
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const folder = targetBranch || 'all';
      const path = `${folder}/${Date.now()}-${invoiceNumber.replace(/[^\w-]/g, '_')}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('shared-invoices')
        .upload(path, file, { contentType: file.type || 'application/pdf', upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('shared-invoices').getPublicUrl(path);

      const { error: insErr } = await supabase.from('shared_invoices').insert({
        customer_name: customerName.trim(),
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        pdf_path: path,
        pdf_url: pub.publicUrl,
        target_branch_id: targetBranch || null,
        uploaded_by: workerId,
        notes: notes.trim() || null,
      });
      if (insErr) throw insErr;

      toast.success(t('shared_invoices.upload_success'));
      qc.invalidateQueries({ queryKey: ['shared-invoices-list'] });
      resetForm();
      setUploadOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(t('shared_invoices.upload_failed'));
    } finally {
      setUploading(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (row: SharedInvoiceRow) => {
      await supabase.storage.from('shared-invoices').remove([row.pdf_path]);
      const { error } = await supabase.from('shared_invoices').delete().eq('id', row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('shared_invoices.deleted'));
      qc.invalidateQueries({ queryKey: ['shared-invoices-list'] });
      setDeleteTarget(null);
    },
    onError: () => toast.error(t('shared_invoices.delete_failed')),
  });

  const getSignedUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from('shared-invoices').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  };

  const handleDownload = async (row: SharedInvoiceRow) => {
    const url = await getSignedUrl(row.pdf_path);
    if (!url) { toast.error(t('shared_invoices.download_failed')); return; }
    await supabase.from('shared_invoices').update({
      downloaded_at: new Date().toISOString(), downloaded_by: workerId,
    }).eq('id', row.id);
    window.open(url, '_blank');
  };

  const handlePreview = async (row: SharedInvoiceRow) => {
    const url = await getSignedUrl(row.pdf_path);
    if (!url) { toast.error(t('shared_invoices.preview_failed')); return; }
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      toast.error(t('shared_invoices.preview_failed'));
    }
  };

  const formatDate = (s: string) => {
    try { return new Date(s).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return s; }
  };

  const filtered = (invoices || []).filter(r =>
    r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    r.invoice_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 space-y-4" dir={dir}>
      <div className="flex items-center gap-3 flex-wrap">
        <FolderOpen className="w-6 h-6 text-primary" />
        <h1 className="text-lg font-bold">{t('shared_invoices.title')}</h1>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{filtered.length}</span>
        <div className="flex-1" />
        {canUpload && (
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                {t('shared_invoices.upload_for_branch')}
              </Button>
            </DialogTrigger>
            <DialogContent dir={dir} className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('shared_invoices.upload_for_branch')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <Label>{t('shared_invoices.customer_name')} *</Label>
                  <Input value={customerName} onChange={e => setCustomerName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>{t('shared_invoices.invoice_number')} *</Label>
                    <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t('shared_invoices.invoice_date')} *</Label>
                    <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>{t('shared_invoices.target_branch')}</Label>
                  <Select value={targetBranch || 'all'} onValueChange={v => setTargetBranch(v === 'all' ? '' : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('shared_invoices.all_branches')}</SelectItem>
                      {(branches || []).map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('shared_invoices.notes')}</Label>
                  <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
                <div>
                  <Label>{t('shared_invoices.pdf_file')} *</Label>
                  <Input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
                  {file && <p className="text-xs text-muted-foreground mt-1">{file.name}</p>}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleUpload} disabled={uploading} className="gap-2">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? t('shared_invoices.uploading') : t('shared_invoices.upload')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t('shared_invoices.search')} value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">{t('shared_invoices.no_invoices')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('shared_invoices.share_hint')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Card key={r.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-destructive shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {r.customer_name} <span className="text-muted-foreground">— #{r.invoice_number}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.invoice_date)}
                      {r.branches?.name ? ` • ${r.branches.name}` : ` • ${t('shared_invoices.all_branches')}`}
                    </p>
                    {r.notes && <p className="text-xs text-muted-foreground truncate">{r.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(r)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(r)}>
                      <Download className="w-4 h-4" />
                    </Button>
                    {canUpload && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(r)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('shared_invoices.delete_file')}</AlertDialogTitle>
            <AlertDialogDescription>{t('shared_invoices.delete_confirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              className="bg-destructive text-destructive-foreground"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-2"
             onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}>
          <div className="bg-background rounded-lg w-full max-w-2xl flex flex-col" style={{ height: '90vh' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b shrink-0">
              <span className="text-sm font-medium">{t('shared_invoices.preview')}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => window.open(previewUrl, '_blank')}>
                  <Download className="w-4 h-4 me-1" />
                  {t('shared_invoices.open')}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}>✕</Button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <iframe src={previewUrl + '#toolbar=1&navpanes=0'} className="w-full h-full border-0" title="PDF" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedInvoices;
