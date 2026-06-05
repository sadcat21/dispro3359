import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, BookOpen, Loader2, GripVertical, Pencil, Check, X, Palette } from 'lucide-react';
import { useRegistrationTypes, RegistrationTypeEntry, RegistrationSubType, getRegistrationTypeColor } from '@/hooks/useRegistrationTypes';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EditFormState {
  ar: string;
  fr: string;
  en: string;
  short: string;
  description: string;
  bg_color: string;
  text_color: string;
}

const RegistrationTypesCard: React.FC = () => {
  const { registrationTypes, isLoading, updateTypes } = useRegistrationTypes();
  const { language } = useLanguage();
  const [newType, setNewType] = useState('');
  const [newShort, setNewShort] = useState('');
  const [newBgColor, setNewBgColor] = useState('#1d4ed8');
  const [newTextColor, setNewTextColor] = useState('#ffffff');
  const [isTranslating, setIsTranslating] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({ ar: '', fr: '', en: '', short: '', description: '', bg_color: '#1d4ed8', text_color: '#ffffff' });
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleAdd = async () => {
    const trimmed = newType.trim();
    if (!trimmed) return;
    if (registrationTypes.some(t => t.ar === trimmed || t.fr === trimmed || t.en === trimmed)) {
      toast.error('هذا النوع موجود بالفعل');
      return;
    }
    setIsTranslating(true);
    try {
      const sourceLang = language;
      const targetLangs = (['ar', 'fr', 'en'] as const).filter(l => l !== sourceLang);
      const { data: translateData, error: translateError } = await supabase.functions.invoke('translate-text', {
        body: { text: trimmed, sourceLang, targetLangs, mode: 'translate' },
      });
      let entry: RegistrationTypeEntry;
      if (translateError || !translateData?.translations) {
        entry = { ar: trimmed, fr: trimmed, en: trimmed, short: newShort.trim() || '', description: '', bg_color: newBgColor, text_color: newTextColor };
      } else {
        entry = {
          ar: sourceLang === 'ar' ? trimmed : (translateData.translations.ar || trimmed),
          fr: sourceLang === 'fr' ? trimmed : (translateData.translations.fr || trimmed),
          en: sourceLang === 'en' ? trimmed : (translateData.translations.en || trimmed),
          short: newShort.trim() || '',
          description: '',
          bg_color: newBgColor,
          text_color: newTextColor,
        };
      }
      await updateTypes.mutateAsync([...registrationTypes, entry]);
      setNewType('');
      setNewShort('');
      toast.success('تم إضافة النوع بنجاح');
    } catch {
      toast.error('فشل في الإضافة');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleRemove = async (entry: RegistrationTypeEntry) => {
    try {
      await updateTypes.mutateAsync(registrationTypes.filter(t => t.ar !== entry.ar));
      toast.success('تم حذف النوع');
    } catch {
      toast.error('فشل في الحذف');
    }
  };

  const handleEditStart = (index: number) => {
    const t = registrationTypes[index];
    setEditingIndex(index);
    setEditForm({ ar: t.ar, fr: t.fr, en: t.en, short: t.short || '', description: t.description || '', bg_color: t.bg_color || '#1d4ed8', text_color: t.text_color || '#ffffff' });
  };

  const handleEditCancel = () => {
    setEditingIndex(null);
  };

  const handleEditSave = async () => {
    if (editingIndex === null) return;
    if (!editForm.ar.trim() && !editForm.fr.trim() && !editForm.en.trim()) {
      toast.error('يجب ملء حقل واحد على الأقل');
      return;
    }
    try {
      const updated = [...registrationTypes];
      updated[editingIndex] = {
        ar: editForm.ar.trim(),
        fr: editForm.fr.trim(),
        en: editForm.en.trim(),
        short: editForm.short.trim(),
        description: editForm.description.trim(),
        bg_color: editForm.bg_color,
        text_color: editForm.text_color,
      };
      await updateTypes.mutateAsync(updated);
      setEditingIndex(null);
      toast.success('تم التحديث');
    } catch {
      toast.error('فشل في التحديث');
    }
  };

  const handleDragStart = (i: number) => { dragItem.current = i; };
  const handleDragEnter = (i: number) => { dragOverItem.current = i; };
  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      dragItem.current = null; dragOverItem.current = null; return;
    }
    const reordered = [...registrationTypes];
    const [removed] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, removed);
    dragItem.current = null; dragOverItem.current = null;
    try { await updateTypes.mutateAsync(reordered); } catch { toast.error('فشل في الترتيب'); }
  };

  const isPending = updateTypes.isPending || isTranslating;
  const [newSubInputs, setNewSubInputs] = useState<Record<number, string>>({});

  const handleAddSubType = async (index: number) => {
    const val = (newSubInputs[index] || '').trim();
    if (!val) return;
    const entry = registrationTypes[index];
    const existing = entry.sub_types || [];
    if (existing.some(s => s.ar === val)) {
      toast.error('هذا النوع الفرعي موجود');
      return;
    }
    try {
      const updated = [...registrationTypes];
      updated[index] = { ...entry, sub_types: [...existing, { ar: val }] };
      await updateTypes.mutateAsync(updated);
      setNewSubInputs({ ...newSubInputs, [index]: '' });
    } catch {
      toast.error('فشل في الإضافة');
    }
  };

  const handleRemoveSubType = async (index: number, subAr: string) => {
    const entry = registrationTypes[index];
    try {
      const updated = [...registrationTypes];
      updated[index] = { ...entry, sub_types: (entry.sub_types || []).filter(s => s.ar !== subAr) };
      await updateTypes.mutateAsync(updated);
    } catch {
      toast.error('فشل في الحذف');
    }
  };

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="w-5 h-5" />
          أنواع السجل (الملف التجاري)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          {registrationTypes.map((entry, index) => (
            <div
              key={entry.ar + index}
              draggable={editingIndex !== index}
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className="rounded-lg border bg-card"
            >
              {editingIndex === index ? (
                <div className="p-3 space-y-2">
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-6 shrink-0">🇩🇿</span>
                      <Input value={editForm.ar} onChange={(e) => setEditForm({ ...editForm, ar: e.target.value })} placeholder="عربي" className="flex-1 h-8 text-sm" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-6 shrink-0">🇫🇷</span>
                      <Input value={editForm.fr} onChange={(e) => setEditForm({ ...editForm, fr: e.target.value })} placeholder="Français" dir="ltr" className="flex-1 h-8 text-sm" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-6 shrink-0">🇺🇸</span>
                      <Input value={editForm.en} onChange={(e) => setEditForm({ ...editForm, en: e.target.value })} placeholder="English" dir="ltr" className="flex-1 h-8 text-sm" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-6 shrink-0 font-bold">🔤</span>
                      <Input value={editForm.short} onChange={(e) => setEditForm({ ...editForm, short: e.target.value })} placeholder="اختصار" dir="ltr" className="flex-1 h-8 text-sm" maxLength={10} />
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs w-6 shrink-0 mt-2">📝</span>
                      <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="وصف" className="flex-1 text-sm min-h-[60px]" rows={2} />
                    </div>
                    <div className="flex items-center gap-3">
                      <Palette className="w-4 h-4 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <label className="text-xs">لون الزر</label>
                        <input type="color" value={editForm.bg_color} onChange={(e) => setEditForm({ ...editForm, bg_color: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs">لون الكتابة</label>
                        <input type="color" value={editForm.text_color} onChange={(e) => setEditForm({ ...editForm, text_color: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                      </div>
                      <div className="px-3 py-1 rounded text-xs font-mono uppercase" style={{ backgroundColor: editForm.bg_color, color: editForm.text_color }}>
                        {editForm.short || 'معاينة'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={handleEditCancel} disabled={isPending}><X className="w-3.5 h-3.5 me-1" />إلغاء</Button>
                    <Button size="sm" onClick={handleEditSave} disabled={isPending}>
                      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1" /> : <Check className="w-3.5 h-3.5 me-1" />}
                      حفظ
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 p-2.5 hover:bg-accent/50 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{(entry as any)[language] || entry.ar}</span>
                        {entry.short && (() => {
                          const c = getRegistrationTypeColor(index, entry);
                          return (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase" style={{ backgroundColor: c.bg, color: c.text }}>
                              {entry.short}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex gap-3 text-[11px] text-muted-foreground mt-0.5">
                        <span>🇩🇿 {entry.ar}</span>
                        <span>🇫🇷 {entry.fr}</span>
                        <span>🇺🇸 {entry.en}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditStart(index)} disabled={isPending}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => handleRemove(entry)} disabled={isPending}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="px-2.5 pb-2.5 pt-1 border-t bg-muted/30">
                    <div className="text-[11px] text-muted-foreground mb-1.5">أنواع البيع الفرعية (اختيار متعدد)</div>
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {(entry.sub_types || []).map(st => (
                        <span key={st.ar} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs">
                          {st.ar}
                          <button type="button" onClick={() => handleRemoveSubType(index, st.ar)} className="hover:text-destructive" disabled={isPending}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {(!entry.sub_types || entry.sub_types.length === 0) && (
                        <span className="text-[11px] text-muted-foreground italic">لا يوجد (مثل: تجزئة، جملة)</span>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        value={newSubInputs[index] || ''}
                        onChange={(e) => setNewSubInputs({ ...newSubInputs, [index]: e.target.value })}
                        placeholder="نوع فرعي جديد..."
                        className="h-7 text-xs flex-1"
                        disabled={isPending}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubType(index))}
                      />
                      <Button size="sm" className="h-7 px-2" onClick={() => handleAddSubType(index)} disabled={!(newSubInputs[index] || '').trim() || isPending}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t pt-3">
          <div className="flex gap-2">
            <Input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="نوع سجل جديد..." className="text-right flex-1" disabled={isPending} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())} />
            <Input value={newShort} onChange={(e) => setNewShort(e.target.value)} placeholder="اختصار" className="w-20 text-center font-mono" disabled={isPending} maxLength={10} dir="ltr" />
            <Button size="sm" onClick={handleAdd} disabled={!newType.trim() || isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Palette className="w-4 h-4 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <label className="text-xs">لون الزر</label>
              <input type="color" value={newBgColor} onChange={(e) => setNewBgColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs">لون الكتابة</label>
              <input type="color" value={newTextColor} onChange={(e) => setNewTextColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
            </div>
            <div className="px-3 py-1 rounded text-xs font-mono uppercase" style={{ backgroundColor: newBgColor, color: newTextColor }}>
              {newShort || 'معاينة'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RegistrationTypesCard;
