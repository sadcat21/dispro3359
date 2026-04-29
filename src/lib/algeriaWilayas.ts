// خريطة ولايات الجزائر: الاسم العربي/الفرنسي → الرقم الرسمي
// تستخدم لعرض شارات حماية الفروع في هيدر مساعد المدير العام

const RAW: Array<[number, string[]]> = [
  [1, ['أدرار', 'adrar']],
  [2, ['الشلف', 'chlef']],
  [3, ['الأغواط', 'laghouat']],
  [4, ['أم البواقي', 'oum el bouaghi', 'oum el-bouaghi']],
  [5, ['باتنة', 'batna']],
  [6, ['بجاية', 'béjaïa', 'bejaia']],
  [7, ['بسكرة', 'biskra']],
  [8, ['بشار', 'béchar', 'bechar']],
  [9, ['البليدة', 'blida']],
  [10, ['البويرة', 'bouira']],
  [11, ['تمنراست', 'tamanrasset']],
  [12, ['تبسة', 'tébessa', 'tebessa']],
  [13, ['تلمسان', 'tlemcen']],
  [14, ['تيارت', 'tiaret']],
  [15, ['تيزي وزو', 'tizi ouzou', 'tizi-ouzou']],
  [16, ['الجزائر', 'alger', 'algiers']],
  [17, ['الجلفة', 'djelfa']],
  [18, ['جيجل', 'jijel']],
  [19, ['سطيف', 'sétif', 'setif']],
  [20, ['سعيدة', 'saïda', 'saida']],
  [21, ['سكيكدة', 'skikda']],
  [22, ['سيدي بلعباس', 'sidi bel abbès', 'sidi bel abbes']],
  [23, ['عنابة', 'annaba']],
  [24, ['قالمة', 'guelma']],
  [25, ['قسنطينة', 'constantine']],
  [26, ['المدية', 'médéa', 'medea']],
  [27, ['مستغانم', 'mostaganem']],
  [28, ['المسيلة', 'msila', "m'sila"]],
  [29, ['معسكر', 'mascara']],
  [30, ['ورقلة', 'ouargla']],
  [31, ['وهران', 'oran']],
  [32, ['البيض', 'el bayadh']],
  [33, ['إليزي', 'illizi']],
  [34, ['برج بوعريريج', 'bordj bou arréridj', 'bordj bou arreridj']],
  [35, ['بومرداس', 'boumerdès', 'boumerdes']],
  [36, ['الطارف', 'el tarf', 'el-tarf']],
  [37, ['تندوف', 'tindouf']],
  [38, ['تيسمسيلت', 'tissemsilt']],
  [39, ['الوادي', 'el oued']],
  [40, ['خنشلة', 'khenchela']],
  [41, ['سوق أهراس', 'souk ahras']],
  [42, ['تيبازة', 'tipaza', 'tipasa']],
  [43, ['ميلة', 'mila']],
  [44, ['عين الدفلى', 'aïn defla', 'ain defla']],
  [45, ['النعامة', 'naâma', 'naama']],
  [46, ['عين تموشنت', 'aïn témouchent', 'ain temouchent']],
  [47, ['غرداية', 'ghardaïa', 'ghardaia']],
  [48, ['غليزان', 'relizane']],
  [49, ['تيميمون', 'timimoun']],
  [50, ['برج باجي مختار', 'bordj badji mokhtar']],
  [51, ['أولاد جلال', 'ouled djellal']],
  [52, ['بني عباس', 'béni abbès', 'beni abbes']],
  [53, ['عين صالح', 'in salah']],
  [54, ['عين قزام', 'in guezzam']],
  [55, ['تقرت', 'touggourt']],
  [56, ['جانت', 'djanet']],
  [57, ['المغير', 'el mghair', 'el m\'ghair']],
  [58, ['المنيعة', 'el meniaa']],
];

const NORMALIZE = (s: string) =>
  s.toLowerCase().trim()
    .replace(/[ـ]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/ة/g, 'ه');

const MAP = new Map<string, number>();
RAW.forEach(([num, names]) => {
  names.forEach(n => MAP.set(NORMALIZE(n), num));
});

export const getWilayaCode = (wilaya?: string | null): number | null => {
  if (!wilaya) return null;
  const norm = NORMALIZE(wilaya);
  if (MAP.has(norm)) return MAP.get(norm)!;
  // محاولة contains
  for (const [key, val] of MAP.entries()) {
    if (norm.includes(key) || key.includes(norm)) return val;
  }
  return null;
};

// لون مميز لكل ولاية (مستقر بناءً على الرقم)
const PALETTE = [
  { bg: 'bg-blue-500', ring: 'ring-blue-300', text: 'text-white', hex: '#3b82f6' },
  { bg: 'bg-emerald-500', ring: 'ring-emerald-300', text: 'text-white', hex: '#10b981' },
  { bg: 'bg-purple-500', ring: 'ring-purple-300', text: 'text-white', hex: '#a855f7' },
  { bg: 'bg-orange-500', ring: 'ring-orange-300', text: 'text-white', hex: '#f97316' },
  { bg: 'bg-pink-500', ring: 'ring-pink-300', text: 'text-white', hex: '#ec4899' },
  { bg: 'bg-cyan-500', ring: 'ring-cyan-300', text: 'text-white', hex: '#06b6d4' },
  { bg: 'bg-indigo-500', ring: 'ring-indigo-300', text: 'text-white', hex: '#6366f1' },
  { bg: 'bg-teal-500', ring: 'ring-teal-300', text: 'text-white', hex: '#14b8a6' },
  { bg: 'bg-rose-500', ring: 'ring-rose-300', text: 'text-white', hex: '#f43f5e' },
  { bg: 'bg-amber-500', ring: 'ring-amber-300', text: 'text-white', hex: '#f59e0b' },
];

export const getWilayaColor = (code: number | null) => {
  if (code === null) return PALETTE[0];
  return PALETTE[code % PALETTE.length];
};
