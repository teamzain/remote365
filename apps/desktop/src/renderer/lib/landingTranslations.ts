import type { Language } from './translations';

/**
 * Full-phrase translations for the signed-out home screen (SnowLanding) and
 * its Options dialog, keyed by the exact English text on screen. Without
 * these the DOM translator falls back to word-by-word replacement, which
 * produced half-translated lines ("Zugriff And Support From Anywhere").
 * Merged into supplementalTranslations in translations.ts.
 */
export const landingTranslations: Record<string, Record<Language, string>> = {
    "Help": {
        "en": "Help",
        "de": "Hilfe",
        "fr": "Aide",
        "es": "Ayuda",
        "ar-SA": "المساعدة"
    },
    "Help And Support": {
        "en": "Help And Support",
        "de": "Hilfe und Support",
        "fr": "Aide et assistance",
        "es": "Ayuda y soporte",
        "ar-SA": "المساعدة والدعم"
    },
    "Language": {
        "en": "Language",
        "de": "Sprache",
        "fr": "Langue",
        "es": "Idioma",
        "ar-SA": "اللغة"
    },
    "Settings": {
        "en": "Settings",
        "de": "Einstellungen",
        "fr": "Paramètres",
        "es": "Ajustes",
        "ar-SA": "الإعدادات"
    },
    "Close": {
        "en": "Close",
        "de": "Schließen",
        "fr": "Fermer",
        "es": "Cerrar",
        "ar-SA": "إغلاق"
    },
    "Cancel": {
        "en": "Cancel",
        "de": "Abbrechen",
        "fr": "Annuler",
        "es": "Cancelar",
        "ar-SA": "إلغاء"
    },
    "Back": {
        "en": "Back",
        "de": "Zurück",
        "fr": "Retour",
        "es": "Atrás",
        "ar-SA": "رجوع"
    },
    "Remove": {
        "en": "Remove",
        "de": "Entfernen",
        "fr": "Retirer",
        "es": "Eliminar",
        "ar-SA": "إزالة"
    },
    "Access And Support From Anywhere": {
        "en": "Access And Support From Anywhere",
        "de": "Zugriff und Support von überall",
        "fr": "Accès et assistance depuis n'importe où",
        "es": "Acceso y soporte desde cualquier lugar",
        "ar-SA": "الوصول والدعم من أي مكان"
    },
    "Share your ID and password for Remote Support.": {
        "en": "Share your ID and password for Remote Support.",
        "de": "Teilen Sie Ihre ID und Ihr Passwort für den Fernsupport.",
        "fr": "Partagez votre ID et votre mot de passe pour l'assistance à distance.",
        "es": "Comparte tu ID y tu contraseña para recibir soporte remoto.",
        "ar-SA": "شارك المعرّف وكلمة المرور للحصول على الدعم عن بُعد."
    },
    "Your ID": {
        "en": "Your ID",
        "de": "Ihre ID",
        "fr": "Votre ID",
        "es": "Tu ID",
        "ar-SA": "المعرّف الخاص بك"
    },
    "Password": {
        "en": "Password",
        "de": "Passwort",
        "fr": "Mot de passe",
        "es": "Contraseña",
        "ar-SA": "كلمة المرور"
    },
    "Not Set": {
        "en": "Not Set",
        "de": "Nicht festgelegt",
        "fr": "Non défini",
        "es": "Sin definir",
        "ar-SA": "غير محدد"
    },
    "Or": {
        "en": "Or",
        "de": "Oder",
        "fr": "Ou",
        "es": "O",
        "ar-SA": "أو"
    },
    "Remote Session": {
        "en": "Remote Session",
        "de": "Fernsitzung",
        "fr": "Session à distance",
        "es": "Sesión remota",
        "ar-SA": "جلسة عن بُعد"
    },
    "Meeting": {
        "en": "Meeting",
        "de": "Besprechung",
        "fr": "Réunion",
        "es": "Reunión",
        "ar-SA": "اجتماع"
    },
    "Connect Anything": {
        "en": "Connect Anything",
        "de": "Alles verbinden",
        "fr": "Tout connecter",
        "es": "Conectar cualquier cosa",
        "ar-SA": "اتصل بأي شيء"
    },
    "A whole new way to connect – arriving soon.": {
        "en": "A whole new way to connect – arriving soon.",
        "de": "Eine völlig neue Art, sich zu verbinden – bald verfügbar.",
        "fr": "Une toute nouvelle façon de se connecter – bientôt disponible.",
        "es": "Una forma totalmente nueva de conectarse – muy pronto.",
        "ar-SA": "طريقة جديدة كليًا للاتصال – قريبًا."
    },
    "Coming Soon": {
        "en": "Coming Soon",
        "de": "Demnächst",
        "fr": "Bientôt disponible",
        "es": "Próximamente",
        "ar-SA": "قريبًا"
    },
    "Remote Device ID": {
        "en": "Remote Device ID",
        "de": "ID des Remote-Geräts",
        "fr": "ID de l'appareil distant",
        "es": "ID del dispositivo remoto",
        "ar-SA": "معرّف الجهاز البعيد"
    },
    "Remote Device ID or Host ID (Example: 123 456 789)": {
        "en": "Remote Device ID or Host ID (Example: 123 456 789)",
        "de": "ID des Remote-Geräts oder Host-ID (Beispiel: 123 456 789)",
        "fr": "ID de l'appareil distant ou ID de l'hôte (exemple : 123 456 789)",
        "es": "ID del dispositivo remoto o ID del host (ejemplo: 123 456 789)",
        "ar-SA": "معرّف الجهاز البعيد أو معرّف المضيف (مثال: 123 456 789)"
    },
    "Join Session": {
        "en": "Join Session",
        "de": "Sitzung beitreten",
        "fr": "Rejoindre la session",
        "es": "Unirse a la sesión",
        "ar-SA": "الانضمام إلى الجلسة"
    },
    "Recent Connections": {
        "en": "Recent Connections",
        "de": "Letzte Verbindungen",
        "fr": "Connexions récentes",
        "es": "Conexiones recientes",
        "ar-SA": "الاتصالات الأخيرة"
    },
    "Target Device": {
        "en": "Target Device",
        "de": "Zielgerät",
        "fr": "Appareil cible",
        "es": "Dispositivo de destino",
        "ar-SA": "الجهاز المستهدف"
    },
    "Enter Password": {
        "en": "Enter Password",
        "de": "Passwort eingeben",
        "fr": "Saisir le mot de passe",
        "es": "Introduce la contraseña",
        "ar-SA": "أدخل كلمة المرور"
    },
    "This device allows passwordless access.": {
        "en": "This device allows passwordless access.",
        "de": "Dieses Gerät erlaubt den Zugriff ohne Passwort.",
        "fr": "Cet appareil autorise l'accès sans mot de passe.",
        "es": "Este dispositivo permite el acceso sin contraseña.",
        "ar-SA": "يسمح هذا الجهاز بالوصول دون كلمة مرور."
    },
    "Meeting Code": {
        "en": "Meeting Code",
        "de": "Besprechungscode",
        "fr": "Code de réunion",
        "es": "Código de reunión",
        "ar-SA": "رمز الاجتماع"
    },
    "Join Meeting": {
        "en": "Join Meeting",
        "de": "Besprechung beitreten",
        "fr": "Rejoindre la réunion",
        "es": "Unirse a la reunión",
        "ar-SA": "الانضمام إلى الاجتماع"
    },
    "Create New Meeting": {
        "en": "Create New Meeting",
        "de": "Neue Besprechung erstellen",
        "fr": "Créer une réunion",
        "es": "Crear una reunión nueva",
        "ar-SA": "إنشاء اجتماع جديد"
    },
    "Recent Meetings": {
        "en": "Recent Meetings",
        "de": "Letzte Besprechungen",
        "fr": "Réunions récentes",
        "es": "Reuniones recientes",
        "ar-SA": "الاجتماعات الأخيرة"
    },
    "Start Remote365 With Windows": {
        "en": "Start Remote365 With Windows",
        "de": "Remote365 mit Windows starten",
        "fr": "Démarrer Remote365 avec Windows",
        "es": "Iniciar Remote365 con Windows",
        "ar-SA": "تشغيل Remote365 مع Windows"
    },
    "Grant Easy Access To This Device": {
        "en": "Grant Easy Access To This Device",
        "de": "Einfachen Zugriff auf dieses Gerät erlauben",
        "fr": "Autoriser l'accès facile à cet appareil",
        "es": "Permitir acceso fácil a este dispositivo",
        "ar-SA": "منح وصول سهل إلى هذا الجهاز"
    },
    "Already Have An Account – Remote365": {
        "en": "Already Have An Account – Remote365",
        "de": "Sie haben bereits ein Konto – Remote365",
        "fr": "Vous avez déjà un compte – Remote365",
        "es": "¿Ya tienes una cuenta? – Remote365",
        "ar-SA": "لديك حساب بالفعل – Remote365"
    },
    "Don't Have An Account – Sign Up": {
        "en": "Don't Have An Account – Sign Up",
        "de": "Noch kein Konto – Registrieren",
        "fr": "Pas encore de compte – S'inscrire",
        "es": "¿No tienes cuenta? – Regístrate",
        "ar-SA": "ليس لديك حساب – سجّل الآن"
    },
    "Online And Ready": {
        "en": "Online And Ready",
        "de": "Online und bereit",
        "fr": "En ligne et prêt",
        "es": "En línea y listo",
        "ar-SA": "متصل وجاهز"
    },
    "Connecting": {
        "en": "Connecting",
        "de": "Verbindung wird hergestellt",
        "fr": "Connexion en cours",
        "es": "Conectando",
        "ar-SA": "جارٍ الاتصال"
    },
    "Offline": {
        "en": "Offline",
        "de": "Offline",
        "fr": "Hors ligne",
        "es": "Sin conexión",
        "ar-SA": "غير متصل"
    },
    "Error": {
        "en": "Error",
        "de": "Fehler",
        "fr": "Erreur",
        "es": "Error",
        "ar-SA": "خطأ"
    },
    "This Laptop": {
        "en": "This Laptop",
        "de": "Dieser Laptop",
        "fr": "Cet ordinateur portable",
        "es": "Este portátil",
        "ar-SA": "هذا الحاسوب المحمول"
    },
    "Remote365 Options": {
        "en": "Remote365 Options",
        "de": "Remote365-Optionen",
        "fr": "Options de Remote365",
        "es": "Opciones de Remote365",
        "ar-SA": "خيارات Remote365"
    },
    "Local access and session preferences": {
        "en": "Local access and session preferences",
        "de": "Lokaler Zugriff und Sitzungseinstellungen",
        "fr": "Accès local et préférences de session",
        "es": "Acceso local y preferencias de sesión",
        "ar-SA": "إعدادات الوصول المحلي والجلسات"
    },
    "General": {
        "en": "General",
        "de": "Allgemein",
        "fr": "Général",
        "es": "General",
        "ar-SA": "عام"
    },
    "Account": {
        "en": "Account",
        "de": "Konto",
        "fr": "Compte",
        "es": "Cuenta",
        "ar-SA": "الحساب"
    },
    "Remote Control": {
        "en": "Remote Control",
        "de": "Fernsteuerung",
        "fr": "Contrôle à distance",
        "es": "Control remoto",
        "ar-SA": "التحكم عن بُعد"
    },
    "Video": {
        "en": "Video",
        "de": "Video",
        "fr": "Vidéo",
        "es": "Vídeo",
        "ar-SA": "الفيديو"
    },
    "Text Size": {
        "en": "Text Size",
        "de": "Textgröße",
        "fr": "Taille du texte",
        "es": "Tamaño del texto",
        "ar-SA": "حجم النص"
    },
    "Software Update": {
        "en": "Software Update",
        "de": "Software-Update",
        "fr": "Mise à jour du logiciel",
        "es": "Actualización de software",
        "ar-SA": "تحديث البرنامج"
    },
    "Most Popular Options": {
        "en": "Most Popular Options",
        "de": "Beliebteste Optionen",
        "fr": "Options les plus utilisées",
        "es": "Opciones más populares",
        "ar-SA": "الخيارات الأكثر استخدامًا"
    },
    "Hover your mouse over options to get additional info": {
        "en": "Hover your mouse over options to get additional info",
        "de": "Bewegen Sie die Maus über eine Option, um weitere Infos zu erhalten",
        "fr": "Survolez une option pour obtenir plus d'informations",
        "es": "Pasa el ratón sobre una opción para ver más información",
        "ar-SA": "مرّر الماوس فوق الخيارات للحصول على مزيد من المعلومات"
    },
    "Important Options For Working With Remote365": {
        "en": "Important Options For Working With Remote365",
        "de": "Wichtige Optionen für die Arbeit mit Remote365",
        "fr": "Options importantes pour travailler avec Remote365",
        "es": "Opciones importantes para trabajar con Remote365",
        "ar-SA": "خيارات مهمة للعمل مع Remote365"
    },
    "Your Display Name": {
        "en": "Your Display Name",
        "de": "Ihr Anzeigename",
        "fr": "Votre nom d'affichage",
        "es": "Tu nombre visible",
        "ar-SA": "اسم العرض الخاص بك"
    },
    "Install Updates Automatically": {
        "en": "Install Updates Automatically",
        "de": "Updates automatisch installieren",
        "fr": "Installer les mises à jour automatiquement",
        "es": "Instalar actualizaciones automáticamente",
        "ar-SA": "تثبيت التحديثات تلقائيًا"
    },
    "Access Settings": {
        "en": "Access Settings",
        "de": "Zugriffseinstellungen",
        "fr": "Paramètres d'accès",
        "es": "Ajustes de acceso",
        "ar-SA": "إعدادات الوصول"
    },
    "Require Password Before Remote Access": {
        "en": "Require Password Before Remote Access",
        "de": "Passwort vor Fernzugriff verlangen",
        "fr": "Exiger un mot de passe avant l'accès à distance",
        "es": "Exigir contraseña antes del acceso remoto",
        "ar-SA": "طلب كلمة مرور قبل الوصول عن بُعد"
    },
    "Change Password...": {
        "en": "Change Password...",
        "de": "Passwort ändern...",
        "fr": "Modifier le mot de passe...",
        "es": "Cambiar contraseña...",
        "ar-SA": "تغيير كلمة المرور..."
    },
    "Remote Control Options": {
        "en": "Remote Control Options",
        "de": "Optionen für die Fernsteuerung",
        "fr": "Options du contrôle à distance",
        "es": "Opciones de control remoto",
        "ar-SA": "خيارات التحكم عن بُعد"
    },
    "Session Behavior": {
        "en": "Session Behavior",
        "de": "Sitzungsverhalten",
        "fr": "Comportement de la session",
        "es": "Comportamiento de la sesión",
        "ar-SA": "سلوك الجلسة"
    },
    "Sync Clipboard During Sessions": {
        "en": "Sync Clipboard During Sessions",
        "de": "Zwischenablage während Sitzungen synchronisieren",
        "fr": "Synchroniser le presse-papiers pendant les sessions",
        "es": "Sincronizar el portapapeles durante las sesiones",
        "ar-SA": "مزامنة الحافظة أثناء الجلسات"
    },
    "Minimize App When A Session Starts": {
        "en": "Minimize App When A Session Starts",
        "de": "App beim Sitzungsstart minimieren",
        "fr": "Réduire l'application au début d'une session",
        "es": "Minimizar la aplicación al iniciar una sesión",
        "ar-SA": "تصغير التطبيق عند بدء جلسة"
    },
    "Show Connection Alerts": {
        "en": "Show Connection Alerts",
        "de": "Verbindungshinweise anzeigen",
        "fr": "Afficher les alertes de connexion",
        "es": "Mostrar alertas de conexión",
        "ar-SA": "إظهار تنبيهات الاتصال"
    },
    "Meeting Options": {
        "en": "Meeting Options",
        "de": "Besprechungsoptionen",
        "fr": "Options de réunion",
        "es": "Opciones de reunión",
        "ar-SA": "خيارات الاجتماع"
    },
    "Audio Sharing": {
        "en": "Audio Sharing",
        "de": "Audiofreigabe",
        "fr": "Partage audio",
        "es": "Compartir audio",
        "ar-SA": "مشاركة الصوت"
    },
    "Share desktop audio during meeting screen share": {
        "en": "Share desktop audio during meeting screen share",
        "de": "Desktop-Audio bei der Bildschirmfreigabe in Besprechungen teilen",
        "fr": "Partager l'audio du bureau pendant le partage d'écran en réunion",
        "es": "Compartir el audio del escritorio al compartir pantalla en reuniones",
        "ar-SA": "مشاركة صوت سطح المكتب أثناء مشاركة الشاشة في الاجتماع"
    },
    "Video Options": {
        "en": "Video Options",
        "de": "Videooptionen",
        "fr": "Options vidéo",
        "es": "Opciones de vídeo",
        "ar-SA": "خيارات الفيديو"
    },
    "Remote Quality": {
        "en": "Remote Quality",
        "de": "Remote-Qualität",
        "fr": "Qualité à distance",
        "es": "Calidad remota",
        "ar-SA": "جودة الاتصال البعيد"
    },
    "Video Quality": {
        "en": "Video Quality",
        "de": "Videoqualität",
        "fr": "Qualité vidéo",
        "es": "Calidad de vídeo",
        "ar-SA": "جودة الفيديو"
    },
    "Smooth - Lower Bandwidth": {
        "en": "Smooth - Lower Bandwidth",
        "de": "Flüssig - geringere Bandbreite",
        "fr": "Fluide - bande passante réduite",
        "es": "Fluida - menos ancho de banda",
        "ar-SA": "سلس - نطاق ترددي أقل"
    },
    "Balanced": {
        "en": "Balanced",
        "de": "Ausgewogen",
        "fr": "Équilibrée",
        "es": "Equilibrada",
        "ar-SA": "متوازن"
    },
    "Sharp - Clear Text": {
        "en": "Sharp - Clear Text",
        "de": "Scharf - klarer Text",
        "fr": "Nette - texte lisible",
        "es": "Nítida - texto claro",
        "ar-SA": "حاد - نص واضح"
    },
    "Ultra Clarity - Best Picture": {
        "en": "Ultra Clarity - Best Picture",
        "de": "Ultra-Klarheit - bestes Bild",
        "fr": "Ultra-netteté - meilleure image",
        "es": "Máxima nitidez - mejor imagen",
        "ar-SA": "وضوح فائق - أفضل صورة"
    },
    "Frame Rate": {
        "en": "Frame Rate",
        "de": "Bildrate",
        "fr": "Fréquence d'images",
        "es": "Velocidad de fotogramas",
        "ar-SA": "معدل الإطارات"
    },
    "Makes the text and controls on this page larger. The page still fits the window without scrolling.": {
        "en": "Makes the text and controls on this page larger. The page still fits the window without scrolling.",
        "de": "Vergrößert Text und Bedienelemente auf dieser Seite. Die Seite passt weiterhin ohne Scrollen ins Fenster.",
        "fr": "Agrandit le texte et les commandes de cette page. La page tient toujours dans la fenêtre sans défilement.",
        "es": "Agranda el texto y los controles de esta página. La página sigue cabiendo en la ventana sin desplazarse.",
        "ar-SA": "يكبّر النص وعناصر التحكم في هذه الصفحة. تظل الصفحة ضمن النافذة دون تمرير."
    },
    "Size Of Text On This Page": {
        "en": "Size Of Text On This Page",
        "de": "Textgröße auf dieser Seite",
        "fr": "Taille du texte sur cette page",
        "es": "Tamaño del texto en esta página",
        "ar-SA": "حجم النص في هذه الصفحة"
    },
    "Default": {
        "en": "Default",
        "de": "Standard",
        "fr": "Par défaut",
        "es": "Predeterminado",
        "ar-SA": "افتراضي"
    },
    "Large": {
        "en": "Large",
        "de": "Groß",
        "fr": "Grand",
        "es": "Grande",
        "ar-SA": "كبير"
    },
    "Larger": {
        "en": "Larger",
        "de": "Größer",
        "fr": "Plus grand",
        "es": "Más grande",
        "ar-SA": "أكبر"
    },
    "Largest": {
        "en": "Largest",
        "de": "Am größten",
        "fr": "Le plus grand",
        "es": "El más grande",
        "ar-SA": "الأكبر"
    },
    "View the installed Remote365 release and update preference": {
        "en": "View the installed Remote365 release and update preference",
        "de": "Installierte Remote365-Version und Update-Einstellung anzeigen",
        "fr": "Afficher la version installée de Remote365 et la préférence de mise à jour",
        "es": "Ver la versión instalada de Remote365 y la preferencia de actualización",
        "ar-SA": "عرض إصدار Remote365 المثبّت وتفضيل التحديث"
    },
    "Release Information": {
        "en": "Release Information",
        "de": "Versionsinformationen",
        "fr": "Informations sur la version",
        "es": "Información de la versión",
        "ar-SA": "معلومات الإصدار"
    },
    "Installed Version": {
        "en": "Installed Version",
        "de": "Installierte Version",
        "fr": "Version installée",
        "es": "Versión instalada",
        "ar-SA": "الإصدار المثبّت"
    },
    "Latest Version": {
        "en": "Latest Version",
        "de": "Neueste Version",
        "fr": "Dernière version",
        "es": "Última versión",
        "ar-SA": "أحدث إصدار"
    },
    "Update Status": {
        "en": "Update Status",
        "de": "Update-Status",
        "fr": "État de la mise à jour",
        "es": "Estado de la actualización",
        "ar-SA": "حالة التحديث"
    },
    "Manual Check": {
        "en": "Manual Check",
        "de": "Manuell prüfen",
        "fr": "Vérification manuelle",
        "es": "Comprobación manual",
        "ar-SA": "تحقق يدوي"
    },
    "Sign in to see your saved devices, groups and meetings on every machine": {
        "en": "Sign in to see your saved devices, groups and meetings on every machine",
        "de": "Melden Sie sich an, um Ihre gespeicherten Geräte, Gruppen und Besprechungen auf jedem Gerät zu sehen",
        "fr": "Connectez-vous pour retrouver vos appareils, groupes et réunions sur chaque machine",
        "es": "Inicia sesión para ver tus dispositivos, grupos y reuniones guardados en cualquier equipo",
        "ar-SA": "سجّل الدخول لرؤية أجهزتك ومجموعاتك واجتماعاتك المحفوظة على كل جهاز"
    },
    "This Device": {
        "en": "This Device",
        "de": "Dieses Gerät",
        "fr": "Cet appareil",
        "es": "Este dispositivo",
        "ar-SA": "هذا الجهاز"
    },
    "Host Status": {
        "en": "Host Status",
        "de": "Host-Status",
        "fr": "État de l'hôte",
        "es": "Estado del host",
        "ar-SA": "حالة المضيف"
    },
    "Remote365 Account": {
        "en": "Remote365 Account",
        "de": "Remote365-Konto",
        "fr": "Compte Remote365",
        "es": "Cuenta de Remote365",
        "ar-SA": "حساب Remote365"
    },
    "You are not signed in on this device.": {
        "en": "You are not signed in on this device.",
        "de": "Sie sind auf diesem Gerät nicht angemeldet.",
        "fr": "Vous n'êtes pas connecté sur cet appareil.",
        "es": "No has iniciado sesión en este dispositivo.",
        "ar-SA": "لم تسجّل الدخول على هذا الجهاز."
    },
    "Sign In": {
        "en": "Sign In",
        "de": "Anmelden",
        "fr": "Se connecter",
        "es": "Iniciar sesión",
        "ar-SA": "تسجيل الدخول"
    },
    "Sign In To Remote365...": {
        "en": "Sign In To Remote365...",
        "de": "Bei Remote365 anmelden...",
        "fr": "Se connecter à Remote365...",
        "es": "Iniciar sesión en Remote365...",
        "ar-SA": "تسجيل الدخول إلى Remote365..."
    },
    "New Here?": {
        "en": "New Here?",
        "de": "Neu hier?",
        "fr": "Nouveau ici ?",
        "es": "¿Eres nuevo?",
        "ar-SA": "جديد هنا؟"
    },
    "Create Account...": {
        "en": "Create Account...",
        "de": "Konto erstellen...",
        "fr": "Créer un compte...",
        "es": "Crear cuenta...",
        "ar-SA": "إنشاء حساب..."
    }
};
