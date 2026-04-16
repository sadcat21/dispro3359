export type LandingLang = 'ar' | 'fr';

type TranslationMap = Record<string, { ar: string; fr: string }>;

export const landingT: TranslationMap = {
  // Hero
  hero_badge: { ar: 'نظامك المخصص لإدارة التوزيع', fr: 'Votre système de gestion de distribution sur mesure' },
  hero_title_1: { ar: 'بنينا لك نظاماً يفهم', fr: 'Nous avons conçu un système qui comprend' },
  hero_title_2: { ar: 'تفاصيل عملك بالكامل', fr: 'chaque détail de votre activité' },
  hero_desc: {
    ar: 'هذا النظام صُمّم خصيصاً لاحتياجاتك — المخزون، المبيعات، المحاسبة، تتبع السائقين، وإدارة الديون. كل شيء في مكان واحد، بدون فوضى ولا دفاتر.',
    fr: 'Ce système a été conçu spécialement pour vos besoins — stock, ventes, comptabilité, suivi des chauffeurs et gestion des créances. Tout en un seul endroit, sans désordre ni registres papier.',
  },
  hero_cta: { ar: 'ادخل إلى نظامك', fr: 'Accéder à votre système' },
  hero_features: { ar: 'تعرّف على كل الميزات', fr: 'Découvrir toutes les fonctionnalités' },

  // Problems
  problems_title: { ar: 'نعرف التحديات التي تواجهها يومياً', fr: 'Nous connaissons les défis que vous affrontez au quotidien' },
  problems_subtitle: { ar: 'هذه المشاكل التي كنت تعاني منها — وبنينا الحل لكل واحدة منها', fr: 'Voici les problèmes que vous rencontriez — et nous avons construit la solution pour chacun' },

  prob_stock_title: { ar: 'فقدان السيطرة على المخزون', fr: 'Perte de contrôle du stock' },
  prob_stock_desc: { ar: 'لا تعرف الكميات الحقيقية في المستودع أو عند السائقين، مما يؤدي لخسائر مالية يومية غير مرئية.', fr: 'Vous ne connaissez pas les quantités réelles en entrepôt ou chez les chauffeurs, ce qui entraîne des pertes financières quotidiennes invisibles.' },
  prob_time_title: { ar: 'ضياع الوقت في المحاسبة اليدوية', fr: 'Perte de temps en comptabilité manuelle' },
  prob_time_desc: { ar: 'ساعات يومية تُهدر في حساب المبيعات والديون والمصاريف يدوياً مع احتمالية أخطاء كبيرة.', fr: 'Des heures gaspillées chaque jour à calculer manuellement ventes, créances et dépenses avec un risque élevé d\'erreurs.' },
  prob_visibility_title: { ar: 'غياب الرؤية الميدانية', fr: 'Absence de visibilité terrain' },
  prob_visibility_desc: { ar: 'لا تعرف أين يتواجد السائقون ولا تستطيع تتبع مسار التوزيع أو أداء كل عامل بشكل حقيقي.', fr: 'Vous ne savez pas où se trouvent les chauffeurs et ne pouvez pas suivre les itinéraires ou la performance réelle de chaque employé.' },
  prob_debt_title: { ar: 'ديون العملاء المتراكمة', fr: 'Accumulation des créances clients' },
  prob_debt_desc: { ar: 'صعوبة تتبع الديون وجدولة التحصيل، مما يؤدي لتراكم مبالغ كبيرة وخسائر في التدفق النقدي.', fr: 'Difficulté à suivre les créances et planifier les recouvrements, entraînant une accumulation de montants importants et des pertes de trésorerie.' },
  prob_team_title: { ar: 'صعوبة إدارة فريق كبير', fr: 'Difficulté à gérer une grande équipe' },
  prob_team_desc: { ar: 'مع زيادة عدد السائقين والمشرفين يصبح من المستحيل متابعة الجميع بكفاءة بدون نظام متكامل.', fr: 'Avec l\'augmentation du nombre de chauffeurs et superviseurs, il devient impossible de suivre tout le monde efficacement sans système intégré.' },
  prob_data_title: { ar: 'غياب البيانات لاتخاذ القرارات', fr: 'Absence de données pour la prise de décisions' },
  prob_data_desc: { ar: 'قرارات عشوائية بدون إحصائيات دقيقة عن المبيعات، المنتجات الأكثر طلباً، وأداء المناطق.', fr: 'Des décisions aléatoires sans statistiques précises sur les ventes, les produits les plus demandés et la performance par zone.' },

  // Solutions
  solutions_title: { ar: 'ما أعددناه لك في النظام', fr: 'Ce que nous avons préparé pour vous' },
  solutions_subtitle: { ar: 'كل أداة تحتاجها موجودة ومجهّزة — فقط ابدأ باستخدامها', fr: 'Chaque outil dont vous avez besoin est prêt — il suffit de commencer à l\'utiliser' },

  sol_stock_title: { ar: 'إدارة مخزون ذكية', fr: 'Gestion intelligente du stock' },
  sol_stock_desc: { ar: 'تتبع لحظي للمخزون في المستودع وعند كل سائق. شحن وتفريغ مع محاسبة فورية وكشف الفروقات تلقائياً.', fr: 'Suivi en temps réel du stock en entrepôt et chez chaque chauffeur. Chargement et déchargement avec comptabilité instantanée et détection automatique des écarts.' },
  sol_dist_title: { ar: 'نظام توزيع متكامل', fr: 'Système de distribution intégré' },
  sol_dist_desc: { ar: 'إنشاء طلبيات، تتبع التسليم، إدارة المرتجعات، وتوزيع المناطق على السائقين بمرونة كاملة.', fr: 'Création de commandes, suivi des livraisons, gestion des retours et répartition flexible des zones aux chauffeurs.' },
  sol_accounting_title: { ar: 'محاسبة تلقائية دقيقة', fr: 'Comptabilité automatique précise' },
  sol_accounting_desc: { ar: 'جلسات محاسبة يومية، خزينة المدير، تتبع الديون، التحصيل، المصاريف، والفائض والعجز تلقائياً.', fr: 'Sessions comptables quotidiennes, trésorerie du manager, suivi des créances, recouvrements, dépenses, excédents et déficits automatiques.' },
  sol_gps_title: { ar: 'تتبع GPS والعمليات الجغرافية', fr: 'Suivi GPS et opérations géographiques' },
  sol_gps_desc: { ar: 'تتبع مواقع السائقين لحظياً، مسارات التوزيع، والتأكد من تواجد العمال في مناطقهم المخصصة.', fr: 'Suivi en temps réel des positions des chauffeurs, itinéraires de distribution et vérification de la présence dans les zones assignées.' },
  sol_stats_title: { ar: 'إحصائيات وتقارير شاملة', fr: 'Statistiques et rapports complets' },
  sol_stats_desc: { ar: 'لوحات بيانات تفاعلية للمبيعات، أداء العمال، حركة المخزون، والتقارير المالية اليومية والشهرية.', fr: 'Tableaux de bord interactifs des ventes, performances des employés, mouvements de stock et rapports financiers quotidiens et mensuels.' },
  sol_rewards_title: { ar: 'نظام مكافآت وتحفيز', fr: 'Système de récompenses et motivation' },
  sol_rewards_desc: { ar: 'نقاط ومكافآت للعمال بناءً على الأداء، نظام عروض وترويج، وتتبع الإنجازات لكل عامل.', fr: 'Points et récompenses pour les employés selon leur performance, système de promotions et suivi des réalisations de chaque employé.' },

  // Results
  results_title: { ar: 'النتائج التي ستلاحظها مباشرة', fr: 'Les résultats que vous constaterez immédiatement' },
  results_subtitle: { ar: 'هذا ما سيتغيّر في عملك من أول أسبوع استخدام', fr: 'Voici ce qui changera dans votre activité dès la première semaine' },
  result_accounting: { ar: 'تقليل وقت المحاسبة', fr: 'Réduction du temps comptable' },
  result_stock: { ar: 'دقة تتبع المخزون', fr: 'Précision du suivi de stock' },
  result_debt: { ar: 'تحسين تحصيل الديون', fr: 'Amélioration du recouvrement' },
  result_visibility: { ar: 'رؤية ميدانية كاملة', fr: 'Visibilité terrain complète' },

  // Features grid
  features_title: { ar: '+16 أداة جاهزة لك في نظامك', fr: '+16 outils prêts pour vous dans votre système' },
  feat_orders: { ar: 'إدارة الطلبيات والمبيعات', fr: 'Gestion des commandes et ventes' },
  feat_loading: { ar: 'شحن وتفريغ المخزون', fr: 'Chargement et déchargement du stock' },
  feat_accounting: { ar: 'محاسبة يومية تلقائية', fr: 'Comptabilité quotidienne automatique' },
  feat_gps: { ar: 'تتبع GPS للسائقين', fr: 'Suivi GPS des chauffeurs' },
  feat_debts: { ar: 'إدارة ديون العملاء', fr: 'Gestion des créances clients' },
  feat_treasury: { ar: 'خزينة المدير', fr: 'Trésorerie du manager' },
  feat_promos: { ar: 'نظام العروض والترويج', fr: 'Système de promotions' },
  feat_expenses: { ar: 'إدارة المصاريف', fr: 'Gestion des dépenses' },
  feat_activity: { ar: 'سجل النشاطات', fr: 'Journal des activités' },
  feat_rewards: { ar: 'نظام المكافآت', fr: 'Système de récompenses' },
  feat_branches: { ar: 'إدارة الفروع', fr: 'Gestion des agences' },
  feat_reports: { ar: 'تقارير وإحصائيات', fr: 'Rapports et statistiques' },
  feat_customers: { ar: 'إدارة العملاء', fr: 'Gestion des clients' },
  feat_permissions: { ar: 'نظام الصلاحيات', fr: 'Système de permissions' },
  feat_backup: { ar: 'النسخ الاحتياطي', fr: 'Sauvegarde des données' },
  feat_chat: { ar: 'التواصل الداخلي', fr: 'Communication interne' },

  // Security
  security_badge: { ar: 'أمان على مستوى البنوك', fr: 'Sécurité de niveau bancaire' },
  security_title: { ar: 'بياناتك في أمان تام', fr: 'Vos données sont entièrement sécurisées' },
  security_subtitle: { ar: 'نأخذ أمان بياناتك على محمل الجد. إليك كيف نحميها:', fr: 'Nous prenons la sécurité de vos données très au sérieux. Voici comment nous les protégeons :' },
  sec_encrypt_title: { ar: 'تشفير كامل للبيانات', fr: 'Chiffrement complet des données' },
  sec_encrypt_desc: { ar: 'جميع البيانات مشفرة أثناء النقل والتخزين بمعايير AES-256 المستخدمة في البنوك العالمية.', fr: 'Toutes les données sont chiffrées en transit et au repos avec les normes AES-256 utilisées par les banques internationales.' },
  sec_roles_title: { ar: 'صلاحيات متعددة المستويات', fr: 'Permissions multi-niveaux' },
  sec_roles_desc: { ar: 'نظام أدوار متقدم (مدير، مشرف، سائق، أمين مخزن) مع تحكم دقيق في صلاحيات كل مستخدم.', fr: 'Système de rôles avancé (manager, superviseur, chauffeur, magasinier) avec contrôle précis des permissions de chaque utilisateur.' },
  sec_servers_title: { ar: 'خوادم سحابية عالمية', fr: 'Serveurs cloud mondiaux' },
  sec_servers_desc: { ar: 'مستضاف على بنية Supabase السحابية مع نسخ احتياطية تلقائية يومية وضمان تشغيل 99.9%.', fr: 'Hébergé sur l\'infrastructure cloud Supabase avec sauvegardes automatiques quotidiennes et garantie de disponibilité 99,9%.' },
  sec_backup_title: { ar: 'نسخ احتياطي واستعادة', fr: 'Sauvegarde et restauration' },
  sec_backup_desc: { ar: 'نظام نسخ احتياطي متكامل مع إمكانية التصدير إلى Google Sheets واستعادة البيانات في أي وقت.', fr: 'Système de sauvegarde intégré avec export vers Google Sheets et restauration des données à tout moment.' },
  sec_rls_title: { ar: 'حماية من الاختراقات', fr: 'Protection contre les intrusions' },
  sec_rls_desc: { ar: 'Row Level Security (RLS) على كل جدول، مما يمنع أي مستخدم من الوصول لبيانات لا تخصه.', fr: 'Row Level Security (RLS) sur chaque table, empêchant tout utilisateur d\'accéder à des données qui ne lui appartiennent pas.' },
  sec_uptime_title: { ar: 'بدون توقف أو تعطل', fr: 'Sans interruption ni panne' },
  sec_uptime_desc: { ar: 'بنية تحتية مصممة للتوسع التلقائي. حتى لو زاد عدد المستخدمين 10 أضعاف، النظام يعمل بسلاسة.', fr: 'Infrastructure conçue pour la mise à l\'échelle automatique. Même si le nombre d\'utilisateurs est multiplié par 10, le système fonctionne parfaitement.' },

  // FAQ
  faq_title: { ar: 'أسئلة شائعة', fr: 'Questions fréquentes' },
  faq_q1: { ar: 'هل بياناتي آمنة فعلاً؟', fr: 'Mes données sont-elles vraiment sécurisées ?' },
  faq_a1: { ar: 'نعم 100%. نستخدم نفس تقنيات التشفير المستخدمة في البنوك. كل مستخدم يرى فقط البيانات المصرح له بها، ولا يمكن لأي شخص الوصول لبيانات شركتك حتى فريقنا التقني.', fr: 'Oui, à 100%. Nous utilisons les mêmes technologies de chiffrement que les banques. Chaque utilisateur ne voit que les données auxquelles il est autorisé, et personne ne peut accéder aux données de votre entreprise, pas même notre équipe technique.' },
  faq_q2: { ar: 'ماذا لو انقطع الإنترنت؟', fr: 'Que se passe-t-il si Internet est coupé ?' },
  faq_a2: { ar: 'التطبيق مصمم للعمل حتى مع اتصال ضعيف. البيانات تُحفظ محلياً وتُزامن تلقائياً عند عودة الاتصال. لن تفقد أي بيانات.', fr: 'L\'application est conçue pour fonctionner même avec une connexion faible. Les données sont sauvegardées localement et synchronisées automatiquement au retour de la connexion. Aucune donnée ne sera perdue.' },
  faq_q3: { ar: 'هل يحتاج تدريب طويل؟', fr: 'Faut-il une longue formation ?' },
  faq_a3: { ar: 'التطبيق مصمم ليكون بسيطاً جداً. السائقون يتعلمون استخدامه خلال 15 دقيقة فقط. ونوفر دليل استخدام مدمج ودعم فني مستمر.', fr: 'L\'application est conçue pour être très simple. Les chauffeurs apprennent à l\'utiliser en 15 minutes seulement. Nous fournissons un guide intégré et un support technique continu.' },
  faq_q4: { ar: 'هل يمكنني تجربته قبل الالتزام؟', fr: 'Puis-je l\'essayer avant de m\'engager ?' },
  faq_a4: { ar: 'بالتأكيد! نوفر فترة تجريبية كاملة مع كل الميزات. جرّب النظام مع فريقك وتأكد من ملاءمته لعملك قبل أي التزام.', fr: 'Bien sûr ! Nous offrons une période d\'essai complète avec toutes les fonctionnalités. Testez le système avec votre équipe et assurez-vous qu\'il convient à votre activité avant tout engagement.' },
  faq_q5: { ar: 'كم عدد المستخدمين المدعوم؟', fr: 'Combien d\'utilisateurs sont supportés ?' },
  faq_a5: { ar: 'لا يوجد حد! سواء كان لديك 5 سائقين أو 500، النظام يتوسع تلقائياً. أضف فروعاً وعمالاً بلا قيود.', fr: 'Aucune limite ! Que vous ayez 5 ou 500 chauffeurs, le système s\'adapte automatiquement. Ajoutez des agences et des employés sans restriction.' },

  // CTA
  cta_title: { ar: 'نظامك جاهز — ابدأ الآن', fr: 'Votre système est prêt — commencez maintenant' },
  cta_desc: { ar: 'كل شيء مُعدّ ومجهّز لك. ادخل وابدأ بإدارة التوزيع بطريقة جديدة كلياً.', fr: 'Tout est configuré et prêt pour vous. Connectez-vous et commencez à gérer votre distribution d\'une manière totalement nouvelle.' },
  cta_button: { ar: 'ادخل إلى نظامك الآن', fr: 'Accéder à votre système maintenant' },

  // Footer
  footer: { ar: 'Laser Food — نظام إدارة التوزيع المتكامل', fr: 'Laser Food — Système intégré de gestion de distribution' },

  // OperationalGapsSection
  selfservice_badge: { ar: 'تقليل التواصل المباشر', fr: 'Réduction de la communication directe' },
  selfservice_title: { ar: 'كل عامل يجد ما يحتاجه بنفسه', fr: 'Chaque employé trouve ce dont il a besoin par lui-même' },
  selfservice_subtitle: { ar: 'لا حاجة للاتصال بالمدير أو بزملاء العمل — كل البيانات متاحة لحظياً', fr: 'Pas besoin d\'appeler le manager ou les collègues — toutes les données sont disponibles en temps réel' },

  ss_sales_title: { ar: 'تجميع المبيعات والطلبات', fr: 'Récapitulatif des ventes et commandes' },
  ss_sales_desc: { ar: 'كل عامل يرى مبيعاته وطلباته وإنجازاته اليومية مباشرة من هاتفه — بدون الحاجة لسؤال أي شخص.', fr: 'Chaque employé voit ses ventes, commandes et réalisations quotidiennes directement depuis son téléphone — sans avoir besoin de demander à qui que ce soit.' },
  ss_promos_title: { ar: 'العروض والمكافآت', fr: 'Promotions et récompenses' },
  ss_promos_desc: { ar: 'العامل يطّلع على العروض الحالية ونقاطه ومكافآته تلقائياً — لا حاجة للتواصل مع الإدارة.', fr: 'L\'employé consulte les promotions actuelles, ses points et récompenses automatiquement — pas besoin de contacter la direction.' },
  ss_achievements_title: { ar: 'المنجزات اليومية', fr: 'Réalisations quotidiennes' },
  ss_achievements_desc: { ar: 'ملخص يومي شامل لكل عامل: عدد الزيارات، الطلبات المنفذة، التحصيلات، والمرتجعات.', fr: 'Résumé quotidien complet pour chaque employé : visites, commandes exécutées, recouvrements et retours.' },
  ss_stock_title: { ar: 'مخزون العامل اللحظي', fr: 'Stock de l\'employé en temps réel' },
  ss_stock_desc: { ar: 'كل عامل يرى مخزونه الحالي بالتفصيل — لا يحتاج للاتصال بالمستودع للاستفسار.', fr: 'Chaque employé voit son stock actuel en détail — pas besoin d\'appeler l\'entrepôt pour se renseigner.' },

  // Dual auth
  dualauth_badge: { ar: 'المصادقة الثنائية على العمليات', fr: 'Double authentification des opérations' },
  dualauth_title: { ar: 'لا عملية تمر بطرف واحد', fr: 'Aucune opération ne passe par une seule partie' },
  dualauth_subtitle: { ar: 'كل عملية حساسة تتطلب موافقة طرفين — لضمان الشفافية ومنع التلاعب', fr: 'Chaque opération sensible nécessite l\'approbation de deux parties — pour garantir la transparence et empêcher la fraude' },

  da_loading_title: { ar: 'المصادقة الثنائية على الشحن', fr: 'Double authentification du chargement' },
  da_loading_desc: { ar: 'عند شحن البضاعة، يجب أن يوافق كل من أمين المخزن وعامل التوصيل على الكميات. لا يمكن لطرف واحد تسجيل العملية بمفرده.', fr: 'Lors du chargement, le magasinier et le chauffeur doivent tous deux valider les quantités. Aucune partie ne peut enregistrer l\'opération seule.' },
  da_loading_benefit: { ar: 'يمنع أي تلاعب في كميات الشحن — الطرفان يتحملان المسؤولية معاً.', fr: 'Empêche toute manipulation des quantités de chargement — les deux parties partagent la responsabilité.' },
  da_unloading_title: { ar: 'المصادقة الثنائية على التفريغ', fr: 'Double authentification du déchargement' },
  da_unloading_desc: { ar: 'عند إرجاع البضاعة المتبقية، يجب موافقة الطرفين على الكميات المُعادة. أي فرق يُسجّل تلقائياً.', fr: 'Lors du retour de la marchandise restante, les deux parties doivent valider les quantités retournées. Tout écart est enregistré automatiquement.' },
  da_unloading_benefit: { ar: 'يكشف أي نقص أو فائض فوراً ويُحدد المسؤول عنه.', fr: 'Détecte immédiatement tout manque ou excédent et identifie le responsable.' },
  da_accounting_title: { ar: 'المصادقة على جلسات المحاسبة', fr: 'Authentification des sessions comptables' },
  da_accounting_desc: { ar: 'جلسة المحاسبة تتطلب مراجعة وموافقة المدير على كل بند — النقد، الديون، المصاريف، والفائض/العجز.', fr: 'La session comptable nécessite la révision et l\'approbation du manager sur chaque poste — espèces, créances, dépenses, excédent/déficit.' },
  da_accounting_benefit: { ar: 'لا يمكن للعامل إخفاء أي مبلغ أو تعديل الأرقام بعد التسجيل.', fr: 'L\'employé ne peut cacher aucun montant ni modifier les chiffres après l\'enregistrement.' },

  // Fraud prevention
  fraud_badge: { ar: 'إغلاق ثغرات التحايل', fr: 'Fermeture des failles de fraude' },
  fraud_title: { ar: 'ماذا يمكن أن يفعل العامل؟ وكيف أغلقنا الثغرة؟', fr: 'Que peut faire l\'employé ? Et comment avons-nous fermé la faille ?' },
  fraud_subtitle: { ar: 'حللنا كل سيناريو تحايل ممكن وبنينا حماية مدمجة لكل واحد منها', fr: 'Nous avons analysé chaque scénario de fraude possible et intégré une protection pour chacun' },
  gap_label: { ar: '⚠ الثغرة:', fr: '⚠ La faille :' },
  gap_solution_label: { ar: '✓ كيف أغلقناها:', fr: '✓ Comment nous l\'avons fermée :' },

  fraud_visit_threat: { ar: 'ماذا لو ادّعى مندوب المبيعات أنه زار العميل وهو لم يفعل؟', fr: 'Et si le commercial prétend avoir visité le client sans l\'avoir fait ?' },
  fraud_visit_title: { ar: 'تزوير الزيارات الميدانية', fr: 'Falsification des visites terrain' },
  fraud_visit_desc: { ar: 'المندوب لا يمكنه تسجيل أي حالة للعميل (مغلق، غير متاح، لم يطلب) إلا إذا كان فعلياً في موقع العميل عبر GPS.', fr: 'Le commercial ne peut enregistrer aucun statut client (fermé, indisponible, pas de commande) que s\'il est physiquement sur le site du client via GPS.' },
  fraud_visit_solution: { ar: 'النظام يتحقق من إحداثيات الموقع قبل السماح بأي تسجيل — أي محاولة من خارج النطاق تُرفض تلقائياً.', fr: 'Le système vérifie les coordonnées GPS avant tout enregistrement — toute tentative hors zone est automatiquement rejetée.' },

  fraud_delivery_threat: { ar: 'ماذا لو ادّعى عامل التوصيل أنه وصل للعميل دون أن يذهب فعلاً؟', fr: 'Et si le livreur prétend être arrivé chez le client sans y être allé ?' },
  fraud_delivery_title: { ar: 'تزوير التسليم', fr: 'Falsification de livraison' },
  fraud_delivery_desc: { ar: 'عامل التوصيل لا يمكنه تأكيد تسليم طلبية أو تسجيل حالة العميل إلا من موقع العميل الجغرافي.', fr: 'Le livreur ne peut confirmer une livraison ou enregistrer un statut client que depuis la position géographique du client.' },
  fraud_delivery_solution: { ar: 'التحقق الجغرافي إلزامي لكل عملية تسليم — لا يمكن التلاعب بحالة الطلبية عن بُعد.', fr: 'La vérification géographique est obligatoire pour chaque livraison — impossible de manipuler le statut d\'une commande à distance.' },

  fraud_gift_threat: { ar: 'ماذا لو اختلس عامل التوصيل الهدايا والعينات المخصصة للعملاء؟', fr: 'Et si le livreur détourne les cadeaux et échantillons destinés aux clients ?' },
  fraud_gift_title: { ar: 'اختلاس الهدايا', fr: 'Détournement de cadeaux' },
  fraud_gift_desc: { ar: 'كل هدية مسجلة في النظام مرتبطة بعميل محدد وطلبية محددة. عند التفريغ، أي نقص في الهدايا يظهر فوراً.', fr: 'Chaque cadeau enregistré dans le système est lié à un client et une commande spécifiques. Lors du déchargement, tout manque apparaît immédiatement.' },
  fraud_gift_solution: { ar: 'المصادقة الثنائية عند التفريغ + تسجيل الهدايا لكل طلبية = أي هدية ناقصة تُكتشف تلقائياً.', fr: 'Double authentification au déchargement + enregistrement des cadeaux par commande = tout cadeau manquant est détecté automatiquement.' },

  fraud_price_threat: { ar: 'ماذا لو باع العامل بسعر أعلى وأعطى المدير حساباً بسعر أقل؟', fr: 'Et si l\'employé vend à un prix plus élevé et déclare un prix inférieur au manager ?' },
  fraud_price_title: { ar: 'التلاعب بالأسعار', fr: 'Manipulation des prix' },
  fraud_price_desc: { ar: 'الأسعار محددة مسبقاً في النظام لكل منتج ولكل عميل. العامل لا يمكنه تغيير السعر — الفاتورة تُنشأ تلقائياً.', fr: 'Les prix sont prédéfinis dans le système pour chaque produit et client. L\'employé ne peut pas modifier le prix — la facture est générée automatiquement.' },
  fraud_price_solution: { ar: 'أسعار ثابتة + أسعار خاصة للعملاء مُعتمدة من المدير + فواتير تلقائية = لا مجال للتلاعب.', fr: 'Prix fixes + prix spéciaux clients approuvés par le manager + factures automatiques = aucune possibilité de manipulation.' },

  fraud_collection_threat: { ar: 'ماذا لو أخفى العامل جزءاً من التحصيلات النقدية؟', fr: 'Et si l\'employé cache une partie des encaissements ?' },
  fraud_collection_title: { ar: 'إخفاء التحصيلات', fr: 'Dissimulation des encaissements' },
  fraud_collection_desc: { ar: 'كل تحصيل مرتبط بطلبية أو دين محدد. جلسة المحاسبة تقارن المبلغ المتوقع بالمبلغ الفعلي تلقائياً.', fr: 'Chaque encaissement est lié à une commande ou créance spécifique. La session comptable compare automatiquement le montant attendu et le montant réel.' },
  fraud_collection_solution: { ar: 'محاسبة تلقائية + كشف العجز الفوري + سجل لا يمكن تعديله = أي فرق يظهر مباشرة.', fr: 'Comptabilité automatique + détection immédiate des déficits + registre inaltérable = tout écart apparaît immédiatement.' },

  fraud_expense_threat: { ar: 'ماذا لو سجّل العامل مصاريف وهمية ليحتفظ بالفرق؟', fr: 'Et si l\'employé enregistre des dépenses fictives pour garder la différence ?' },
  fraud_expense_title: { ar: 'مصاريف وهمية', fr: 'Dépenses fictives' },
  fraud_expense_desc: { ar: 'كل مصروف يتطلب تصنيف وصورة إيصال ويمر بمراجعة المدير قبل اعتماده. لا يُحسب تلقائياً.', fr: 'Chaque dépense nécessite une catégorie, une photo de reçu et passe par la révision du manager avant approbation. Rien n\'est comptabilisé automatiquement.' },
  fraud_expense_solution: { ar: 'نظام موافقة على المصاريف + إيصالات مطلوبة + مراجعة المدير = لا مصاريف بدون إثبات.', fr: 'Système d\'approbation des dépenses + reçus obligatoires + révision du manager = aucune dépense sans preuve.' },

  fraud_fake_customer_threat: { ar: 'ماذا لو أضاف العامل عملاء وهميين لتسجيل مبيعات مزيفة؟', fr: 'Et si l\'employé ajoute des clients fictifs pour enregistrer de fausses ventes ?' },
  fraud_fake_customer_title: { ar: 'عملاء وهميون', fr: 'Clients fictifs' },
  fraud_fake_customer_desc: { ar: 'إضافة عملاء جدد تحتاج موافقة المدير. لا يمكن للعامل إنشاء عميل والبيع له مباشرة.', fr: 'L\'ajout de nouveaux clients nécessite l\'approbation du manager. L\'employé ne peut pas créer un client et lui vendre directement.' },
  fraud_fake_customer_solution: { ar: 'نظام موافقة على العملاء الجدد + ربط العميل بموقع جغرافي = لا عملاء وهميين.', fr: 'Système d\'approbation des nouveaux clients + liaison avec une position géographique = aucun client fictif.' },

  fraud_retroactive_threat: { ar: 'ماذا لو عدّل العامل بيانات طلبية بعد تسليمها؟', fr: 'Et si l\'employé modifie les données d\'une commande après sa livraison ?' },
  fraud_retroactive_title: { ar: 'تعديل الطلبيات بأثر رجعي', fr: 'Modification rétroactive des commandes' },
  fraud_retroactive_desc: { ar: 'الطلبيات المكتملة لا يمكن تعديلها. كل تغيير يُسجّل في سجل النشاطات مع الوقت والمسؤول.', fr: 'Les commandes terminées ne peuvent pas être modifiées. Chaque changement est enregistré dans le journal des activités avec l\'heure et le responsable.' },
  fraud_retroactive_solution: { ar: 'سجل نشاطات غير قابل للتعديل + قفل الطلبيات المكتملة = شفافية كاملة.', fr: 'Journal des activités inaltérable + verrouillage des commandes terminées = transparence totale.' },

  // AdvancedFeaturesSection
  manager_badge: { ar: 'تحكّم كامل للمدير', fr: 'Contrôle total pour le manager' },
  manager_title: { ar: 'كل شيء تحت سيطرتك', fr: 'Tout est sous votre contrôle' },
  manager_subtitle: { ar: 'أدوات مخصصة لك كمدير — تراقب، تراجع، وتتخذ قرارات بثقة', fr: 'Des outils dédiés pour vous en tant que manager — surveillez, révisez et prenez des décisions en toute confiance' },

  mgr_dashboard_title: { ar: 'لوحة بيانات المدير', fr: 'Tableau de bord du manager' },
  mgr_dashboard_desc: { ar: 'ملخص لحظي لكل ما يحدث: إجمالي المبيعات، الطلبيات النشطة، التحصيلات، أداء كل عامل — في شاشة واحدة.', fr: 'Résumé en temps réel de tout ce qui se passe : total des ventes, commandes actives, recouvrements, performance de chaque employé — sur un seul écran.' },
  mgr_review_title: { ar: 'مراجعة يومية شاملة', fr: 'Révision quotidienne complète' },
  mgr_review_desc: { ar: 'جلسات محاسبة يومية لكل عامل مع مراجعة النقد، الديون، المرتجعات، والمصاريف قبل اعتمادها.', fr: 'Sessions comptables quotidiennes pour chaque employé avec révision des espèces, créances, retours et dépenses avant approbation.' },
  mgr_treasury_title: { ar: 'خزينة المدير', fr: 'Trésorerie du manager' },
  mgr_treasury_desc: { ar: 'تتبع كل المبالغ المستلمة والمُسلّمة مع سجل كامل لحركات الخزينة وتسليمات الأمانات.', fr: 'Suivi de tous les montants reçus et remis avec un registre complet des mouvements de trésorerie et des remises de fonds.' },
  mgr_permissions_title: { ar: 'صلاحيات دقيقة لكل مستخدم', fr: 'Permissions précises pour chaque utilisateur' },
  mgr_permissions_desc: { ar: 'تحكم في ما يراه ويفعله كل عامل — مدير، مشرف، سائق، أمين مخزن — بصلاحيات مخصصة لكل دور.', fr: 'Contrôlez ce que chaque employé voit et fait — manager, superviseur, chauffeur, magasinier — avec des permissions personnalisées pour chaque rôle.' },

  field_badge: { ar: 'عمليات ميدانية متقدمة', fr: 'Opérations terrain avancées' },
  field_title: { ar: 'تعرف ماذا يحدث في الميدان — لحظة بلحظة', fr: 'Sachez ce qui se passe sur le terrain — en temps réel' },
  field_subtitle: { ar: 'أدوات تتبع ومراقبة تمنحك رؤية كاملة لما يجري خارج المكتب', fr: 'Des outils de suivi et de surveillance qui vous donnent une visibilité complète sur le terrain' },

  fld_routes_title: { ar: 'مسارات توزيع ذكية', fr: 'Itinéraires de distribution intelligents' },
  fld_routes_desc: { ar: 'تقسيم المناطق إلى قطاعات ومسارات مع تعيين كل مسار لعامل محدد لتغطية كل العملاء بكفاءة.', fr: 'Division des zones en secteurs et itinéraires avec assignation de chaque itinéraire à un employé spécifique pour couvrir tous les clients efficacement.' },
  fld_tours_title: { ar: 'جولات العمال', fr: 'Tournées des employés' },
  fld_tours_desc: { ar: 'متابعة جولات كل عامل يومياً — كم عميل زار، كم طلبية نفّذ، وما نسبة التغطية لمنطقته.', fr: 'Suivi des tournées quotidiennes de chaque employé — combien de clients visités, commandes exécutées et taux de couverture de sa zone.' },
  fld_attendance_title: { ar: 'تسجيل الحضور والانصراف', fr: 'Enregistrement présence et départ' },
  fld_attendance_desc: { ar: 'تسجيل دخول وخروج العمال مع تحقق GPS — تعرف من بدأ يومه ومتى انتهى وأين كان.', fr: 'Enregistrement des entrées et sorties des employés avec vérification GPS — sachez qui a commencé sa journée, quand elle s\'est terminée et où il était.' },
  fld_tracking_title: { ar: 'تتبع الطلبيات لحظياً', fr: 'Suivi des commandes en temps réel' },
  fld_tracking_desc: { ar: 'حالة كل طلبية واضحة: قيد التحضير، في الطريق، مُسلّمة، مرتجعة — مع أوقات دقيقة لكل مرحلة.', fr: 'Statut clair de chaque commande : en préparation, en route, livrée, retournée — avec des horaires précis pour chaque étape.' },

  smart_badge: { ar: 'ميزات ذكية تزيد أرباحك', fr: 'Fonctionnalités intelligentes pour augmenter vos profits' },
  smart_title: { ar: 'أدوات مصممة لزيادة المبيعات وتقليل الخسائر', fr: 'Des outils conçus pour augmenter les ventes et réduire les pertes' },
  smart_subtitle: { ar: 'ليس فقط إدارة — بل أدوات تساعدك تبيع أكثر وتخسر أقل', fr: 'Pas seulement de la gestion — des outils qui vous aident à vendre plus et perdre moins' },

  smt_promos_title: { ar: 'نظام عروض وترويج متقدم', fr: 'Système avancé de promotions' },
  smt_promos_desc: { ar: 'إنشاء عروض بأنواع مختلفة (خصم، هدية، كمية إضافية) مع تطبيق تلقائي عند إنشاء الطلبيات. تقسيم العروض بين العمال بعدالة.', fr: 'Création de promotions de différents types (remise, cadeau, quantité bonus) avec application automatique lors de la création des commandes. Répartition équitable des promotions entre les employés.' },
  smt_rewards_title: { ar: 'نظام مكافآت وإنجازات', fr: 'Système de récompenses et réalisations' },
  smt_rewards_desc: { ar: 'نقاط تلقائية للعمال بناءً على أدائهم — مبيعات، تحصيلات، زيارات. لوحة إنجازات تحفيزية لكل عامل تُعزز المنافسة الإيجابية.', fr: 'Points automatiques pour les employés selon leur performance — ventes, recouvrements, visites. Tableau de réalisations motivant pour chaque employé qui encourage la compétition positive.' },
  smt_invoices_title: { ar: 'فواتير مشتركة وتقارير فورية', fr: 'Factures partagées et rapports instantanés' },
  smt_invoices_desc: { ar: 'إنشاء فواتير احترافية ومشاركتها مباشرة مع العملاء. تقارير يومية وشهرية جاهزة لكل عامل وكل منطقة.', fr: 'Création de factures professionnelles et partage direct avec les clients. Rapports quotidiens et mensuels prêts pour chaque employé et chaque zone.' },
  smt_returns_title: { ar: 'إدارة المرتجعات والأرصدة', fr: 'Gestion des retours et crédits' },
  smt_returns_desc: { ar: 'تسجيل المرتجعات بأسباب واضحة، أرصدة العملاء (credit) تُخصم تلقائياً من الطلبيات القادمة بموافقة المدير.', fr: 'Enregistrement des retours avec des motifs clairs, les crédits clients sont automatiquement déduits des prochaines commandes avec l\'approbation du manager.' },

  growth_badge: { ar: 'جاهز للنمو معك', fr: 'Prêt à évoluer avec vous' },
  growth_title: { ar: 'نظام ينمو مع نمو شركتك', fr: 'Un système qui évolue avec votre entreprise' },
  growth_subtitle: { ar: 'سواء كنت تدير فرعاً واحداً أو عشرة — النظام مصمم للتوسع', fr: 'Que vous gériez une ou dix agences — le système est conçu pour s\'adapter' },

  grw_branches_title: { ar: 'إدارة فروع متعددة', fr: 'Gestion multi-agences' },
  grw_branches_desc: { ar: 'أضف فروعاً جديدة بسهولة. كل فرع له مخزونه وعماله وعملاؤه. التقارير تعمل على مستوى الفرع أو الشركة كاملة.', fr: 'Ajoutez facilement de nouvelles agences. Chaque agence a son propre stock, employés et clients. Les rapports fonctionnent au niveau de l\'agence ou de l\'entreprise entière.' },
  grw_backup_title: { ar: 'نسخ احتياطي إلى Google Sheets', fr: 'Sauvegarde vers Google Sheets' },
  grw_backup_desc: { ar: 'تصدير كل بياناتك إلى جداول Google بضغطة واحدة. نسخ احتياطي يومي تلقائي لراحة بالك.', fr: 'Exportez toutes vos données vers Google Sheets en un clic. Sauvegarde quotidienne automatique pour votre tranquillité d\'esprit.' },
  grw_share_title: { ar: 'مشاركة سريعة', fr: 'Partage rapide' },
  grw_share_desc: { ar: 'مشاركة الفواتير والتقارير والإحصائيات مباشرة عبر WhatsApp أو أي تطبيق — بدون طباعة أو تحويل.', fr: 'Partagez factures, rapports et statistiques directement via WhatsApp ou toute application — sans impression ni conversion.' },
  grw_training_title: { ar: 'دليل استخدام وتدريب مدمج', fr: 'Guide d\'utilisation et formation intégrés' },
  grw_training_desc: { ar: 'دليل تفاعلي داخل التطبيق يشرح كل ميزة خطوة بخطوة. العمال الجدد يتعلمون بأنفسهم في دقائق.', fr: 'Guide interactif intégré à l\'application expliquant chaque fonctionnalité étape par étape. Les nouveaux employés apprennent par eux-mêmes en quelques minutes.' },
};
