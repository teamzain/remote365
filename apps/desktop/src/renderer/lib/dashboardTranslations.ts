import type { Language } from './translations';

/**
 * Full-phrase translations for the signed-in app (dashboard, devices, chat,
 * meetings, settings, admin, billing, session chrome), keyed by the exact
 * English text on screen. Merged into supplementalTranslations in
 * translations.ts; without these the DOM translator falls back to
 * word-by-word replacement.
 */
export const dashboardTranslations: Record<string, Record<Language, string>> = {
    "Toggle list": {
        "en": "Toggle list",
        "de": "Liste ein-/ausblenden",
        "fr": "Afficher/masquer la liste",
        "es": "Mostrar/ocultar lista",
        "ar-SA": "إظهار/إخفاء القائمة"
    },
    "Select country": {
        "en": "Select country",
        "de": "Land auswählen",
        "fr": "Sélectionner un pays",
        "es": "Seleccionar país",
        "ar-SA": "اختر الدولة"
    },
    "Share Your Feedback": {
        "en": "Share Your Feedback",
        "de": "Feedback geben",
        "fr": "Donnez votre avis",
        "es": "Comparte tu opinión",
        "ar-SA": "شاركنا رأيك"
    },
    "How satisfied are you with the Remote365 app?": {
        "en": "How satisfied are you with the Remote365 app?",
        "de": "Wie zufrieden sind Sie mit der Remote365-App?",
        "fr": "Êtes-vous satisfait de l'application Remote365 ?",
        "es": "¿Qué tan satisfecho estás con la aplicación Remote365?",
        "ar-SA": "ما مدى رضاك عن تطبيق Remote365؟"
    },
    "Rate Us": {
        "en": "Rate Us",
        "de": "Bewerten Sie uns",
        "fr": "Évaluez-nous",
        "es": "Califícanos",
        "ar-SA": "قيّمنا"
    },
    "Add A Comment": {
        "en": "Add A Comment",
        "de": "Kommentar hinzufügen",
        "fr": "Ajouter un commentaire",
        "es": "Añadir un comentario",
        "ar-SA": "أضف تعليقًا"
    },
    "Tell Us What You Think…": {
        "en": "Tell Us What You Think…",
        "de": "Sagen Sie uns Ihre Meinung…",
        "fr": "Dites-nous ce que vous en pensez…",
        "es": "Cuéntanos qué opinas…",
        "ar-SA": "أخبرنا برأيك…"
    },
    "Remote365 is locked while the remote session is active. Use the title bar to move or minimize this window, or end the session below.": {
        "en": "Remote365 is locked while the remote session is active. Use the title bar to move or minimize this window, or end the session below.",
        "de": "Remote365 ist gesperrt, solange die Remote-Sitzung aktiv ist. Verwenden Sie die Titelleiste, um dieses Fenster zu verschieben oder zu minimieren, oder beenden Sie die Sitzung unten.",
        "fr": "Remote365 est verrouillé pendant la session à distance. Utilisez la barre de titre pour déplacer ou réduire cette fenêtre, ou mettez fin à la session ci-dessous.",
        "es": "Remote365 está bloqueado mientras la sesión remota está activa. Usa la barra de título para mover o minimizar esta ventana, o finaliza la sesión a continuación.",
        "ar-SA": "يكون Remote365 مقفلاً أثناء نشاط الجلسة عن بُعد. استخدم شريط العنوان لنقل هذه النافذة أو تصغيرها، أو أنهِ الجلسة أدناه."
    },
    "Disconnect Session": {
        "en": "Disconnect Session",
        "de": "Sitzung trennen",
        "fr": "Déconnecter la session",
        "es": "Desconectar sesión",
        "ar-SA": "قطع اتصال الجلسة"
    },
    "Quick answers, or send us a message": {
        "en": "Quick answers, or send us a message",
        "de": "Schnelle Antworten oder senden Sie uns eine Nachricht",
        "fr": "Réponses rapides, ou envoyez-nous un message",
        "es": "Respuestas rápidas o envíanos un mensaje",
        "ar-SA": "إجابات سريعة، أو أرسل لنا رسالة"
    },
    "Common Questions": {
        "en": "Common Questions",
        "de": "Häufige Fragen",
        "fr": "Questions fréquentes",
        "es": "Preguntas frecuentes",
        "ar-SA": "الأسئلة الشائعة"
    },
    "Contact Support": {
        "en": "Contact Support",
        "de": "Support kontaktieren",
        "fr": "Contacter le support",
        "es": "Contactar con soporte",
        "ar-SA": "اتصل بالدعم"
    },
    "Your Name": {
        "en": "Your Name",
        "de": "Ihr Name",
        "fr": "Votre nom",
        "es": "Tu nombre",
        "ar-SA": "اسمك"
    },
    "Your Email": {
        "en": "Your Email",
        "de": "Ihre E-Mail",
        "fr": "Votre e-mail",
        "es": "Tu correo electrónico",
        "ar-SA": "بريدك الإلكتروني"
    },
    "How can we help?": {
        "en": "How can we help?",
        "de": "Wie können wir helfen?",
        "fr": "Comment pouvons-nous vous aider ?",
        "es": "¿Cómo podemos ayudarte?",
        "ar-SA": "كيف يمكننا مساعدتك؟"
    },
    "Please fill in your name, email and message.": {
        "en": "Please fill in your name, email and message.",
        "de": "Bitte geben Sie Ihren Namen, Ihre E-Mail und Ihre Nachricht ein.",
        "fr": "Veuillez indiquer votre nom, votre e-mail et votre message.",
        "es": "Completa tu nombre, correo electrónico y mensaje.",
        "ar-SA": "يرجى إدخال اسمك وبريدك الإلكتروني ورسالتك."
    },
    "Camera Is Off": {
        "en": "Camera Is Off",
        "de": "Kamera ist aus",
        "fr": "La caméra est désactivée",
        "es": "La cámara está apagada",
        "ar-SA": "الكاميرا متوقفة"
    },
    "Meeting Preview": {
        "en": "Meeting Preview",
        "de": "Besprechungsvorschau",
        "fr": "Aperçu de la réunion",
        "es": "Vista previa de la reunión",
        "ar-SA": "معاينة الاجتماع"
    },
    "Here's Your Joining Info": {
        "en": "Here's Your Joining Info",
        "de": "Hier sind Ihre Teilnahmeinformationen",
        "fr": "Voici vos informations de connexion",
        "es": "Aquí tienes la información para unirse",
        "ar-SA": "إليك معلومات الانضمام"
    },
    "Send this to people you want to meet with. Save it so you can use it later, too.": {
        "en": "Send this to people you want to meet with. Save it so you can use it later, too.",
        "de": "Senden Sie dies an die Personen, mit denen Sie sich treffen möchten. Speichern Sie es, um es später erneut zu verwenden.",
        "fr": "Envoyez-les aux personnes avec qui vous souhaitez vous réunir. Enregistrez-les pour pouvoir les réutiliser plus tard.",
        "es": "Envía esto a las personas con quienes quieres reunirte. Guárdalo para usarlo más tarde también.",
        "ar-SA": "أرسل هذه المعلومات إلى الأشخاص الذين تريد الاجتماع بهم. احفظها لتتمكن من استخدامها لاحقًا أيضًا."
    },
    "Google Calendar": {
        "en": "Google Calendar",
        "de": "Google Kalender",
        "fr": "Google Agenda",
        "es": "Google Calendar",
        "ar-SA": "تقويم Google"
    },
    "Done": {
        "en": "Done",
        "de": "Fertig",
        "fr": "Terminé",
        "es": "Listo",
        "ar-SA": "تم"
    },
    "Copy Joining Info": {
        "en": "Copy Joining Info",
        "de": "Teilnahmeinfos kopieren",
        "fr": "Copier les infos de connexion",
        "es": "Copiar información para unirse",
        "ar-SA": "نسخ معلومات الانضمام"
    },
    "Test Microphone": {
        "en": "Test Microphone",
        "de": "Mikrofon testen",
        "fr": "Tester le micro",
        "es": "Probar micrófono",
        "ar-SA": "اختبار الميكروفون"
    },
    "Say something to test your input.": {
        "en": "Say something to test your input.",
        "de": "Sagen Sie etwas, um Ihre Eingabe zu testen.",
        "fr": "Dites quelque chose pour tester votre entrée.",
        "es": "Di algo para probar la entrada.",
        "ar-SA": "قل شيئًا لاختبار الإدخال."
    },
    "Play Test Sound": {
        "en": "Play Test Sound",
        "de": "Testton abspielen",
        "fr": "Lire le son de test",
        "es": "Reproducir sonido de prueba",
        "ar-SA": "تشغيل صوت الاختبار"
    },
    "Play": {
        "en": "Play",
        "de": "Abspielen",
        "fr": "Lire",
        "es": "Reproducir",
        "ar-SA": "تشغيل"
    },
    "Camera Preview": {
        "en": "Camera Preview",
        "de": "Kameravorschau",
        "fr": "Aperçu de la caméra",
        "es": "Vista previa de la cámara",
        "ar-SA": "معاينة الكاميرا"
    },
    "Live camera preview here.": {
        "en": "Live camera preview here.",
        "de": "Hier erscheint die Live-Kameravorschau.",
        "fr": "Aperçu de la caméra en direct ici.",
        "es": "Vista previa de la cámara en directo aquí.",
        "ar-SA": "المعاينة المباشرة للكاميرا هنا."
    },
    "No Devices Found": {
        "en": "No Devices Found",
        "de": "Keine Geräte gefunden",
        "fr": "Aucun appareil trouvé",
        "es": "No se encontraron dispositivos",
        "ar-SA": "لم يتم العثور على أجهزة"
    },
    "Close Settings": {
        "en": "Close Settings",
        "de": "Einstellungen schließen",
        "fr": "Fermer les paramètres",
        "es": "Cerrar configuración",
        "ar-SA": "إغلاق الإعدادات"
    },
    "Configure all the required settings so that the end user can hear you.": {
        "en": "Configure all the required settings so that the end user can hear you.",
        "de": "Konfigurieren Sie alle erforderlichen Einstellungen, damit der Endbenutzer Sie hören kann.",
        "fr": "Configurez tous les paramètres requis pour que l'utilisateur final puisse vous entendre.",
        "es": "Configura todos los ajustes necesarios para que el usuario final pueda oírte.",
        "ar-SA": "اضبط جميع الإعدادات المطلوبة حتى يتمكن المستخدم النهائي من سماعك."
    },
    "Input Device": {
        "en": "Input Device",
        "de": "Eingabegerät",
        "fr": "Périphérique d'entrée",
        "es": "Dispositivo de entrada",
        "ar-SA": "جهاز الإدخال"
    },
    "Default Microphone": {
        "en": "Default Microphone",
        "de": "Standardmikrofon",
        "fr": "Micro par défaut",
        "es": "Micrófono predeterminado",
        "ar-SA": "الميكروفون الافتراضي"
    },
    "Noise Suppression": {
        "en": "Noise Suppression",
        "de": "Rauschunterdrückung",
        "fr": "Suppression du bruit",
        "es": "Supresión de ruido",
        "ar-SA": "إلغاء الضوضاء"
    },
    "Reduces background noise during sessions.": {
        "en": "Reduces background noise during sessions.",
        "de": "Reduziert Hintergrundgeräusche während Sitzungen.",
        "fr": "Réduit le bruit de fond pendant les sessions.",
        "es": "Reduce el ruido de fondo durante las sesiones.",
        "ar-SA": "يقلل الضوضاء الخلفية أثناء الجلسات."
    },
    "Configure all the required settings so that you can hear the end user.": {
        "en": "Configure all the required settings so that you can hear the end user.",
        "de": "Konfigurieren Sie alle erforderlichen Einstellungen, damit Sie den Endbenutzer hören können.",
        "fr": "Configurez tous les paramètres requis pour pouvoir entendre l'utilisateur final.",
        "es": "Configura todos los ajustes necesarios para poder oír al usuario final.",
        "ar-SA": "اضبط جميع الإعدادات المطلوبة حتى تتمكن من سماع المستخدم النهائي."
    },
    "Output Device": {
        "en": "Output Device",
        "de": "Ausgabegerät",
        "fr": "Périphérique de sortie",
        "es": "Dispositivo de salida",
        "ar-SA": "جهاز الإخراج"
    },
    "Default Speaker": {
        "en": "Default Speaker",
        "de": "Standardlautsprecher",
        "fr": "Haut-parleur par défaut",
        "es": "Altavoz predeterminado",
        "ar-SA": "مكبر الصوت الافتراضي"
    },
    "Mute": {
        "en": "Mute",
        "de": "Stummschalten",
        "fr": "Couper le son",
        "es": "Silenciar",
        "ar-SA": "كتم الصوت"
    },
    "Configure all the required settings for the best video experience.": {
        "en": "Configure all the required settings for the best video experience.",
        "de": "Konfigurieren Sie alle erforderlichen Einstellungen für das beste Videoerlebnis.",
        "fr": "Configurez tous les paramètres requis pour une expérience vidéo optimale.",
        "es": "Configura todos los ajustes necesarios para obtener la mejor experiencia de vídeo.",
        "ar-SA": "اضبط جميع الإعدادات المطلوبة للحصول على أفضل تجربة فيديو."
    },
    "Camera": {
        "en": "Camera",
        "de": "Kamera",
        "fr": "Caméra",
        "es": "Cámara",
        "ar-SA": "الكاميرا"
    },
    "Default Camera": {
        "en": "Default Camera",
        "de": "Standardkamera",
        "fr": "Caméra par défaut",
        "es": "Cámara predeterminada",
        "ar-SA": "الكاميرا الافتراضية"
    },
    "Follow My Face": {
        "en": "Follow My Face",
        "de": "Meinem Gesicht folgen",
        "fr": "Suivre mon visage",
        "es": "Seguir mi cara",
        "ar-SA": "تتبع وجهي"
    },
    "The camera will keep your face in center.": {
        "en": "The camera will keep your face in center.",
        "de": "Die Kamera hält Ihr Gesicht in der Mitte.",
        "fr": "La caméra gardera votre visage au centre.",
        "es": "La cámara mantendrá tu cara en el centro.",
        "ar-SA": "ستُبقي الكاميرا وجهك في المنتصف."
    },
    "What's New": {
        "en": "What's New",
        "de": "Neuigkeiten",
        "fr": "Nouveautés",
        "es": "Novedades",
        "ar-SA": "ما الجديد"
    },
    "Try It Now": {
        "en": "Try It Now",
        "de": "Jetzt ausprobieren",
        "fr": "Essayer maintenant",
        "es": "Pruébalo ahora",
        "ar-SA": "جرّبه الآن"
    },
    "Next": {
        "en": "Next",
        "de": "Weiter",
        "fr": "Suivant",
        "es": "Siguiente",
        "ar-SA": "التالي"
    },
    "Meetings Just Got An Upgrade": {
        "en": "Meetings Just Got An Upgrade",
        "de": "Besprechungen wurden verbessert",
        "fr": "Les réunions font peau neuve",
        "es": "Las reuniones han mejorado",
        "ar-SA": "الاجتماعات أصبحت أفضل"
    },
    "The New Meeting button now gives you three ways to start — pick what fits the moment.": {
        "en": "The New Meeting button now gives you three ways to start — pick what fits the moment.",
        "de": "Die Schaltfläche „Neue Besprechung“ bietet jetzt drei Möglichkeiten zum Starten — wählen Sie, was gerade passt.",
        "fr": "Le bouton Nouvelle réunion vous offre désormais trois façons de commencer — choisissez celle qui convient.",
        "es": "El botón Nueva reunión ahora te ofrece tres formas de empezar — elige la que mejor se adapte al momento.",
        "ar-SA": "يوفر لك زر \"اجتماع جديد\" الآن ثلاث طرق للبدء — اختر ما يناسب الموقف."
    },
    "Create A Meeting For Later": {
        "en": "Create A Meeting For Later",
        "de": "Besprechung für später erstellen",
        "fr": "Créer une réunion pour plus tard",
        "es": "Crear una reunión para más tarde",
        "ar-SA": "إنشاء اجتماع لوقت لاحق"
    },
    "Get a link that stays active for 7 days. Copy the joining info now and share it — the room is ready whenever you are.": {
        "en": "Get a link that stays active for 7 days. Copy the joining info now and share it — the room is ready whenever you are.",
        "de": "Erhalten Sie einen Link, der 7 Tage lang aktiv bleibt. Kopieren Sie jetzt die Teilnahmeinfos und teilen Sie sie — der Raum ist bereit, wann immer Sie es sind.",
        "fr": "Obtenez un lien actif pendant 7 jours. Copiez les infos de connexion maintenant et partagez-les — la salle est prête quand vous l'êtes.",
        "es": "Obtén un enlace que permanece activo durante 7 días. Copia ahora la información para unirse y compártela — la sala estará lista cuando tú lo estés.",
        "ar-SA": "احصل على رابط يظل نشطًا لمدة 7 أيام. انسخ معلومات الانضمام الآن وشاركها — الغرفة جاهزة متى كنت مستعدًا."
    },
    "Schedule In Google Calendar": {
        "en": "Schedule In Google Calendar",
        "de": "In Google Kalender planen",
        "fr": "Planifier dans Google Agenda",
        "es": "Programar en Google Calendar",
        "ar-SA": "الجدولة في تقويم Google"
    },
    "One click opens a prefilled Google Calendar event with your meeting link inside — set the time, invite guests, done.": {
        "en": "One click opens a prefilled Google Calendar event with your meeting link inside — set the time, invite guests, done.",
        "de": "Ein Klick öffnet einen vorausgefüllten Google Kalender-Termin mit Ihrem Besprechungslink — Zeit festlegen, Gäste einladen, fertig.",
        "fr": "Un clic ouvre un événement Google Agenda prérempli avec le lien de votre réunion — choisissez l'heure, invitez vos participants, c'est fait.",
        "es": "Un clic abre un evento de Google Calendar ya rellenado con el enlace de tu reunión — elige la hora, invita a los asistentes y listo.",
        "ar-SA": "بنقرة واحدة يُفتح حدث في تقويم Google معبأ مسبقًا يتضمن رابط اجتماعك — حدد الوقت، وادعُ الضيوف، وانتهى الأمر."
    },
    "Skip": {
        "en": "Skip",
        "de": "Überspringen",
        "fr": "Passer",
        "es": "Omitir",
        "ar-SA": "تخطي"
    },
    "Start An Instant Meeting": {
        "en": "Start An Instant Meeting",
        "de": "Sofortbesprechung starten",
        "fr": "Démarrer une réunion instantanée",
        "es": "Iniciar una reunión instantánea",
        "ar-SA": "بدء اجتماع فوري"
    },
    "Screen Sharing": {
        "en": "Screen Sharing",
        "de": "Bildschirmfreigabe",
        "fr": "Partage d'écran",
        "es": "Compartir pantalla",
        "ar-SA": "مشاركة الشاشة"
    },
    "Share Screen": {
        "en": "Share Screen",
        "de": "Bildschirm freigeben",
        "fr": "Partager l'écran",
        "es": "Compartir pantalla",
        "ar-SA": "مشاركة الشاشة"
    },
    "Required": {
        "en": "Required",
        "de": "Erforderlich",
        "fr": "Obligatoire",
        "es": "Obligatorio",
        "ar-SA": "مطلوب"
    },
    "Drag the grip handle to reorder, or click the eye to hide an item.": {
        "en": "Drag the grip handle to reorder, or click the eye to hide an item.",
        "de": "Ziehen Sie am Griff, um die Reihenfolge zu ändern, oder klicken Sie auf das Auge, um ein Element auszublenden.",
        "fr": "Faites glisser la poignée pour réorganiser, ou cliquez sur l'œil pour masquer un élément.",
        "es": "Arrastra el asa para reordenar o haz clic en el ojo para ocultar un elemento.",
        "ar-SA": "اسحب مقبض السحب لإعادة الترتيب، أو انقر على أيقونة العين لإخفاء عنصر."
    },
    "Main Navigation": {
        "en": "Main Navigation",
        "de": "Hauptnavigation",
        "fr": "Navigation principale",
        "es": "Navegación principal",
        "ar-SA": "التنقل الرئيسي"
    },
    "No main items.": {
        "en": "No main items.",
        "de": "Keine Hauptelemente.",
        "fr": "Aucun élément principal.",
        "es": "No hay elementos principales.",
        "ar-SA": "لا توجد عناصر رئيسية."
    },
    "Utility": {
        "en": "Utility",
        "de": "Hilfsfunktionen",
        "fr": "Utilitaires",
        "es": "Utilidades",
        "ar-SA": "الأدوات المساعدة"
    },
    "No utility items.": {
        "en": "No utility items.",
        "de": "Keine Hilfselemente.",
        "fr": "Aucun élément utilitaire.",
        "es": "No hay elementos de utilidades.",
        "ar-SA": "لا توجد عناصر مساعدة."
    },
    "Reset To Default": {
        "en": "Reset To Default",
        "de": "Auf Standard zurücksetzen",
        "fr": "Rétablir les valeurs par défaut",
        "es": "Restablecer valores predeterminados",
        "ar-SA": "إعادة التعيين إلى الافتراضي"
    },
    "Move Up": {
        "en": "Move Up",
        "de": "Nach oben",
        "fr": "Monter",
        "es": "Subir",
        "ar-SA": "نقل لأعلى"
    },
    "Move Down": {
        "en": "Move Down",
        "de": "Nach unten",
        "fr": "Descendre",
        "es": "Bajar",
        "ar-SA": "نقل لأسفل"
    },
    "You're on the": {
        "en": "You're on the",
        "de": "Sie nutzen den Tarif",
        "fr": "Vous êtes sur l'offre",
        "es": "Estás en el plan",
        "ar-SA": "أنت على خطة"
    },
    "Trial": {
        "en": "Trial",
        "de": "Testversion",
        "fr": "Essai",
        "es": "Prueba",
        "ar-SA": "التجريبية"
    },
    "Security Center": {
        "en": "Security Center",
        "de": "Sicherheitscenter",
        "fr": "Centre de sécurité",
        "es": "Centro de seguridad",
        "ar-SA": "مركز الأمان"
    },
    "Manage your security settings and strengthen your protection.": {
        "en": "Manage your security settings and strengthen your protection.",
        "de": "Verwalten Sie Ihre Sicherheitseinstellungen und stärken Sie Ihren Schutz.",
        "fr": "Gérez vos paramètres de sécurité et renforcez votre protection.",
        "es": "Administra tu configuración de seguridad y refuerza tu protección.",
        "ar-SA": "أدر إعدادات الأمان وعزّز حمايتك."
    },
    "Security Level": {
        "en": "Security Level",
        "de": "Sicherheitsstufe",
        "fr": "Niveau de sécurité",
        "es": "Nivel de seguridad",
        "ar-SA": "مستوى الأمان"
    },
    "Current Level": {
        "en": "Current Level",
        "de": "Aktuelle Stufe",
        "fr": "Niveau actuel",
        "es": "Nivel actual",
        "ar-SA": "المستوى الحالي"
    },
    "Overall Score": {
        "en": "Overall Score",
        "de": "Gesamtpunktzahl",
        "fr": "Score global",
        "es": "Puntuación general",
        "ar-SA": "النتيجة الإجمالية"
    },
    "Total Progress": {
        "en": "Total Progress",
        "de": "Gesamtfortschritt",
        "fr": "Progression totale",
        "es": "Progreso total",
        "ar-SA": "التقدم الإجمالي"
    },
    "Secure user accounts with SSO or 2FA and limit permissions to reduce risks and strengthen security.": {
        "en": "Secure user accounts with SSO or 2FA and limit permissions to reduce risks and strengthen security.",
        "de": "Sichern Sie Benutzerkonten mit SSO oder 2FA und beschränken Sie Berechtigungen, um Risiken zu verringern und die Sicherheit zu stärken.",
        "fr": "Sécurisez les comptes utilisateur avec le SSO ou la 2FA et limitez les autorisations pour réduire les risques et renforcer la sécurité.",
        "es": "Protege las cuentas de usuario con SSO o 2FA y limita los permisos para reducir riesgos y reforzar la seguridad.",
        "ar-SA": "أمّن حسابات المستخدمين باستخدام SSO أو 2FA وقيّد الأذونات لتقليل المخاطر وتعزيز الأمان."
    },
    "View And Manage": {
        "en": "View And Manage",
        "de": "Anzeigen und verwalten",
        "fr": "Afficher et gérer",
        "es": "Ver y administrar",
        "ar-SA": "عرض وإدارة"
    },
    "Check your devices' security and reinforce protection to ensure safe access.": {
        "en": "Check your devices' security and reinforce protection to ensure safe access.",
        "de": "Überprüfen Sie die Sicherheit Ihrer Geräte und verstärken Sie den Schutz für einen sicheren Zugriff.",
        "fr": "Vérifiez la sécurité de vos appareils et renforcez leur protection pour garantir un accès sûr.",
        "es": "Comprueba la seguridad de tus dispositivos y refuerza la protección para garantizar un acceso seguro.",
        "ar-SA": "تحقق من أمان أجهزتك وعزّز الحماية لضمان وصول آمن."
    },
    "Connections": {
        "en": "Connections",
        "de": "Verbindungen",
        "fr": "Connexions",
        "es": "Conexiones",
        "ar-SA": "الاتصالات"
    },
    "Manage settings and control sharing to protect sensitive data and enhance privacy.": {
        "en": "Manage settings and control sharing to protect sensitive data and enhance privacy.",
        "de": "Verwalten Sie Einstellungen und steuern Sie die Freigabe, um sensible Daten zu schützen und die Privatsphäre zu verbessern.",
        "fr": "Gérez les paramètres et contrôlez le partage pour protéger les données sensibles et renforcer la confidentialité.",
        "es": "Administra la configuración y controla el uso compartido para proteger los datos confidenciales y mejorar la privacidad.",
        "ar-SA": "أدر الإعدادات وتحكم في المشاركة لحماية البيانات الحساسة وتعزيز الخصوصية."
    },
    "Roles & Permissions": {
        "en": "Roles & Permissions",
        "de": "Rollen & Berechtigungen",
        "fr": "Rôles et autorisations",
        "es": "Roles y permisos",
        "ar-SA": "الأدوار والأذونات"
    },
    "Choose what Admins and Viewers can see and use. Owners always have full access.": {
        "en": "Choose what Admins and Viewers can see and use. Owners always have full access.",
        "de": "Legen Sie fest, was Admins und Betrachter sehen und nutzen können. Inhaber haben immer vollen Zugriff.",
        "fr": "Choisissez ce que les administrateurs et les lecteurs peuvent voir et utiliser. Les propriétaires ont toujours un accès complet.",
        "es": "Elige qué pueden ver y usar los administradores y los lectores. Los propietarios siempre tienen acceso total.",
        "ar-SA": "اختر ما يمكن للمسؤولين والمشاهدين رؤيته واستخدامه. يتمتع المالكون دائمًا بوصول كامل."
    },
    "Saved": {
        "en": "Saved",
        "de": "Gespeichert",
        "fr": "Enregistré",
        "es": "Guardado",
        "ar-SA": "تم الحفظ"
    },
    "Only the organization owner can change these. You're viewing the current settings.": {
        "en": "Only the organization owner can change these. You're viewing the current settings.",
        "de": "Nur der Inhaber der Organisation kann diese ändern. Sie sehen die aktuellen Einstellungen.",
        "fr": "Seul le propriétaire de l'organisation peut les modifier. Vous consultez les paramètres actuels.",
        "es": "Solo el propietario de la organización puede cambiarlos. Estás viendo la configuración actual.",
        "ar-SA": "يمكن لمالك المؤسسة فقط تغيير هذه الإعدادات. أنت تعرض الإعدادات الحالية."
    },
    "Feature": {
        "en": "Feature",
        "de": "Funktion",
        "fr": "Fonctionnalité",
        "es": "Función",
        "ar-SA": "الميزة"
    },
    "Device Groups": {
        "en": "Device Groups",
        "de": "Gerätegruppen",
        "fr": "Groupes d'appareils",
        "es": "Grupos de dispositivos",
        "ar-SA": "مجموعات الأجهزة"
    },
    "Group devices and assign access to members.": {
        "en": "Group devices and assign access to members.",
        "de": "Gruppieren Sie Geräte und weisen Sie Mitgliedern Zugriff zu.",
        "fr": "Regroupez les appareils et attribuez l'accès aux membres.",
        "es": "Agrupa dispositivos y asigna acceso a los miembros.",
        "ar-SA": "جمّع الأجهزة وامنح الأعضاء صلاحية الوصول."
    },
    "New Group": {
        "en": "New Group",
        "de": "Neue Gruppe",
        "fr": "Nouveau groupe",
        "es": "Nuevo grupo",
        "ar-SA": "مجموعة جديدة"
    },
    "Color": {
        "en": "Color",
        "de": "Farbe",
        "fr": "Couleur",
        "es": "Color",
        "ar-SA": "اللون"
    },
    "Created": {
        "en": "Created",
        "de": "Erstellt",
        "fr": "Créé",
        "es": "Creado",
        "ar-SA": "تاريخ الإنشاء"
    },
    "No device groups yet.": {
        "en": "No device groups yet.",
        "de": "Noch keine Gerätegruppen.",
        "fr": "Aucun groupe d'appareils pour le moment.",
        "es": "Aún no hay grupos de dispositivos.",
        "ar-SA": "لا توجد مجموعات أجهزة بعد."
    },
    "Save Group": {
        "en": "Save Group",
        "de": "Gruppe speichern",
        "fr": "Enregistrer le groupe",
        "es": "Guardar grupo",
        "ar-SA": "حفظ المجموعة"
    },
    "Delete Group?": {
        "en": "Delete Group?",
        "de": "Gruppe löschen?",
        "fr": "Supprimer le groupe ?",
        "es": "¿Eliminar grupo?",
        "ar-SA": "حذف المجموعة؟"
    },
    "This will remove the group but not the devices or members it contains. Continue?": {
        "en": "This will remove the group but not the devices or members it contains. Continue?",
        "de": "Dadurch wird die Gruppe entfernt, nicht aber die enthaltenen Geräte oder Mitglieder. Fortfahren?",
        "fr": "Le groupe sera supprimé, mais pas les appareils ni les membres qu'il contient. Continuer ?",
        "es": "Se eliminará el grupo, pero no los dispositivos ni los miembros que contiene. ¿Continuar?",
        "ar-SA": "سيؤدي هذا إلى إزالة المجموعة دون الأجهزة أو الأعضاء الموجودين فيها. هل تريد المتابعة؟"
    },
    "Upgrade": {
        "en": "Upgrade",
        "de": "Upgrade",
        "fr": "Mettre à niveau",
        "es": "Mejorar plan",
        "ar-SA": "ترقية"
    },
    "Set the preferences for your company.": {
        "en": "Set the preferences for your company.",
        "de": "Legen Sie die Einstellungen für Ihr Unternehmen fest.",
        "fr": "Définissez les préférences de votre entreprise.",
        "es": "Establece las preferencias de tu empresa.",
        "ar-SA": "حدد تفضيلات شركتك."
    },
    "Couldn't Save": {
        "en": "Couldn't Save",
        "de": "Speichern fehlgeschlagen",
        "fr": "Échec de l'enregistrement",
        "es": "No se pudo guardar",
        "ar-SA": "تعذّر الحفظ"
    },
    "Only the organization owner can change these settings.": {
        "en": "Only the organization owner can change these settings.",
        "de": "Nur der Inhaber der Organisation kann diese Einstellungen ändern.",
        "fr": "Seul le propriétaire de l'organisation peut modifier ces paramètres.",
        "es": "Solo el propietario de la organización puede cambiar esta configuración.",
        "ar-SA": "يمكن لمالك المؤسسة فقط تغيير هذه الإعدادات."
    },
    "Viewer": {
        "en": "Viewer",
        "de": "Betrachter",
        "fr": "Lecteur",
        "es": "Lector",
        "ar-SA": "مشاهد"
    },
    "Admin": {
        "en": "Admin",
        "de": "Admin",
        "fr": "Administrateur",
        "es": "Administrador",
        "ar-SA": "مسؤول"
    },
    "Organization Management": {
        "en": "Organization Management",
        "de": "Organisationsverwaltung",
        "fr": "Gestion de l'organisation",
        "es": "Gestión de la organización",
        "ar-SA": "إدارة المؤسسة"
    },
    "Team": {
        "en": "Team",
        "de": "Team",
        "fr": "Équipe",
        "es": "Equipo",
        "ar-SA": "الفريق"
    },
    "Policy": {
        "en": "Policy",
        "de": "Richtlinie",
        "fr": "Stratégie",
        "es": "Política",
        "ar-SA": "السياسة"
    },
    "License Usage": {
        "en": "License Usage",
        "de": "Lizenznutzung",
        "fr": "Utilisation des licences",
        "es": "Uso de licencias",
        "ar-SA": "استخدام التراخيص"
    },
    "Subscription": {
        "en": "Subscription",
        "de": "Abonnement",
        "fr": "Abonnement",
        "es": "Suscripción",
        "ar-SA": "الاشتراك"
    },
    "Assign Policies": {
        "en": "Assign Policies",
        "de": "Richtlinien zuweisen",
        "fr": "Attribuer des stratégies",
        "es": "Asignar políticas",
        "ar-SA": "تعيين السياسات"
    },
    "Give other users access to your devices and specify their account privileges.": {
        "en": "Give other users access to your devices and specify their account privileges.",
        "de": "Gewähren Sie anderen Benutzern Zugriff auf Ihre Geräte und legen Sie deren Kontoberechtigungen fest.",
        "fr": "Donnez à d'autres utilisateurs l'accès à vos appareils et définissez leurs privilèges de compte.",
        "es": "Da acceso a tus dispositivos a otros usuarios y especifica los privilegios de su cuenta.",
        "ar-SA": "امنح المستخدمين الآخرين صلاحية الوصول إلى أجهزتك وحدد امتيازات حساباتهم."
    },
    "Create User Roles": {
        "en": "Create User Roles",
        "de": "Benutzerrollen erstellen",
        "fr": "Créer des rôles utilisateur",
        "es": "Crear roles de usuario",
        "ar-SA": "إنشاء أدوار المستخدمين"
    },
    "Create and manage roles of your company and give them the required permission.": {
        "en": "Create and manage roles of your company and give them the required permission.",
        "de": "Erstellen und verwalten Sie die Rollen Ihres Unternehmens und erteilen Sie ihnen die erforderlichen Berechtigungen.",
        "fr": "Créez et gérez les rôles de votre entreprise et accordez-leur les autorisations nécessaires.",
        "es": "Crea y administra los roles de tu empresa y asígnales los permisos necesarios.",
        "ar-SA": "أنشئ أدوار شركتك وأدرها وامنحها الأذونات المطلوبة."
    },
    "Manage Access": {
        "en": "Manage Access",
        "de": "Zugriff verwalten",
        "fr": "Gérer l'accès",
        "es": "Administrar acceso",
        "ar-SA": "إدارة الوصول"
    },
    "Set up conditional access for users and devices.": {
        "en": "Set up conditional access for users and devices.",
        "de": "Richten Sie bedingten Zugriff für Benutzer und Geräte ein.",
        "fr": "Configurez l'accès conditionnel pour les utilisateurs et les appareils.",
        "es": "Configura el acceso condicional para usuarios y dispositivos.",
        "ar-SA": "إعداد الوصول المشروط للمستخدمين والأجهزة."
    },
    "Medium": {
        "en": "Medium",
        "de": "Mittel",
        "fr": "Moyen",
        "es": "Medio",
        "ar-SA": "متوسط"
    },
    "Low": {
        "en": "Low",
        "de": "Niedrig",
        "fr": "Faible",
        "es": "Bajo",
        "ar-SA": "منخفض"
    },
    "Licenses & Plan": {
        "en": "Licenses & Plan",
        "de": "Lizenzen & Tarif",
        "fr": "Licences et offre",
        "es": "Licencias y plan",
        "ar-SA": "التراخيص والخطة"
    },
    "See the workspace plan, license usage, and upgrade options.": {
        "en": "See the workspace plan, license usage, and upgrade options.",
        "de": "Sehen Sie den Tarif des Arbeitsbereichs, die Lizenznutzung und Upgrade-Optionen ein.",
        "fr": "Consultez l'offre de l'espace de travail, l'utilisation des licences et les options de mise à niveau.",
        "es": "Consulta el plan del espacio de trabajo, el uso de licencias y las opciones de mejora.",
        "ar-SA": "اطّلع على خطة مساحة العمل واستخدام التراخيص وخيارات الترقية."
    },
    "Access the team chat.": {
        "en": "Access the team chat.",
        "de": "Auf den Team-Chat zugreifen.",
        "fr": "Accéder au chat d'équipe.",
        "es": "Acceder al chat del equipo.",
        "ar-SA": "الوصول إلى دردشة الفريق."
    },
    "Remote Support": {
        "en": "Remote Support",
        "de": "Fernsupport",
        "fr": "Assistance à distance",
        "es": "Soporte remoto",
        "ar-SA": "الدعم عن بُعد"
    },
    "Start remote-support connections to devices.": {
        "en": "Start remote-support connections to devices.",
        "de": "Fernsupport-Verbindungen zu Geräten starten.",
        "fr": "Démarrer des connexions d'assistance à distance vers des appareils.",
        "es": "Iniciar conexiones de soporte remoto a dispositivos.",
        "ar-SA": "بدء اتصالات الدعم عن بُعد بالأجهزة."
    },
    "Send product feedback.": {
        "en": "Send product feedback.",
        "de": "Produktfeedback senden.",
        "fr": "Envoyer un avis sur le produit.",
        "es": "Enviar comentarios sobre el producto.",
        "ar-SA": "إرسال ملاحظات حول المنتج."
    },
    "Open the help menu.": {
        "en": "Open the help menu.",
        "de": "Hilfemenü öffnen.",
        "fr": "Ouvrir le menu d'aide.",
        "es": "Abrir el menú de ayuda.",
        "ar-SA": "فتح قائمة المساعدة."
    },
    "Open the organization admin settings (members, devices, policies, billing).": {
        "en": "Open the organization admin settings (members, devices, policies, billing).",
        "de": "Admin-Einstellungen der Organisation öffnen (Mitglieder, Geräte, Richtlinien, Abrechnung).",
        "fr": "Ouvrir les paramètres d'administration de l'organisation (membres, appareils, stratégies, facturation).",
        "es": "Abrir la configuración de administración de la organización (miembros, dispositivos, políticas, facturación).",
        "ar-SA": "فتح إعدادات إدارة المؤسسة (الأعضاء، الأجهزة، السياسات، الفوترة)."
    },
    "Company Name": {
        "en": "Company Name",
        "de": "Firmenname",
        "fr": "Nom de l'entreprise",
        "es": "Nombre de la empresa",
        "ar-SA": "اسم الشركة"
    },
    "Choose the name you want to display for this company.": {
        "en": "Choose the name you want to display for this company.",
        "de": "Wählen Sie den Namen, der für dieses Unternehmen angezeigt werden soll.",
        "fr": "Choisissez le nom à afficher pour cette entreprise.",
        "es": "Elige el nombre que quieres mostrar para esta empresa.",
        "ar-SA": "اختر الاسم الذي تريد عرضه لهذه الشركة."
    },
    "Require Two-Factor Authentication": {
        "en": "Require Two-Factor Authentication",
        "de": "Zwei-Faktor-Authentifizierung erzwingen",
        "fr": "Exiger l'authentification à deux facteurs",
        "es": "Exigir autenticación en dos pasos",
        "ar-SA": "طلب المصادقة الثنائية"
    },
    "Every member of your organization must set up 2FA to sign in.": {
        "en": "Every member of your organization must set up 2FA to sign in.",
        "de": "Jedes Mitglied Ihrer Organisation muss 2FA einrichten, um sich anzumelden.",
        "fr": "Chaque membre de votre organisation doit configurer la 2FA pour se connecter.",
        "es": "Todos los miembros de tu organización deben configurar la 2FA para iniciar sesión.",
        "ar-SA": "يجب على كل عضو في مؤسستك إعداد 2FA لتسجيل الدخول."
    },
    "Default Role For New Members": {
        "en": "Default Role For New Members",
        "de": "Standardrolle für neue Mitglieder",
        "fr": "Rôle par défaut des nouveaux membres",
        "es": "Rol predeterminado para nuevos miembros",
        "ar-SA": "الدور الافتراضي للأعضاء الجدد"
    },
    "The role automatically assigned when someone joins your organization.": {
        "en": "The role automatically assigned when someone joins your organization.",
        "de": "Die Rolle, die automatisch zugewiesen wird, wenn jemand Ihrer Organisation beitritt.",
        "fr": "Rôle attribué automatiquement lorsqu'une personne rejoint votre organisation.",
        "es": "El rol que se asigna automáticamente cuando alguien se une a tu organización.",
        "ar-SA": "الدور الذي يُعيَّن تلقائيًا عند انضمام شخص ما إلى مؤسستك."
    },
    "Company Contact List": {
        "en": "Company Contact List",
        "de": "Firmenkontaktliste",
        "fr": "Liste des contacts de l'entreprise",
        "es": "Lista de contactos de la empresa",
        "ar-SA": "قائمة جهات اتصال الشركة"
    },
    "Allow users to browse and interact with other users in the company.": {
        "en": "Allow users to browse and interact with other users in the company.",
        "de": "Benutzern erlauben, andere Benutzer im Unternehmen zu finden und mit ihnen zu interagieren.",
        "fr": "Autoriser les utilisateurs à parcourir et à interagir avec les autres utilisateurs de l'entreprise.",
        "es": "Permitir que los usuarios vean e interactúen con otros usuarios de la empresa.",
        "ar-SA": "السماح للمستخدمين بتصفح المستخدمين الآخرين في الشركة والتفاعل معهم."
    },
    "Event Logging": {
        "en": "Event Logging",
        "de": "Ereignisprotokollierung",
        "fr": "Journalisation des événements",
        "es": "Registro de eventos",
        "ar-SA": "تسجيل الأحداث"
    },
    "User event data from the company is logged on Remote365 ID servers for 1 year.": {
        "en": "User event data from the company is logged on Remote365 ID servers for 1 year.",
        "de": "Benutzerereignisdaten des Unternehmens werden 1 Jahr lang auf Remote365 ID-Servern protokolliert.",
        "fr": "Les données d'événements utilisateur de l'entreprise sont enregistrées sur les serveurs Remote365 ID pendant 1 an.",
        "es": "Los datos de eventos de usuario de la empresa se registran en los servidores de Remote365 ID durante 1 año.",
        "ar-SA": "تُسجَّل بيانات أحداث المستخدمين في الشركة على خوادم Remote365 ID لمدة سنة واحدة."
    },
    "Aggregating Platform Data...": {
        "en": "Aggregating Platform Data...",
        "de": "Plattformdaten werden zusammengeführt...",
        "fr": "Agrégation des données de la plateforme...",
        "es": "Agregando datos de la plataforma...",
        "ar-SA": "جارٍ تجميع بيانات المنصة..."
    },
    "Analytics Unavailable": {
        "en": "Analytics Unavailable",
        "de": "Analysen nicht verfügbar",
        "fr": "Analyses indisponibles",
        "es": "Análisis no disponibles",
        "ar-SA": "التحليلات غير متاحة"
    },
    "Endpoint:": {
        "en": "Endpoint:",
        "de": "Endpunkt:",
        "fr": "Point de terminaison :",
        "es": "Endpoint:",
        "ar-SA": "نقطة النهاية:"
    },
    "Retry": {
        "en": "Retry",
        "de": "Erneut versuchen",
        "fr": "Réessayer",
        "es": "Reintentar",
        "ar-SA": "إعادة المحاولة"
    },
    "Registration Trend": {
        "en": "Registration Trend",
        "de": "Registrierungstrend",
        "fr": "Tendance des inscriptions",
        "es": "Tendencia de registros",
        "ar-SA": "اتجاه التسجيلات"
    },
    "New Users · Last 7 Days": {
        "en": "New Users · Last 7 Days",
        "de": "Neue Benutzer · Letzte 7 Tage",
        "fr": "Nouveaux utilisateurs · 7 derniers jours",
        "es": "Nuevos usuarios · Últimos 7 días",
        "ar-SA": "المستخدمون الجدد · آخر 7 أيام"
    },
    "Weekly": {
        "en": "Weekly",
        "de": "Wöchentlich",
        "fr": "Hebdomadaire",
        "es": "Semanal",
        "ar-SA": "أسبوعي"
    },
    "Subscriptions": {
        "en": "Subscriptions",
        "de": "Abonnements",
        "fr": "Abonnements",
        "es": "Suscripciones",
        "ar-SA": "الاشتراكات"
    },
    "Paid Plans": {
        "en": "Paid Plans",
        "de": "Kostenpflichtige Tarife",
        "fr": "Offres payantes",
        "es": "Planes de pago",
        "ar-SA": "الخطط المدفوعة"
    },
    "Available Payout": {
        "en": "Available Payout",
        "de": "Verfügbare Auszahlung",
        "fr": "Paiement disponible",
        "es": "Pago disponible",
        "ar-SA": "المبلغ المتاح للصرف"
    },
    "Platform Health": {
        "en": "Platform Health",
        "de": "Plattformzustand",
        "fr": "État de la plateforme",
        "es": "Estado de la plataforma",
        "ar-SA": "حالة المنصة"
    },
    "Simulated avg across registered devices": {
        "en": "Simulated avg across registered devices",
        "de": "Simulierter Durchschnitt aller registrierten Geräte",
        "fr": "Moyenne simulée sur les appareils enregistrés",
        "es": "Promedio simulado de los dispositivos registrados",
        "ar-SA": "متوسط محاكى عبر الأجهزة المسجلة"
    },
    "All Systems Online": {
        "en": "All Systems Online",
        "de": "Alle Systeme online",
        "fr": "Tous les systèmes sont en ligne",
        "es": "Todos los sistemas en línea",
        "ar-SA": "جميع الأنظمة متصلة"
    },
    "Recent Sign-Ups": {
        "en": "Recent Sign-Ups",
        "de": "Neueste Registrierungen",
        "fr": "Inscriptions récentes",
        "es": "Registros recientes",
        "ar-SA": "التسجيلات الأخيرة"
    },
    "Click a row to view the full organization profile": {
        "en": "Click a row to view the full organization profile",
        "de": "Klicken Sie auf eine Zeile, um das vollständige Organisationsprofil anzuzeigen",
        "fr": "Cliquez sur une ligne pour afficher le profil complet de l'organisation",
        "es": "Haz clic en una fila para ver el perfil completo de la organización",
        "ar-SA": "انقر على صف لعرض الملف الكامل للمؤسسة"
    },
    "View All": {
        "en": "View All",
        "de": "Alle anzeigen",
        "fr": "Tout afficher",
        "es": "Ver todo",
        "ar-SA": "عرض الكل"
    },
    "Total Users": {
        "en": "Total Users",
        "de": "Benutzer gesamt",
        "fr": "Nombre total d'utilisateurs",
        "es": "Total de usuarios",
        "ar-SA": "إجمالي المستخدمين"
    },
    "Revenue": {
        "en": "Revenue",
        "de": "Umsatz",
        "fr": "Chiffre d'affaires",
        "es": "Ingresos",
        "ar-SA": "الإيرادات"
    },
    "CPU Usage": {
        "en": "CPU Usage",
        "de": "CPU-Auslastung",
        "fr": "Utilisation du CPU",
        "es": "Uso de CPU",
        "ar-SA": "استخدام المعالج"
    },
    "Memory": {
        "en": "Memory",
        "de": "Arbeitsspeicher",
        "fr": "Mémoire",
        "es": "Memoria",
        "ar-SA": "الذاكرة"
    },
    "Adapter": {
        "en": "Adapter",
        "de": "Adapter",
        "fr": "Adaptateur",
        "es": "Adaptador",
        "ar-SA": "المحول"
    },
    "Unexpected error loading analytics.": {
        "en": "Unexpected error loading analytics.",
        "de": "Unerwarteter Fehler beim Laden der Analysen.",
        "fr": "Erreur inattendue lors du chargement des analyses.",
        "es": "Error inesperado al cargar los análisis.",
        "ar-SA": "حدث خطأ غير متوقع أثناء تحميل التحليلات."
    },
    "Recent Invoice": {
        "en": "Recent Invoice",
        "de": "Letzte Rechnung",
        "fr": "Facture récente",
        "es": "Factura reciente",
        "ar-SA": "أحدث فاتورة"
    },
    "Starts At": {
        "en": "Starts At",
        "de": "Ab",
        "fr": "À partir de",
        "es": "Desde",
        "ar-SA": "يبدأ من"
    },
    "Current Plan": {
        "en": "Current Plan",
        "de": "Aktueller Tarif",
        "fr": "Offre actuelle",
        "es": "Plan actual",
        "ar-SA": "الخطة الحالية"
    },
    "Features": {
        "en": "Features",
        "de": "Funktionen",
        "fr": "Fonctionnalités",
        "es": "Funciones",
        "ar-SA": "الميزات"
    },
    "Download Invoice": {
        "en": "Download Invoice",
        "de": "Rechnung herunterladen",
        "fr": "Télécharger la facture",
        "es": "Descargar factura",
        "ar-SA": "تنزيل الفاتورة"
    },
    "Rename": {
        "en": "Rename",
        "de": "Umbenennen",
        "fr": "Renommer",
        "es": "Cambiar nombre",
        "ar-SA": "إعادة التسمية"
    },
    "Add Members": {
        "en": "Add Members",
        "de": "Mitglieder hinzufügen",
        "fr": "Ajouter des membres",
        "es": "Añadir miembros",
        "ar-SA": "إضافة أعضاء"
    },
    "Unblock": {
        "en": "Unblock",
        "de": "Blockierung aufheben",
        "fr": "Débloquer",
        "es": "Desbloquear",
        "ar-SA": "إلغاء الحظر"
    },
    "Block": {
        "en": "Block",
        "de": "Blockieren",
        "fr": "Bloquer",
        "es": "Bloquear",
        "ar-SA": "حظر"
    },
    "Unfriend": {
        "en": "Unfriend",
        "de": "Aus Kontakten entfernen",
        "fr": "Retirer des contacts",
        "es": "Eliminar de contactos",
        "ar-SA": "إزالة من جهات الاتصال"
    },
    "Search Messages": {
        "en": "Search Messages",
        "de": "Nachrichten durchsuchen",
        "fr": "Rechercher des messages",
        "es": "Buscar mensajes",
        "ar-SA": "البحث في الرسائل"
    },
    "Unblock Contact": {
        "en": "Unblock Contact",
        "de": "Kontakt entsperren",
        "fr": "Débloquer le contact",
        "es": "Desbloquear contacto",
        "ar-SA": "إلغاء حظر جهة الاتصال"
    },
    "Loading Messages...": {
        "en": "Loading Messages...",
        "de": "Nachrichten werden geladen...",
        "fr": "Chargement des messages...",
        "es": "Cargando mensajes...",
        "ar-SA": "جارٍ تحميل الرسائل..."
    },
    "No Messages Yet": {
        "en": "No Messages Yet",
        "de": "Noch keine Nachrichten",
        "fr": "Aucun message pour le moment",
        "es": "Aún no hay mensajes",
        "ar-SA": "لا توجد رسائل بعد"
    },
    "Send a message to start the conversation": {
        "en": "Send a message to start the conversation",
        "de": "Senden Sie eine Nachricht, um die Unterhaltung zu beginnen",
        "fr": "Envoyez un message pour démarrer la conversation",
        "es": "Envía un mensaje para iniciar la conversación",
        "ar-SA": "أرسل رسالة لبدء المحادثة"
    },
    "Remote Desktop Request": {
        "en": "Remote Desktop Request",
        "de": "Remotedesktop-Anfrage",
        "fr": "Demande de bureau à distance",
        "es": "Solicitud de escritorio remoto",
        "ar-SA": "طلب سطح مكتب بعيد"
    },
    "Approve": {
        "en": "Approve",
        "de": "Genehmigen",
        "fr": "Approuver",
        "es": "Aprobar",
        "ar-SA": "موافقة"
    },
    "This remote session will end in less than one minute.": {
        "en": "This remote session will end in less than one minute.",
        "de": "Diese Remote-Sitzung endet in weniger als einer Minute.",
        "fr": "Cette session à distance se terminera dans moins d'une minute.",
        "es": "Esta sesión remota finalizará en menos de un minuto.",
        "ar-SA": "ستنتهي هذه الجلسة عن بُعد خلال أقل من دقيقة."
    },
    "Opening...": {
        "en": "Opening...",
        "de": "Wird geöffnet...",
        "fr": "Ouverture...",
        "es": "Abriendo...",
        "ar-SA": "جارٍ الفتح..."
    },
    "Decline": {
        "en": "Decline",
        "de": "Ablehnen",
        "fr": "Refuser",
        "es": "Rechazar",
        "ar-SA": "رفض"
    },
    "Pinned": {
        "en": "Pinned",
        "de": "Angeheftet",
        "fr": "Épinglé",
        "es": "Fijado",
        "ar-SA": "مثبّت"
    },
    "Message Deleted": {
        "en": "Message Deleted",
        "de": "Nachricht gelöscht",
        "fr": "Message supprimé",
        "es": "Mensaje eliminado",
        "ar-SA": "تم حذف الرسالة"
    },
    "(Edited)": {
        "en": "(Edited)",
        "de": "(Bearbeitet)",
        "fr": "(Modifié)",
        "es": "(Editado)",
        "ar-SA": "(معدّلة)"
    },
    "Meeting Session": {
        "en": "Meeting Session",
        "de": "Besprechungssitzung",
        "fr": "Session de réunion",
        "es": "Sesión de reunión",
        "ar-SA": "جلسة اجتماع"
    },
    "Desktop Remote Session": {
        "en": "Desktop Remote Session",
        "de": "Remotedesktop-Sitzung",
        "fr": "Session de bureau à distance",
        "es": "Sesión de escritorio remoto",
        "ar-SA": "جلسة سطح مكتب بعيد"
    },
    "Ask for approval to use their PC.": {
        "en": "Ask for approval to use their PC.",
        "de": "Um Erlaubnis bitten, den PC zu verwenden.",
        "fr": "Demander l'autorisation d'utiliser son PC.",
        "es": "Solicitar permiso para usar su PC.",
        "ar-SA": "اطلب الموافقة لاستخدام جهاز الكمبيوتر الخاص به."
    },
    "Quick Replies": {
        "en": "Quick Replies",
        "de": "Schnellantworten",
        "fr": "Réponses rapides",
        "es": "Respuestas rápidas",
        "ar-SA": "ردود سريعة"
    },
    "Editing Message": {
        "en": "Editing Message",
        "de": "Nachricht bearbeiten",
        "fr": "Modification du message",
        "es": "Editando mensaje",
        "ar-SA": "تعديل الرسالة"
    },
    "Mention A Device": {
        "en": "Mention A Device",
        "de": "Gerät erwähnen",
        "fr": "Mentionner un appareil",
        "es": "Mencionar un dispositivo",
        "ar-SA": "الإشارة إلى جهاز"
    },
    "Emoji": {
        "en": "Emoji",
        "de": "Emoji",
        "fr": "Emoji",
        "es": "Emoji",
        "ar-SA": "رموز تعبيرية"
    },
    "Approve Remote Access?": {
        "en": "Approve Remote Access?",
        "de": "Fernzugriff genehmigen?",
        "fr": "Approuver l'accès à distance ?",
        "es": "¿Aprobar acceso remoto?",
        "ar-SA": "الموافقة على الوصول عن بُعد؟"
    },
    "Custom Duration In Minutes": {
        "en": "Custom Duration In Minutes",
        "de": "Benutzerdefinierte Dauer in Minuten",
        "fr": "Durée personnalisée en minutes",
        "es": "Duración personalizada en minutos",
        "ar-SA": "مدة مخصصة بالدقائق"
    },
    "Access privileges are valid only for the approved time frame and will expire automatically thereafter": {
        "en": "Access privileges are valid only for the approved time frame and will expire automatically thereafter",
        "de": "Zugriffsrechte gelten nur für den genehmigten Zeitraum und laufen danach automatisch ab",
        "fr": "Les privilèges d'accès ne sont valables que pour la période approuvée et expireront automatiquement ensuite",
        "es": "Los privilegios de acceso solo son válidos durante el período aprobado y caducarán automáticamente después",
        "ar-SA": "صلاحيات الوصول سارية فقط خلال الإطار الزمني المعتمد وستنتهي تلقائيًا بعد ذلك"
    },
    "Contact": {
        "en": "Contact",
        "de": "Kontakt",
        "fr": "Contact",
        "es": "Contacto",
        "ar-SA": "جهة اتصال"
    },
    "Group": {
        "en": "Group",
        "de": "Gruppe",
        "fr": "Groupe",
        "es": "Grupo",
        "ar-SA": "مجموعة"
    },
    "Group Name": {
        "en": "Group Name",
        "de": "Gruppenname",
        "fr": "Nom du groupe",
        "es": "Nombre del grupo",
        "ar-SA": "اسم المجموعة"
    },
    "Group Members": {
        "en": "Group Members",
        "de": "Gruppenmitglieder",
        "fr": "Membres du groupe",
        "es": "Miembros del grupo",
        "ar-SA": "أعضاء المجموعة"
    },
    "Rename Conversation": {
        "en": "Rename Conversation",
        "de": "Unterhaltung umbenennen",
        "fr": "Renommer la conversation",
        "es": "Cambiar nombre de la conversación",
        "ar-SA": "إعادة تسمية المحادثة"
    },
    "Update Name": {
        "en": "Update Name",
        "de": "Namen aktualisieren",
        "fr": "Mettre à jour le nom",
        "es": "Actualizar nombre",
        "ar-SA": "تحديث الاسم"
    },
    "Delete Conversation?": {
        "en": "Delete Conversation?",
        "de": "Unterhaltung löschen?",
        "fr": "Supprimer la conversation ?",
        "es": "¿Eliminar conversación?",
        "ar-SA": "حذف المحادثة؟"
    },
    "All Chats": {
        "en": "All Chats",
        "de": "Alle Chats",
        "fr": "Toutes les discussions",
        "es": "Todos los chats",
        "ar-SA": "جميع الدردشات"
    },
    "Direct Messages": {
        "en": "Direct Messages",
        "de": "Direktnachrichten",
        "fr": "Messages directs",
        "es": "Mensajes directos",
        "ar-SA": "الرسائل المباشرة"
    },
    "Groups": {
        "en": "Groups",
        "de": "Gruppen",
        "fr": "Groupes",
        "es": "Grupos",
        "ar-SA": "المجموعات"
    },
    "Online Now": {
        "en": "Online Now",
        "de": "Jetzt online",
        "fr": "En ligne",
        "es": "En línea ahora",
        "ar-SA": "متصل الآن"
    },
    "Could Not Open PC": {
        "en": "Could Not Open PC",
        "de": "PC konnte nicht geöffnet werden",
        "fr": "Impossible d'ouvrir le PC",
        "es": "No se pudo abrir el PC",
        "ar-SA": "تعذّر فتح الكمبيوتر"
    },
    "The approved device ID is missing from this invite.": {
        "en": "The approved device ID is missing from this invite.",
        "de": "In dieser Einladung fehlt die genehmigte Geräte-ID.",
        "fr": "L'ID de l'appareil approuvé est absent de cette invitation.",
        "es": "Falta el ID del dispositivo aprobado en esta invitación.",
        "ar-SA": "معرّف الجهاز المعتمد مفقود من هذه الدعوة."
    },
    "Opening Remote PC": {
        "en": "Opening Remote PC",
        "de": "Remote-PC wird geöffnet",
        "fr": "Ouverture du PC distant",
        "es": "Abriendo PC remoto",
        "ar-SA": "جارٍ فتح الكمبيوتر البعيد"
    },
    "Welcome To Chat": {
        "en": "Welcome To Chat",
        "de": "Willkommen im Chat",
        "fr": "Bienvenue dans le chat",
        "es": "Bienvenido al chat",
        "ar-SA": "مرحبًا بك في الدردشة"
    },
    "Message your team members and support contacts directly inside Remote365.": {
        "en": "Message your team members and support contacts directly inside Remote365.",
        "de": "Schreiben Sie Ihren Teammitgliedern und Support-Kontakten direkt in Remote365.",
        "fr": "Envoyez des messages aux membres de votre équipe et à vos contacts d'assistance directement dans Remote365.",
        "es": "Envía mensajes a los miembros de tu equipo y a tus contactos de soporte directamente en Remote365.",
        "ar-SA": "راسل أعضاء فريقك وجهات اتصال الدعم مباشرةً داخل Remote365."
    },
    "Start A Conversation": {
        "en": "Start A Conversation",
        "de": "Unterhaltung beginnen",
        "fr": "Démarrer une conversation",
        "es": "Iniciar una conversación",
        "ar-SA": "ابدأ محادثة"
    },
    "Use the + button to add a contact or invite someone by email, then message them right away.": {
        "en": "Use the + button to add a contact or invite someone by email, then message them right away.",
        "de": "Verwenden Sie die Schaltfläche +, um einen Kontakt hinzuzufügen oder jemanden per E-Mail einzuladen, und schreiben Sie ihm sofort.",
        "fr": "Utilisez le bouton + pour ajouter un contact ou inviter quelqu'un par e-mail, puis envoyez-lui un message immédiatement.",
        "es": "Usa el botón + para añadir un contacto o invitar a alguien por correo electrónico y envíale un mensaje al instante.",
        "ar-SA": "استخدم الزر + لإضافة جهة اتصال أو دعوة شخص عبر البريد الإلكتروني، ثم راسله على الفور."
    },
    "Mention devices with @": {
        "en": "Mention devices with @",
        "de": "Geräte mit @ erwähnen",
        "fr": "Mentionnez des appareils avec @",
        "es": "Menciona dispositivos con @",
        "ar-SA": "أشر إلى الأجهزة باستخدام @"
    },
    "Type @ in any message to attach one of your devices — the other person can connect to it with one click.": {
        "en": "Type @ in any message to attach one of your devices — the other person can connect to it with one click.",
        "de": "Geben Sie in einer beliebigen Nachricht @ ein, um eines Ihrer Geräte anzuhängen — die andere Person kann sich mit einem Klick verbinden.",
        "fr": "Tapez @ dans n'importe quel message pour joindre l'un de vos appareils — votre interlocuteur peut s'y connecter en un clic.",
        "es": "Escribe @ en cualquier mensaje para adjuntar uno de tus dispositivos — la otra persona podrá conectarse con un solo clic.",
        "ar-SA": "اكتب @ في أي رسالة لإرفاق أحد أجهزتك — يمكن للشخص الآخر الاتصال به بنقرة واحدة."
    },
    "View Profile": {
        "en": "View Profile",
        "de": "Profil anzeigen",
        "fr": "Voir le profil",
        "es": "Ver perfil",
        "ar-SA": "عرض الملف الشخصي"
    },
    "More Options": {
        "en": "More Options",
        "de": "Weitere Optionen",
        "fr": "Plus d'options",
        "es": "Más opciones",
        "ar-SA": "خيارات إضافية"
    },
    "Search In This Conversation...": {
        "en": "Search In This Conversation...",
        "de": "In dieser Unterhaltung suchen...",
        "fr": "Rechercher dans cette conversation...",
        "es": "Buscar en esta conversación...",
        "ar-SA": "البحث في هذه المحادثة..."
    },
    "Close Search": {
        "en": "Close Search",
        "de": "Suche schließen",
        "fr": "Fermer la recherche",
        "es": "Cerrar búsqueda",
        "ar-SA": "إغلاق البحث"
    },
    "Copy Join Link": {
        "en": "Copy Join Link",
        "de": "Teilnahmelink kopieren",
        "fr": "Copier le lien de participation",
        "es": "Copiar enlace para unirse",
        "ar-SA": "نسخ رابط الانضمام"
    },
    "Reply": {
        "en": "Reply",
        "de": "Antworten",
        "fr": "Répondre",
        "es": "Responder",
        "ar-SA": "رد"
    },
    "React": {
        "en": "React",
        "de": "Reagieren",
        "fr": "Réagir",
        "es": "Reaccionar",
        "ar-SA": "تفاعل"
    },
    "Edit": {
        "en": "Edit",
        "de": "Bearbeiten",
        "fr": "Modifier",
        "es": "Editar",
        "ar-SA": "تعديل"
    },
    "Download": {
        "en": "Download",
        "de": "Herunterladen",
        "fr": "Télécharger",
        "es": "Descargar",
        "ar-SA": "تنزيل"
    },
    "Dismiss": {
        "en": "Dismiss",
        "de": "Schließen",
        "fr": "Ignorer",
        "es": "Descartar",
        "ar-SA": "تجاهل"
    },
    "More Chat Actions": {
        "en": "More Chat Actions",
        "de": "Weitere Chat-Aktionen",
        "fr": "Plus d'actions de chat",
        "es": "Más acciones de chat",
        "ar-SA": "إجراءات دردشة إضافية"
    },
    "Attach a file (or paste a screenshot with Ctrl+V)": {
        "en": "Attach a file (or paste a screenshot with Ctrl+V)",
        "de": "Datei anhängen (oder Screenshot mit Ctrl+V einfügen)",
        "fr": "Joindre un fichier (ou coller une capture d'écran avec Ctrl+V)",
        "es": "Adjuntar un archivo (o pegar una captura de pantalla con Ctrl+V)",
        "ar-SA": "إرفاق ملف (أو لصق لقطة شاشة باستخدام Ctrl+V)"
    },
    "Canned Replies": {
        "en": "Canned Replies",
        "de": "Vorgefertigte Antworten",
        "fr": "Réponses prédéfinies",
        "es": "Respuestas predefinidas",
        "ar-SA": "ردود جاهزة"
    },
    "Clear": {
        "en": "Clear",
        "de": "Löschen",
        "fr": "Effacer",
        "es": "Borrar",
        "ar-SA": "مسح"
    },
    "Type your message... (@ to mention a device)": {
        "en": "Type your message... (@ to mention a device)",
        "de": "Nachricht eingeben... (@ um ein Gerät zu erwähnen)",
        "fr": "Saisissez votre message... (@ pour mentionner un appareil)",
        "es": "Escribe tu mensaje... (@ para mencionar un dispositivo)",
        "ar-SA": "اكتب رسالتك... (@ للإشارة إلى جهاز)"
    },
    "Insert Emoji": {
        "en": "Insert Emoji",
        "de": "Emoji einfügen",
        "fr": "Insérer un emoji",
        "es": "Insertar emoji",
        "ar-SA": "إدراج رمز تعبيري"
    },
    "Call And Video Chat": {
        "en": "Call And Video Chat",
        "de": "Anruf und Videochat",
        "fr": "Appel et chat vidéo",
        "es": "Llamada y videochat",
        "ar-SA": "مكالمة ودردشة فيديو"
    },
    "Enter Email Address": {
        "en": "Enter Email Address",
        "de": "E-Mail-Adresse eingeben",
        "fr": "Saisir l'adresse e-mail",
        "es": "Introduce la dirección de correo electrónico",
        "ar-SA": "أدخل عنوان البريد الإلكتروني"
    },
    "Enter Group Name": {
        "en": "Enter Group Name",
        "de": "Gruppennamen eingeben",
        "fr": "Saisir le nom du groupe",
        "es": "Introduce el nombre del grupo",
        "ar-SA": "أدخل اسم المجموعة"
    },
    "Member emails, separated by commas or spaces": {
        "en": "Member emails, separated by commas or spaces",
        "de": "E-Mail-Adressen der Mitglieder, durch Kommas oder Leerzeichen getrennt",
        "fr": "E-mails des membres, séparés par des virgules ou des espaces",
        "es": "Correos de los miembros, separados por comas o espacios",
        "ar-SA": "عناوين البريد الإلكتروني للأعضاء، مفصولة بفواصل أو مسافات"
    },
    "New Conversation Name": {
        "en": "New Conversation Name",
        "de": "Neuer Unterhaltungsname",
        "fr": "Nouveau nom de la conversation",
        "es": "Nuevo nombre de la conversación",
        "ar-SA": "اسم المحادثة الجديد"
    },
    "Previous": {
        "en": "Previous",
        "de": "Zurück",
        "fr": "Précédent",
        "es": "Anterior",
        "ar-SA": "السابق"
    },
    "Host Resource Performance": {
        "en": "Host Resource Performance",
        "de": "Ressourcenleistung des Hosts",
        "fr": "Performances des ressources de l'hôte",
        "es": "Rendimiento de recursos del host",
        "ar-SA": "أداء موارد المضيف"
    },
    "CPU LOAD %": {
        "en": "CPU LOAD %",
        "de": "CPU-LAST %",
        "fr": "CHARGE CPU %",
        "es": "CARGA DE CPU %",
        "ar-SA": "حمل المعالج %"
    },
    "MEMORY %": {
        "en": "MEMORY %",
        "de": "SPEICHER %",
        "fr": "MÉMOIRE %",
        "es": "MEMORIA %",
        "ar-SA": "الذاكرة %"
    },
    "Live Telemetry": {
        "en": "Live Telemetry",
        "de": "Live-Telemetrie",
        "fr": "Télémétrie en direct",
        "es": "Telemetría en directo",
        "ar-SA": "القياس عن بُعد المباشر"
    },
    "Fleet Latency Spread (Ms)": {
        "en": "Fleet Latency Spread (Ms)",
        "de": "Latenzverteilung der Flotte (ms)",
        "fr": "Dispersion de la latence du parc (ms)",
        "es": "Dispersión de latencia de la flota (ms)",
        "ar-SA": "تباين زمن الاستجابة للأجهزة (مللي ثانية)"
    },
    "SIGNAL STABILITY": {
        "en": "SIGNAL STABILITY",
        "de": "SIGNALSTABILITÄT",
        "fr": "STABILITÉ DU SIGNAL",
        "es": "ESTABILIDAD DE LA SEÑAL",
        "ar-SA": "استقرار الإشارة"
    },
    "Mesh Link Architecture": {
        "en": "Mesh Link Architecture",
        "de": "Mesh-Verbindungsarchitektur",
        "fr": "Architecture de liaison maillée",
        "es": "Arquitectura de enlaces en malla",
        "ar-SA": "بنية الروابط الشبكية"
    },
    "Registered Devices": {
        "en": "Registered Devices",
        "de": "Registrierte Geräte",
        "fr": "Appareils enregistrés",
        "es": "Dispositivos registrados",
        "ar-SA": "الأجهزة المسجلة"
    },
    "Memory Load": {
        "en": "Memory Load",
        "de": "Speicherauslastung",
        "fr": "Charge mémoire",
        "es": "Carga de memoria",
        "ar-SA": "حمل الذاكرة"
    },
    "Bandwidth Utilization": {
        "en": "Bandwidth Utilization",
        "de": "Bandbreitenauslastung",
        "fr": "Utilisation de la bande passante",
        "es": "Uso del ancho de banda",
        "ar-SA": "استخدام النطاق الترددي"
    },
    "Adapter Usage": {
        "en": "Adapter Usage",
        "de": "Adapternutzung",
        "fr": "Utilisation de l'adaptateur",
        "es": "Uso del adaptador",
        "ar-SA": "استخدام المحول"
    },
    "Scope": {
        "en": "Scope",
        "de": "Bereich",
        "fr": "Portée",
        "es": "Ámbito",
        "ar-SA": "النطاق"
    },
    "No Groups Yet": {
        "en": "No Groups Yet",
        "de": "Noch keine Gruppen",
        "fr": "Aucun groupe pour le moment",
        "es": "Aún no hay grupos",
        "ar-SA": "لا توجد مجموعات بعد"
    },
    "Device Fleet": {
        "en": "Device Fleet",
        "de": "Geräteflotte",
        "fr": "Parc d'appareils",
        "es": "Flota de dispositivos",
        "ar-SA": "أسطول الأجهزة"
    },
    "Clear All Groups": {
        "en": "Clear All Groups",
        "de": "Alle Gruppen löschen",
        "fr": "Effacer tous les groupes",
        "es": "Borrar todos los grupos",
        "ar-SA": "مسح جميع المجموعات"
    },
    "Sort": {
        "en": "Sort",
        "de": "Sortieren",
        "fr": "Trier",
        "es": "Ordenar",
        "ar-SA": "فرز"
    },
    "Syncing Devices": {
        "en": "Syncing Devices",
        "de": "Geräte werden synchronisiert",
        "fr": "Synchronisation des appareils",
        "es": "Sincronizando dispositivos",
        "ar-SA": "جارٍ مزامنة الأجهزة"
    },
    "Refreshing your device list.": {
        "en": "Refreshing your device list.",
        "de": "Ihre Geräteliste wird aktualisiert.",
        "fr": "Actualisation de votre liste d'appareils.",
        "es": "Actualizando tu lista de dispositivos.",
        "ar-SA": "جارٍ تحديث قائمة أجهزتك."
    },
    "Try adjusting your filters or add a device.": {
        "en": "Try adjusting your filters or add a device.",
        "de": "Passen Sie Ihre Filter an oder fügen Sie ein Gerät hinzu.",
        "fr": "Essayez de modifier vos filtres ou ajoutez un appareil.",
        "es": "Prueba a ajustar los filtros o añade un dispositivo.",
        "ar-SA": "حاول تعديل عوامل التصفية أو أضف جهازًا."
    },
    "Password Changed — Update": {
        "en": "Password Changed — Update",
        "de": "Passwort geändert — Aktualisieren",
        "fr": "Mot de passe modifié — Mettre à jour",
        "es": "Contraseña cambiada — Actualizar",
        "ar-SA": "تم تغيير كلمة المرور — تحديث"
    },
    "Status": {
        "en": "Status",
        "de": "Status",
        "fr": "Statut",
        "es": "Estado",
        "ar-SA": "الحالة"
    },
    "Activity": {
        "en": "Activity",
        "de": "Aktivität",
        "fr": "Activité",
        "es": "Actividad",
        "ar-SA": "النشاط"
    },
    "Last Seen": {
        "en": "Last Seen",
        "de": "Zuletzt online",
        "fr": "Vu pour la dernière fois",
        "es": "Última conexión",
        "ar-SA": "آخر ظهور"
    },
    "Moving…": {
        "en": "Moving…",
        "de": "Wird verschoben…",
        "fr": "Déplacement…",
        "es": "Moviendo…",
        "ar-SA": "جارٍ النقل…"
    },
    "Restore": {
        "en": "Restore",
        "de": "Wiederherstellen",
        "fr": "Restaurer",
        "es": "Restaurar",
        "ar-SA": "استعادة"
    },
    "Report A Problem": {
        "en": "Report A Problem",
        "de": "Problem melden",
        "fr": "Signaler un problème",
        "es": "Informar de un problema",
        "ar-SA": "الإبلاغ عن مشكلة"
    },
    "Report": {
        "en": "Report",
        "de": "Melden",
        "fr": "Signaler",
        "es": "Informar",
        "ar-SA": "إبلاغ"
    },
    "Restore Selected": {
        "en": "Restore Selected",
        "de": "Auswahl wiederherstellen",
        "fr": "Restaurer la sélection",
        "es": "Restaurar seleccionados",
        "ar-SA": "استعادة المحدد"
    },
    "Archive Selected": {
        "en": "Archive Selected",
        "de": "Auswahl archivieren",
        "fr": "Archiver la sélection",
        "es": "Archivar seleccionados",
        "ar-SA": "أرشفة المحدد"
    },
    "Remove Selected…": {
        "en": "Remove Selected…",
        "de": "Auswahl entfernen…",
        "fr": "Supprimer la sélection…",
        "es": "Quitar seleccionados…",
        "ar-SA": "إزالة المحدد…"
    },
    "Add Group": {
        "en": "Add Group",
        "de": "Gruppe hinzufügen",
        "fr": "Ajouter un groupe",
        "es": "Añadir grupo",
        "ar-SA": "إضافة مجموعة"
    },
    "Create a device group for this account.": {
        "en": "Create a device group for this account.",
        "de": "Erstellen Sie eine Gerätegruppe für dieses Konto.",
        "fr": "Créez un groupe d'appareils pour ce compte.",
        "es": "Crea un grupo de dispositivos para esta cuenta.",
        "ar-SA": "أنشئ مجموعة أجهزة لهذا الحساب."
    },
    "Device Group": {
        "en": "Device Group",
        "de": "Gerätegruppe",
        "fr": "Groupe d'appareils",
        "es": "Grupo de dispositivos",
        "ar-SA": "مجموعة الأجهزة"
    },
    "Delete Device": {
        "en": "Delete Device",
        "de": "Gerät löschen",
        "fr": "Supprimer l'appareil",
        "es": "Eliminar dispositivo",
        "ar-SA": "حذف الجهاز"
    },
    "Change Device Name": {
        "en": "Change Device Name",
        "de": "Gerätenamen ändern",
        "fr": "Modifier le nom de l'appareil",
        "es": "Cambiar nombre del dispositivo",
        "ar-SA": "تغيير اسم الجهاز"
    },
    "Change Group": {
        "en": "Change Group",
        "de": "Gruppe ändern",
        "fr": "Changer de groupe",
        "es": "Cambiar grupo",
        "ar-SA": "تغيير المجموعة"
    },
    "Copy Device ID": {
        "en": "Copy Device ID",
        "de": "Geräte-ID kopieren",
        "fr": "Copier l'ID de l'appareil",
        "es": "Copiar ID del dispositivo",
        "ar-SA": "نسخ ID الجهاز"
    },
    "Archive Device": {
        "en": "Archive Device",
        "de": "Gerät archivieren",
        "fr": "Archiver l'appareil",
        "es": "Archivar dispositivo",
        "ar-SA": "أرشفة الجهاز"
    },
    "Assign To Group": {
        "en": "Assign To Group",
        "de": "Gruppe zuweisen",
        "fr": "Attribuer à un groupe",
        "es": "Asignar a grupo",
        "ar-SA": "تعيين إلى مجموعة"
    },
    "Select a group for": {
        "en": "Select a group for",
        "de": "Wählen Sie eine Gruppe für",
        "fr": "Sélectionnez un groupe pour",
        "es": "Selecciona un grupo para",
        "ar-SA": "اختر مجموعة لـ"
    },
    "My Computers": {
        "en": "My Computers",
        "de": "Meine Computer",
        "fr": "Mes ordinateurs",
        "es": "Mis equipos",
        "ar-SA": "أجهزة الكمبيوتر الخاصة بي"
    },
    "Create New Group": {
        "en": "Create New Group",
        "de": "Neue Gruppe erstellen",
        "fr": "Créer un groupe",
        "es": "Crear grupo nuevo",
        "ar-SA": "إنشاء مجموعة جديدة"
    },
    "Report sent to your admins.": {
        "en": "Report sent to your admins.",
        "de": "Meldung an Ihre Admins gesendet.",
        "fr": "Signalement envoyé à vos administrateurs.",
        "es": "Informe enviado a tus administradores.",
        "ar-SA": "تم إرسال البلاغ إلى المسؤولين."
    },
    "Tell your owner/admins what's wrong with": {
        "en": "Tell your owner/admins what's wrong with",
        "de": "Beschreiben Sie Ihrem Inhaber/Ihren Admins das Problem mit",
        "fr": "Indiquez à votre propriétaire/vos administrateurs le problème avec",
        "es": "Indica a tu propietario/administradores qué falla en",
        "ar-SA": "أخبر المالك/المسؤولين بالمشكلة في"
    },
    "All Devices": {
        "en": "All Devices",
        "de": "Alle Geräte",
        "fr": "Tous les appareils",
        "es": "Todos los dispositivos",
        "ar-SA": "جميع الأجهزة"
    },
    "In Session": {
        "en": "In Session",
        "de": "In Sitzung",
        "fr": "En session",
        "es": "En sesión",
        "ar-SA": "في جلسة"
    },
    "Online First": {
        "en": "Online First",
        "de": "Online zuerst",
        "fr": "En ligne d'abord",
        "es": "En línea primero",
        "ar-SA": "المتصلة أولاً"
    },
    "This removes the group from your account and unassigns it from devices. The devices remain in your list.": {
        "en": "This removes the group from your account and unassigns it from devices. The devices remain in your list.",
        "de": "Dadurch wird die Gruppe aus Ihrem Konto entfernt und von den Geräten gelöst. Die Geräte bleiben in Ihrer Liste.",
        "fr": "Le groupe sera supprimé de votre compte et retiré des appareils. Les appareils restent dans votre liste.",
        "es": "Esto elimina el grupo de tu cuenta y lo desasigna de los dispositivos. Los dispositivos permanecen en tu lista.",
        "ar-SA": "سيؤدي هذا إلى إزالة المجموعة من حسابك وإلغاء تعيينها من الأجهزة. ستبقى الأجهزة في قائمتك."
    },
    "Delete Group": {
        "en": "Delete Group",
        "de": "Gruppe löschen",
        "fr": "Supprimer le groupe",
        "es": "Eliminar grupo",
        "ar-SA": "حذف المجموعة"
    },
    "Show All Devices": {
        "en": "Show All Devices",
        "de": "Alle Geräte anzeigen",
        "fr": "Afficher tous les appareils",
        "es": "Mostrar todos los dispositivos",
        "ar-SA": "عرض جميع الأجهزة"
    },
    "Show Only Online Devices": {
        "en": "Show Only Online Devices",
        "de": "Nur Online-Geräte anzeigen",
        "fr": "Afficher uniquement les appareils en ligne",
        "es": "Mostrar solo dispositivos en línea",
        "ar-SA": "عرض الأجهزة المتصلة فقط"
    },
    "Show Only Offline Devices": {
        "en": "Show Only Offline Devices",
        "de": "Nur Offline-Geräte anzeigen",
        "fr": "Afficher uniquement les appareils hors ligne",
        "es": "Mostrar solo dispositivos sin conexión",
        "ar-SA": "عرض الأجهزة غير المتصلة فقط"
    },
    "Show only devices in an active session": {
        "en": "Show only devices in an active session",
        "de": "Nur Geräte in einer aktiven Sitzung anzeigen",
        "fr": "Afficher uniquement les appareils en session active",
        "es": "Mostrar solo dispositivos en una sesión activa",
        "ar-SA": "عرض الأجهزة في جلسة نشطة فقط"
    },
    "Force Reload": {
        "en": "Force Reload",
        "de": "Neu laden erzwingen",
        "fr": "Forcer le rechargement",
        "es": "Forzar recarga",
        "ar-SA": "فرض إعادة التحميل"
    },
    "Search Devices": {
        "en": "Search Devices",
        "de": "Geräte suchen",
        "fr": "Rechercher des appareils",
        "es": "Buscar dispositivos",
        "ar-SA": "البحث في الأجهزة"
    },
    "Welcome To Devices": {
        "en": "Welcome To Devices",
        "de": "Willkommen bei Geräte",
        "fr": "Bienvenue dans Appareils",
        "es": "Bienvenido a Dispositivos",
        "ar-SA": "مرحبًا بك في الأجهزة"
    },
    "Every computer linked to your account lives here, with live online status, current activity and groups.": {
        "en": "Every computer linked to your account lives here, with live online status, current activity and groups.",
        "de": "Hier finden Sie jeden mit Ihrem Konto verknüpften Computer – mit Live-Onlinestatus, aktueller Aktivität und Gruppen.",
        "fr": "Tous les ordinateurs liés à votre compte se trouvent ici, avec leur statut en ligne en direct, leur activité actuelle et leurs groupes.",
        "es": "Aquí están todos los equipos vinculados a tu cuenta, con estado en línea en tiempo real, actividad actual y grupos.",
        "ar-SA": "تجد هنا كل جهاز كمبيوتر مرتبط بحسابك، مع حالة الاتصال المباشرة والنشاط الحالي والمجموعات."
    },
    "Add Your First Device": {
        "en": "Add Your First Device",
        "de": "Erstes Gerät hinzufügen",
        "fr": "Ajoutez votre premier appareil",
        "es": "Añade tu primer dispositivo",
        "ar-SA": "أضف جهازك الأول"
    },
    "Click Add Device to link this computer, or a remote one using its Remote365 ID and password.": {
        "en": "Click Add Device to link this computer, or a remote one using its Remote365 ID and password.",
        "de": "Klicken Sie auf „Gerät hinzufügen“, um diesen Computer oder einen entfernten Computer über dessen Remote365 ID und Passwort zu verknüpfen.",
        "fr": "Cliquez sur Ajouter un appareil pour lier cet ordinateur, ou un ordinateur distant à l'aide de son Remote365 ID et de son mot de passe.",
        "es": "Haz clic en Añadir dispositivo para vincular este equipo, o uno remoto mediante su Remote365 ID y contraseña.",
        "ar-SA": "انقر على إضافة جهاز لربط هذا الكمبيوتر، أو جهاز بعيد باستخدام Remote365 ID وكلمة المرور الخاصة به."
    },
    "Connect In One Click": {
        "en": "Connect In One Click",
        "de": "Mit einem Klick verbinden",
        "fr": "Connexion en un clic",
        "es": "Conéctate con un clic",
        "ar-SA": "اتصل بنقرة واحدة"
    },
    "When a device is online, press Connect on its row. If its password ever changes, the button turns into “Update password” so you know to enter the new one.": {
        "en": "When a device is online, press Connect on its row. If its password ever changes, the button turns into “Update password” so you know to enter the new one.",
        "de": "Wenn ein Gerät online ist, klicken Sie in seiner Zeile auf „Verbinden“. Ändert sich sein Passwort, wird die Schaltfläche zu „Passwort aktualisieren“, damit Sie wissen, dass Sie das neue eingeben müssen.",
        "fr": "Lorsqu'un appareil est en ligne, appuyez sur Connecter dans sa ligne. Si son mot de passe change, le bouton devient « Mettre à jour le mot de passe » pour vous indiquer d'en saisir le nouveau.",
        "es": "Cuando un dispositivo esté en línea, pulsa Conectar en su fila. Si su contraseña cambia, el botón pasa a ser “Actualizar contraseña” para que sepas que debes introducir la nueva.",
        "ar-SA": "عندما يكون الجهاز متصلاً، اضغط على اتصال في صفه. وإذا تغيّرت كلمة مروره، يتحول الزر إلى “تحديث كلمة المرور” لتعرف أن عليك إدخال الكلمة الجديدة."
    },
    "No Devices Yet": {
        "en": "No Devices Yet",
        "de": "Noch keine Geräte",
        "fr": "Aucun appareil pour l'instant",
        "es": "Aún no hay dispositivos",
        "ar-SA": "لا توجد أجهزة بعد"
    },
    "Idle": {
        "en": "Idle",
        "de": "Inaktiv",
        "fr": "Inactif",
        "es": "Inactivo",
        "ar-SA": "خامل"
    },
    "Device Actions": {
        "en": "Device Actions",
        "de": "Geräteaktionen",
        "fr": "Actions sur l'appareil",
        "es": "Acciones del dispositivo",
        "ar-SA": "إجراءات الجهاز"
    },
    "Owned devices will be removed from your account. Saved devices will be unlinked from this account only.": {
        "en": "Owned devices will be removed from your account. Saved devices will be unlinked from this account only.",
        "de": "Eigene Geräte werden aus Ihrem Konto entfernt. Gespeicherte Geräte werden nur von diesem Konto getrennt.",
        "fr": "Les appareils possédés seront supprimés de votre compte. Les appareils enregistrés seront uniquement dissociés de ce compte.",
        "es": "Los dispositivos propios se eliminarán de tu cuenta. Los dispositivos guardados solo se desvincularán de esta cuenta.",
        "ar-SA": "ستتم إزالة الأجهزة المملوكة من حسابك. أما الأجهزة المحفوظة فسيُلغى ربطها بهذا الحساب فقط."
    },
    "Device Group Name": {
        "en": "Device Group Name",
        "de": "Name der Gerätegruppe",
        "fr": "Nom du groupe d'appareils",
        "es": "Nombre del grupo de dispositivos",
        "ar-SA": "اسم مجموعة الأجهزة"
    },
    "Close Device Actions": {
        "en": "Close Device Actions",
        "de": "Geräteaktionen schließen",
        "fr": "Fermer les actions sur l'appareil",
        "es": "Cerrar acciones del dispositivo",
        "ar-SA": "إغلاق إجراءات الجهاز"
    },
    "The device stays on your account but is hidden from this list. You can find it later under Archived Devices and restore it any time.": {
        "en": "The device stays on your account but is hidden from this list. You can find it later under Archived Devices and restore it any time.",
        "de": "Das Gerät bleibt in Ihrem Konto, wird aber in dieser Liste ausgeblendet. Sie finden es später unter „Archivierte Geräte“ und können es jederzeit wiederherstellen.",
        "fr": "L'appareil reste dans votre compte mais est masqué dans cette liste. Vous pourrez le retrouver dans Appareils archivés et le restaurer à tout moment.",
        "es": "El dispositivo permanece en tu cuenta, pero se oculta de esta lista. Podrás encontrarlo en Dispositivos archivados y restaurarlo cuando quieras.",
        "ar-SA": "يبقى الجهاز في حسابك لكنه يُخفى من هذه القائمة. يمكنك العثور عليه لاحقًا ضمن الأجهزة المؤرشفة واستعادته في أي وقت."
    },
    "Create Account": {
        "en": "Create Account",
        "de": "Konto erstellen",
        "fr": "Créer un compte",
        "es": "Crear cuenta",
        "ar-SA": "إنشاء حساب"
    },
    "REMOTE 365 / OVERVIEW": {
        "en": "REMOTE 365 / OVERVIEW",
        "de": "REMOTE 365 / ÜBERSICHT",
        "fr": "REMOTE 365 / APERÇU",
        "es": "REMOTE 365 / RESUMEN",
        "ar-SA": "REMOTE 365 / نظرة عامة"
    },
    "Overview": {
        "en": "Overview",
        "de": "Übersicht",
        "fr": "Aperçu",
        "es": "Resumen",
        "ar-SA": "نظرة عامة"
    },
    "Here's your activity overview.": {
        "en": "Here's your activity overview.",
        "de": "Hier ist Ihre Aktivitätsübersicht.",
        "fr": "Voici l'aperçu de votre activité.",
        "es": "Este es el resumen de tu actividad.",
        "ar-SA": "إليك نظرة عامة على نشاطك."
    },
    "Set Up Remote Access": {
        "en": "Set Up Remote Access",
        "de": "Fernzugriff einrichten",
        "fr": "Configurer l'accès à distance",
        "es": "Configurar acceso remoto",
        "ar-SA": "إعداد الوصول عن بُعد"
    },
    "Search Devices...": {
        "en": "Search Devices...",
        "de": "Geräte suchen...",
        "fr": "Rechercher des appareils...",
        "es": "Buscar dispositivos...",
        "ar-SA": "البحث في الأجهزة..."
    },
    "Sign In To Remote365 ID": {
        "en": "Sign In To Remote365 ID",
        "de": "Bei Remote365 ID anmelden",
        "fr": "Se connecter à Remote365 ID",
        "es": "Iniciar sesión en Remote365 ID",
        "ar-SA": "تسجيل الدخول إلى Remote365 ID"
    },
    "Register This Device": {
        "en": "Register This Device",
        "de": "Dieses Gerät registrieren",
        "fr": "Enregistrer cet appareil",
        "es": "Registrar este dispositivo",
        "ar-SA": "تسجيل هذا الجهاز"
    },
    "System Generated Or Custom": {
        "en": "System Generated Or Custom",
        "de": "Systemgeneriert oder benutzerdefiniert",
        "fr": "Généré par le système ou personnalisé",
        "es": "Generado por el sistema o personalizado",
        "ar-SA": "يُنشئه النظام أو مخصص"
    },
    "Joining Meeting…": {
        "en": "Joining Meeting…",
        "de": "Beitritt zur Besprechung…",
        "fr": "Connexion à la réunion…",
        "es": "Uniéndote a la reunión…",
        "ar-SA": "جارٍ الانضمام إلى الاجتماع…"
    },
    "Setting up your audio and video.": {
        "en": "Setting up your audio and video.",
        "de": "Audio und Video werden eingerichtet.",
        "fr": "Configuration de votre audio et de votre vidéo.",
        "es": "Configurando tu audio y vídeo.",
        "ar-SA": "جارٍ إعداد الصوت والفيديو."
    },
    "Not Admitted": {
        "en": "Not Admitted",
        "de": "Nicht zugelassen",
        "fr": "Non admis",
        "es": "No admitido",
        "ar-SA": "لم يتم القبول"
    },
    "Leave": {
        "en": "Leave",
        "de": "Verlassen",
        "fr": "Quitter",
        "es": "Salir",
        "ar-SA": "مغادرة"
    },
    "Waiting for host to accept your invitation": {
        "en": "Waiting for host to accept your invitation",
        "de": "Warten, bis der Host Ihre Einladung annimmt",
        "fr": "En attente de l'acceptation de votre invitation par l'hôte",
        "es": "Esperando a que el anfitrión acepte tu invitación",
        "ar-SA": "في انتظار قبول المضيف لدعوتك"
    },
    "You'll join the meeting as soon as the host lets you in.": {
        "en": "You'll join the meeting as soon as the host lets you in.",
        "de": "Sie treten dem Meeting bei, sobald der Host Sie hereinlässt.",
        "fr": "Vous rejoindrez la réunion dès que l'hôte vous aura admis.",
        "es": "Te unirás a la reunión en cuanto el anfitrión te deje entrar.",
        "ar-SA": "ستنضم إلى الاجتماع بمجرد أن يسمح لك المضيف بالدخول."
    },
    "Copied": {
        "en": "Copied",
        "de": "Kopiert",
        "fr": "Copié",
        "es": "Copiado",
        "ar-SA": "تم النسخ"
    },
    "Stop Recording": {
        "en": "Stop Recording",
        "de": "Aufnahme beenden",
        "fr": "Arrêter l'enregistrement",
        "es": "Detener grabación",
        "ar-SA": "إيقاف التسجيل"
    },
    "You (Organizer)": {
        "en": "You (Organizer)",
        "de": "Sie (Organisator)",
        "fr": "Vous (organisateur)",
        "es": "Tú (organizador)",
        "ar-SA": "أنت (المنظِّم)"
    },
    "Try Again": {
        "en": "Try Again",
        "de": "Erneut versuchen",
        "fr": "Réessayer",
        "es": "Reintentar",
        "ar-SA": "حاول مرة أخرى"
    },
    "Invite People": {
        "en": "Invite People",
        "de": "Personen einladen",
        "fr": "Inviter des personnes",
        "es": "Invitar personas",
        "ar-SA": "دعوة أشخاص"
    },
    "Mute All": {
        "en": "Mute All",
        "de": "Alle stummschalten",
        "fr": "Tout couper",
        "es": "Silenciar a todos",
        "ar-SA": "كتم صوت الجميع"
    },
    "Request Control": {
        "en": "Request Control",
        "de": "Steuerung anfordern",
        "fr": "Demander le contrôle",
        "es": "Solicitar control",
        "ar-SA": "طلب التحكم"
    },
    "No messages yet.": {
        "en": "No messages yet.",
        "de": "Noch keine Nachrichten.",
        "fr": "Aucun message pour l'instant.",
        "es": "Aún no hay mensajes.",
        "ar-SA": "لا توجد رسائل بعد."
    },
    "People": {
        "en": "People",
        "de": "Personen",
        "fr": "Personnes",
        "es": "Personas",
        "ar-SA": "الأشخاص"
    },
    "Admit All": {
        "en": "Admit All",
        "de": "Alle zulassen",
        "fr": "Tout admettre",
        "es": "Admitir a todos",
        "ar-SA": "قبول الجميع"
    },
    "Admit": {
        "en": "Admit",
        "de": "Zulassen",
        "fr": "Admettre",
        "es": "Admitir",
        "ar-SA": "قبول"
    },
    "Invite": {
        "en": "Invite",
        "de": "Einladen",
        "fr": "Inviter",
        "es": "Invitar",
        "ar-SA": "دعوة"
    },
    "List View": {
        "en": "List View",
        "de": "Listenansicht",
        "fr": "Vue en liste",
        "es": "Vista de lista",
        "ar-SA": "عرض القائمة"
    },
    "Media View": {
        "en": "Media View",
        "de": "Medienansicht",
        "fr": "Vue média",
        "es": "Vista multimedia",
        "ar-SA": "عرض الوسائط"
    },
    "Leave Meeting": {
        "en": "Leave Meeting",
        "de": "Meeting verlassen",
        "fr": "Quitter la réunion",
        "es": "Salir de la reunión",
        "ar-SA": "مغادرة الاجتماع"
    },
    "End For All": {
        "en": "End For All",
        "de": "Für alle beenden",
        "fr": "Terminer pour tous",
        "es": "Finalizar para todos",
        "ar-SA": "إنهاء للجميع"
    },
    "The recorded file will be converted to MP4 when the meeting ends.": {
        "en": "The recorded file will be converted to MP4 when the meeting ends.",
        "de": "Die Aufnahme wird nach Ende des Meetings in MP4 konvertiert.",
        "fr": "Le fichier enregistré sera converti en MP4 à la fin de la réunion.",
        "es": "El archivo grabado se convertirá a MP4 cuando termine la reunión.",
        "ar-SA": "سيتم تحويل الملف المسجل إلى MP4 عند انتهاء الاجتماع."
    },
    "Allow Screen Sharing": {
        "en": "Allow Screen Sharing",
        "de": "Bildschirmfreigabe erlauben",
        "fr": "Autoriser le partage d'écran",
        "es": "Permitir compartir pantalla",
        "ar-SA": "السماح بمشاركة الشاشة"
    },
    "Remote Control Request": {
        "en": "Remote Control Request",
        "de": "Fernsteuerungsanfrage",
        "fr": "Demande de contrôle à distance",
        "es": "Solicitud de control remoto",
        "ar-SA": "طلب التحكم عن بُعد"
    },
    "Invite People To Join Meeting": {
        "en": "Invite People To Join Meeting",
        "de": "Personen zum Meeting einladen",
        "fr": "Inviter des personnes à la réunion",
        "es": "Invitar personas a la reunión",
        "ar-SA": "دعوة أشخاص للانضمام إلى الاجتماع"
    },
    "Link Copied": {
        "en": "Link Copied",
        "de": "Link kopiert",
        "fr": "Lien copié",
        "es": "Enlace copiado",
        "ar-SA": "تم نسخ الرابط"
    },
    "Copy Meeting Link": {
        "en": "Copy Meeting Link",
        "de": "Meeting-Link kopieren",
        "fr": "Copier le lien de la réunion",
        "es": "Copiar enlace de la reunión",
        "ar-SA": "نسخ رابط الاجتماع"
    },
    "Invite Via Email": {
        "en": "Invite Via Email",
        "de": "Per E-Mail einladen",
        "fr": "Inviter par e-mail",
        "es": "Invitar por correo electrónico",
        "ar-SA": "الدعوة عبر البريد الإلكتروني"
    },
    "Meeting Passcode": {
        "en": "Meeting Passcode",
        "de": "Meeting-Kenncode",
        "fr": "Code secret de la réunion",
        "es": "Código de acceso de la reunión",
        "ar-SA": "رمز مرور الاجتماع"
    },
    "Meeting Settings": {
        "en": "Meeting Settings",
        "de": "Meeting-Einstellungen",
        "fr": "Paramètres de la réunion",
        "es": "Configuración de la reunión",
        "ar-SA": "إعدادات الاجتماع"
    },
    "Share Desktop Audio": {
        "en": "Share Desktop Audio",
        "de": "Desktop-Audio freigeben",
        "fr": "Partager l'audio du bureau",
        "es": "Compartir audio del escritorio",
        "ar-SA": "مشاركة صوت سطح المكتب"
    },
    "Includes audio from apps like YouTube during screen share.": {
        "en": "Includes audio from apps like YouTube during screen share.",
        "de": "Umfasst während der Bildschirmfreigabe Audio aus Apps wie YouTube.",
        "fr": "Inclut l'audio d'applications comme YouTube pendant le partage d'écran.",
        "es": "Incluye el audio de aplicaciones como YouTube al compartir pantalla.",
        "ar-SA": "يتضمن الصوت من تطبيقات مثل YouTube أثناء مشاركة الشاشة."
    },
    "Allow Screen Sharing Without Permission": {
        "en": "Allow Screen Sharing Without Permission",
        "de": "Bildschirmfreigabe ohne Erlaubnis zulassen",
        "fr": "Autoriser le partage d'écran sans autorisation",
        "es": "Permitir compartir pantalla sin permiso",
        "ar-SA": "السماح بمشاركة الشاشة دون إذن"
    },
    "Participants can share their screen without asking you first.": {
        "en": "Participants can share their screen without asking you first.",
        "de": "Teilnehmer können ihren Bildschirm freigeben, ohne Sie vorher zu fragen.",
        "fr": "Les participants peuvent partager leur écran sans vous le demander.",
        "es": "Los participantes pueden compartir su pantalla sin pedirte permiso.",
        "ar-SA": "يمكن للمشاركين مشاركة شاشاتهم دون أن يطلبوا منك ذلك أولاً."
    },
    "Remote control always requires approval — when someone asks to use a PC, its owner sees an Approve/Deny dialog before access opens. This cannot be turned off.": {
        "en": "Remote control always requires approval — when someone asks to use a PC, its owner sees an Approve/Deny dialog before access opens. This cannot be turned off.",
        "de": "Die Fernsteuerung erfordert immer eine Genehmigung — wenn jemand einen PC nutzen möchte, sieht dessen Besitzer einen Dialog zum Genehmigen/Ablehnen, bevor der Zugriff freigegeben wird. Dies kann nicht deaktiviert werden.",
        "fr": "Le contrôle à distance nécessite toujours une approbation — lorsqu'une personne demande à utiliser un PC, son propriétaire voit une boîte de dialogue Approuver/Refuser avant l'ouverture de l'accès. Ce paramètre ne peut pas être désactivé.",
        "es": "El control remoto siempre requiere aprobación — cuando alguien pide usar un PC, su propietario ve un cuadro de diálogo Aprobar/Denegar antes de que se abra el acceso. Esto no se puede desactivar.",
        "ar-SA": "يتطلب التحكم عن بُعد الموافقة دائمًا — عندما يطلب شخص ما استخدام جهاز كمبيوتر، يرى مالكه مربع حوار موافقة/رفض قبل فتح الوصول. لا يمكن إيقاف هذا الإعداد."
    },
    "Waiting for the host to allow you to share your screen...": {
        "en": "Waiting for the host to allow you to share your screen...",
        "de": "Warten, bis der Host Ihnen die Bildschirmfreigabe erlaubt...",
        "fr": "En attente de l'autorisation de l'hôte pour partager votre écran...",
        "es": "Esperando a que el anfitrión te permita compartir pantalla...",
        "ar-SA": "في انتظار سماح المضيف لك بمشاركة شاشتك..."
    },
    "Connecting…": {
        "en": "Connecting…",
        "de": "Verbindung wird hergestellt…",
        "fr": "Connexion…",
        "es": "Conectando…",
        "ar-SA": "جارٍ الاتصال…"
    },
    "Control": {
        "en": "Control",
        "de": "Steuern",
        "fr": "Contrôler",
        "es": "Controlar",
        "ar-SA": "تحكم"
    },
    "Copy the meeting link": {
        "en": "Copy the meeting link",
        "de": "Meeting-Link kopieren",
        "fr": "Copier le lien de la réunion",
        "es": "Copiar el enlace de la reunión",
        "ar-SA": "انسخ رابط الاجتماع"
    },
    "Fullscreen": {
        "en": "Fullscreen",
        "de": "Vollbild",
        "fr": "Plein écran",
        "es": "Pantalla completa",
        "ar-SA": "ملء الشاشة"
    },
    "See All Participants": {
        "en": "See All Participants",
        "de": "Alle Teilnehmer anzeigen",
        "fr": "Voir tous les participants",
        "es": "Ver todos los participantes",
        "ar-SA": "عرض جميع المشاركين"
    },
    "Close Chat": {
        "en": "Close Chat",
        "de": "Chat schließen",
        "fr": "Fermer le chat",
        "es": "Cerrar chat",
        "ar-SA": "إغلاق الدردشة"
    },
    "Type A Reply...": {
        "en": "Type A Reply...",
        "de": "Antwort eingeben...",
        "fr": "Saisissez une réponse...",
        "es": "Escribe una respuesta...",
        "ar-SA": "اكتب ردًا..."
    },
    "Send": {
        "en": "Send",
        "de": "Senden",
        "fr": "Envoyer",
        "es": "Enviar",
        "ar-SA": "إرسال"
    },
    "Close People": {
        "en": "Close People",
        "de": "Personen schließen",
        "fr": "Fermer Personnes",
        "es": "Cerrar personas",
        "ar-SA": "إغلاق الأشخاص"
    },
    "Meeting Chat": {
        "en": "Meeting Chat",
        "de": "Meeting-Chat",
        "fr": "Chat de la réunion",
        "es": "Chat de la reunión",
        "ar-SA": "دردشة الاجتماع"
    },
    "Participants And Invites": {
        "en": "Participants And Invites",
        "de": "Teilnehmer und Einladungen",
        "fr": "Participants et invitations",
        "es": "Participantes e invitaciones",
        "ar-SA": "المشاركون والدعوات"
    },
    "End Or Leave Meeting": {
        "en": "End Or Leave Meeting",
        "de": "Meeting beenden oder verlassen",
        "fr": "Terminer ou quitter la réunion",
        "es": "Finalizar o salir de la reunión",
        "ar-SA": "إنهاء الاجتماع أو مغادرته"
    },
    "Request Remote Control": {
        "en": "Request Remote Control",
        "de": "Fernsteuerung anfordern",
        "fr": "Demander le contrôle à distance",
        "es": "Solicitar control remoto",
        "ar-SA": "طلب التحكم عن بُعد"
    },
    "Start secure meetings, collaborate with your team, and connect instantly from anywhere.": {
        "en": "Start secure meetings, collaborate with your team, and connect instantly from anywhere.",
        "de": "Starten Sie sichere Meetings, arbeiten Sie mit Ihrem Team zusammen und verbinden Sie sich sofort von überall.",
        "fr": "Lancez des réunions sécurisées, collaborez avec votre équipe et connectez-vous instantanément depuis n'importe où.",
        "es": "Inicia reuniones seguras, colabora con tu equipo y conéctate al instante desde cualquier lugar.",
        "ar-SA": "ابدأ اجتماعات آمنة، وتعاون مع فريقك، واتصل فورًا من أي مكان."
    },
    "Start A New Meeting": {
        "en": "Start A New Meeting",
        "de": "Neues Meeting starten",
        "fr": "Démarrer une nouvelle réunion",
        "es": "Iniciar una nueva reunión",
        "ar-SA": "بدء اجتماع جديد"
    },
    "Instant, for later, or in Google Calendar": {
        "en": "Instant, for later, or in Google Calendar",
        "de": "Sofort, für später oder in Google Calendar",
        "fr": "Instantanée, pour plus tard ou dans Google Agenda",
        "es": "Instantánea, para más tarde o en Google Calendar",
        "ar-SA": "فوري، أو لوقت لاحق، أو في Google Calendar"
    },
    "Quick Join": {
        "en": "Quick Join",
        "de": "Schnell beitreten",
        "fr": "Rejoindre rapidement",
        "es": "Unión rápida",
        "ar-SA": "انضمام سريع"
    },
    "Enter Code Or Link": {
        "en": "Enter Code Or Link",
        "de": "Code oder Link eingeben",
        "fr": "Saisir un code ou un lien",
        "es": "Introduce un código o enlace",
        "ar-SA": "أدخل الرمز أو الرابط"
    },
    "Join": {
        "en": "Join",
        "de": "Beitreten",
        "fr": "Rejoindre",
        "es": "Unirse",
        "ar-SA": "انضمام"
    },
    "No Meetings Yet.": {
        "en": "No Meetings Yet.",
        "de": "Noch keine Meetings.",
        "fr": "Aucune réunion pour l'instant.",
        "es": "Aún no hay reuniones.",
        "ar-SA": "لا توجد اجتماعات بعد."
    },
    "Meeting Link": {
        "en": "Meeting Link",
        "de": "Meeting-Link",
        "fr": "Lien de la réunion",
        "es": "Enlace de la reunión",
        "ar-SA": "رابط الاجتماع"
    },
    "Instant": {
        "en": "Instant",
        "de": "Sofort",
        "fr": "Instantanée",
        "es": "Instantánea",
        "ar-SA": "فوري"
    },
    "For Later": {
        "en": "For Later",
        "de": "Für später",
        "fr": "Pour plus tard",
        "es": "Para más tarde",
        "ar-SA": "لوقت لاحق"
    },
    "Welcome To Meetings": {
        "en": "Welcome To Meetings",
        "de": "Willkommen bei Meetings",
        "fr": "Bienvenue dans Réunions",
        "es": "Bienvenido a Reuniones",
        "ar-SA": "مرحبًا بك في الاجتماعات"
    },
    "Host video meetings with screen sharing and remote control, right from Remote365.": {
        "en": "Host video meetings with screen sharing and remote control, right from Remote365.",
        "de": "Veranstalten Sie Videomeetings mit Bildschirmfreigabe und Fernsteuerung – direkt in Remote365.",
        "fr": "Organisez des réunions vidéo avec partage d'écran et contrôle à distance, directement depuis Remote365.",
        "es": "Organiza videorreuniones con pantalla compartida y control remoto, directamente desde Remote365.",
        "ar-SA": "استضف اجتماعات فيديو مع مشاركة الشاشة والتحكم عن بُعد، مباشرةً من Remote365."
    },
    "Start A Meeting": {
        "en": "Start A Meeting",
        "de": "Meeting starten",
        "fr": "Démarrer une réunion",
        "es": "Iniciar una reunión",
        "ar-SA": "بدء اجتماع"
    },
    "Click New meeting to start an instant room, create a link for later, or schedule it in Google Calendar.": {
        "en": "Click New meeting to start an instant room, create a link for later, or schedule it in Google Calendar.",
        "de": "Klicken Sie auf „Neues Meeting“, um sofort einen Raum zu starten, einen Link für später zu erstellen oder das Meeting in Google Calendar zu planen.",
        "fr": "Cliquez sur Nouvelle réunion pour démarrer une salle instantanée, créer un lien pour plus tard ou la planifier dans Google Agenda.",
        "es": "Haz clic en Nueva reunión para iniciar una sala al instante, crear un enlace para más tarde o programarla en Google Calendar.",
        "ar-SA": "انقر على اجتماع جديد لبدء غرفة فورية، أو إنشاء رابط لوقت لاحق، أو جدولته في Google Calendar."
    },
    "Join With A Code": {
        "en": "Join With A Code",
        "de": "Mit einem Code beitreten",
        "fr": "Rejoindre avec un code",
        "es": "Unirse con un código",
        "ar-SA": "الانضمام باستخدام رمز"
    },
    "Refresh Meetings": {
        "en": "Refresh Meetings",
        "de": "Meetings aktualisieren",
        "fr": "Actualiser les réunions",
        "es": "Actualizar reuniones",
        "ar-SA": "تحديث الاجتماعات"
    },
    "Open In Browser": {
        "en": "Open In Browser",
        "de": "Im Browser öffnen",
        "fr": "Ouvrir dans le navigateur",
        "es": "Abrir en el navegador",
        "ar-SA": "فتح في المتصفح"
    },
    "Connect And Chat": {
        "en": "Connect And Chat",
        "de": "Verbinden und chatten",
        "fr": "Connectez-vous et discutez",
        "es": "Conecta y chatea",
        "ar-SA": "اتصل وتحدث"
    },
    "No Access": {
        "en": "No Access",
        "de": "Kein Zugriff",
        "fr": "Aucun accès",
        "es": "Sin acceso",
        "ar-SA": "لا يوجد وصول"
    },
    "Manage organization members, roles, and device access.": {
        "en": "Manage organization members, roles, and device access.",
        "de": "Verwalten Sie Organisationsmitglieder, Rollen und Gerätezugriff.",
        "fr": "Gérez les membres de l'organisation, les rôles et l'accès aux appareils.",
        "es": "Gestiona los miembros de la organización, los roles y el acceso a dispositivos.",
        "ar-SA": "إدارة أعضاء المؤسسة والأدوار والوصول إلى الأجهزة."
    },
    "Add Member": {
        "en": "Add Member",
        "de": "Mitglied hinzufügen",
        "fr": "Ajouter un membre",
        "es": "Añadir miembro",
        "ar-SA": "إضافة عضو"
    },
    "User": {
        "en": "User",
        "de": "Benutzer",
        "fr": "Utilisateur",
        "es": "Usuario",
        "ar-SA": "المستخدم"
    },
    "Role": {
        "en": "Role",
        "de": "Rolle",
        "fr": "Rôle",
        "es": "Rol",
        "ar-SA": "الدور"
    },
    "Access": {
        "en": "Access",
        "de": "Zugriff",
        "fr": "Accès",
        "es": "Acceso",
        "ar-SA": "الوصول"
    },
    "Joined": {
        "en": "Joined",
        "de": "Beigetreten",
        "fr": "Inscrit le",
        "es": "Fecha de alta",
        "ar-SA": "تاريخ الانضمام"
    },
    "Active": {
        "en": "Active",
        "de": "Aktiv",
        "fr": "Actif",
        "es": "Activo",
        "ar-SA": "نشط"
    },
    "Manage": {
        "en": "Manage",
        "de": "Verwalten",
        "fr": "Gérer",
        "es": "Gestionar",
        "ar-SA": "إدارة"
    },
    "Inactive": {
        "en": "Inactive",
        "de": "Inaktiv",
        "fr": "Inactif",
        "es": "Inactivo",
        "ar-SA": "غير نشط"
    },
    "Suspended": {
        "en": "Suspended",
        "de": "Gesperrt",
        "fr": "Suspendu",
        "es": "Suspendido",
        "ar-SA": "معلّق"
    },
    "Owner": {
        "en": "Owner",
        "de": "Inhaber",
        "fr": "Propriétaire",
        "es": "Propietario",
        "ar-SA": "المالك"
    },
    "You": {
        "en": "You",
        "de": "Sie",
        "fr": "Vous",
        "es": "Tú",
        "ar-SA": "أنت"
    },
    "Invitation Pending": {
        "en": "Invitation Pending",
        "de": "Einladung ausstehend",
        "fr": "Invitation en attente",
        "es": "Invitación pendiente",
        "ar-SA": "الدعوة معلّقة"
    },
    "Waiting For Join…": {
        "en": "Waiting For Join…",
        "de": "Warten auf Beitritt…",
        "fr": "En attente d'inscription…",
        "es": "Esperando que se una…",
        "ar-SA": "في انتظار الانضمام…"
    },
    "No team members yet. Invite your first colleague.": {
        "en": "No team members yet. Invite your first colleague.",
        "de": "Noch keine Teammitglieder. Laden Sie Ihren ersten Kollegen ein.",
        "fr": "Aucun membre dans l'équipe pour l'instant. Invitez votre premier collègue.",
        "es": "Aún no hay miembros en el equipo. Invita a tu primer compañero.",
        "ar-SA": "لا يوجد أعضاء في الفريق بعد. ادعُ زميلك الأول."
    },
    "This permanently deletes": {
        "en": "This permanently deletes",
        "de": "Dies löscht endgültig",
        "fr": "Cette action supprime définitivement",
        "es": "Esto elimina permanentemente a",
        "ar-SA": "سيؤدي هذا إلى الحذف النهائي لـ"
    },
    "Are you sure you want to cancel the invitation for": {
        "en": "Are you sure you want to cancel the invitation for",
        "de": "Möchten Sie die Einladung wirklich widerrufen für",
        "fr": "Voulez-vous vraiment annuler l'invitation de",
        "es": "¿Seguro que quieres cancelar la invitación de",
        "ar-SA": "هل أنت متأكد من أنك تريد إلغاء الدعوة الخاصة بـ"
    },
    "Invite Team Member": {
        "en": "Invite Team Member",
        "de": "Teammitglied einladen",
        "fr": "Inviter un membre de l'équipe",
        "es": "Invitar a un miembro del equipo",
        "ar-SA": "دعوة عضو في الفريق"
    },
    "Email Address": {
        "en": "Email Address",
        "de": "E-Mail-Adresse",
        "fr": "Adresse e-mail",
        "es": "Correo electrónico",
        "ar-SA": "عنوان البريد الإلكتروني"
    },
    "Send Invitation Link": {
        "en": "Send Invitation Link",
        "de": "Einladungslink senden",
        "fr": "Envoyer le lien d'invitation",
        "es": "Enviar enlace de invitación",
        "ar-SA": "إرسال رابط الدعوة"
    },
    "Pending": {
        "en": "Pending",
        "de": "Ausstehend",
        "fr": "En attente",
        "es": "Pendiente",
        "ar-SA": "معلّق"
    },
    "Plan Limit": {
        "en": "Plan Limit",
        "de": "Tariflimit",
        "fr": "Limite du forfait",
        "es": "Límite del plan",
        "ar-SA": "حد الخطة"
    },
    "The owner has full access and can't be edited or removed.": {
        "en": "The owner has full access and can't be edited or removed.",
        "de": "Der Inhaber hat vollen Zugriff und kann nicht bearbeitet oder entfernt werden.",
        "fr": "Le propriétaire dispose d'un accès complet et ne peut être ni modifié ni supprimé.",
        "es": "El propietario tiene acceso completo y no se puede editar ni eliminar.",
        "ar-SA": "يمتلك المالك وصولاً كاملاً ولا يمكن تعديله أو إزالته."
    },
    "You can't change your own permissions.": {
        "en": "You can't change your own permissions.",
        "de": "Sie können Ihre eigenen Berechtigungen nicht ändern.",
        "fr": "Vous ne pouvez pas modifier vos propres autorisations.",
        "es": "No puedes cambiar tus propios permisos.",
        "ar-SA": "لا يمكنك تغيير أذوناتك الخاصة."
    },
    "Manage Permissions": {
        "en": "Manage Permissions",
        "de": "Berechtigungen verwalten",
        "fr": "Gérer les autorisations",
        "es": "Gestionar permisos",
        "ar-SA": "إدارة الأذونات"
    },
    "Delete Member Permanently": {
        "en": "Delete Member Permanently",
        "de": "Mitglied endgültig löschen",
        "fr": "Supprimer définitivement le membre",
        "es": "Eliminar miembro permanentemente",
        "ar-SA": "حذف العضو نهائيًا"
    },
    "Cancel Invitation": {
        "en": "Cancel Invitation",
        "de": "Einladung widerrufen",
        "fr": "Annuler l'invitation",
        "es": "Cancelar invitación",
        "ar-SA": "إلغاء الدعوة"
    },
    "View": {
        "en": "View",
        "de": "Anzeigen",
        "fr": "Afficher",
        "es": "Ver",
        "ar-SA": "عرض"
    },
    "Device": {
        "en": "Device",
        "de": "Gerät",
        "fr": "Appareil",
        "es": "Dispositivo",
        "ar-SA": "الجهاز"
    },
    "Session": {
        "en": "Session",
        "de": "Sitzung",
        "fr": "Session",
        "es": "Sesión",
        "ar-SA": "الجلسة"
    },
    "System": {
        "en": "System",
        "de": "System",
        "fr": "Système",
        "es": "Sistema",
        "ar-SA": "النظام"
    },
    "Message": {
        "en": "Message",
        "de": "Nachricht",
        "fr": "Message",
        "es": "Mensaje",
        "ar-SA": "رسالة"
    },
    "Update": {
        "en": "Update",
        "de": "Update",
        "fr": "Mise à jour",
        "es": "Actualización",
        "ar-SA": "تحديث"
    },
    "Blocked": {
        "en": "Blocked",
        "de": "Blockiert",
        "fr": "Bloqué",
        "es": "Bloqueado",
        "ar-SA": "محظور"
    },
    "Show all or unread only": {
        "en": "Show all or unread only",
        "de": "Alle oder nur ungelesene anzeigen",
        "fr": "Tout afficher ou seulement les non lus",
        "es": "Mostrar todo o solo no leídos",
        "ar-SA": "عرض الكل أو غير المقروء فقط"
    },
    "Welcome to the Team!": {
        "en": "Welcome to the Team!",
        "de": "Willkommen im Team!",
        "fr": "Bienvenue dans l'équipe !",
        "es": "¡Bienvenido al equipo!",
        "ar-SA": "مرحبًا بك في الفريق!"
    },
    "Your account has been secured. Redirecting you to the dashboard...": {
        "en": "Your account has been secured. Redirecting you to the dashboard...",
        "de": "Ihr Konto wurde gesichert. Sie werden zum Dashboard weitergeleitet...",
        "fr": "Votre compte a été sécurisé. Redirection vers le tableau de bord...",
        "es": "Tu cuenta se ha protegido. Redirigiéndote al panel...",
        "ar-SA": "تم تأمين حسابك. جارٍ إعادة توجيهك إلى لوحة التحكم..."
    },
    "Finalize Your Access": {
        "en": "Finalize Your Access",
        "de": "Zugang abschließen",
        "fr": "Finalisez votre accès",
        "es": "Completa tu acceso",
        "ar-SA": "أكمل إعداد وصولك"
    },
    "Set a password to join your organization on Remote365.": {
        "en": "Set a password to join your organization on Remote365.",
        "de": "Legen Sie ein Passwort fest, um Ihrer Organisation in Remote365 beizutreten.",
        "fr": "Définissez un mot de passe pour rejoindre votre organisation sur Remote365.",
        "es": "Establece una contraseña para unirte a tu organización en Remote365.",
        "ar-SA": "عيّن كلمة مرور للانضمام إلى مؤسستك على Remote365."
    },
    "Full Name": {
        "en": "Full Name",
        "de": "Vollständiger Name",
        "fr": "Nom complet",
        "es": "Nombre completo",
        "ar-SA": "الاسم الكامل"
    },
    "New Password": {
        "en": "New Password",
        "de": "Neues Passwort",
        "fr": "Nouveau mot de passe",
        "es": "Nueva contraseña",
        "ar-SA": "كلمة المرور الجديدة"
    },
    "Confirm Password": {
        "en": "Confirm Password",
        "de": "Passwort bestätigen",
        "fr": "Confirmer le mot de passe",
        "es": "Confirmar contraseña",
        "ar-SA": "تأكيد كلمة المرور"
    },
    "Secure Corporate Invite": {
        "en": "Secure Corporate Invite",
        "de": "Sichere Unternehmenseinladung",
        "fr": "Invitation d'entreprise sécurisée",
        "es": "Invitación corporativa segura",
        "ar-SA": "دعوة مؤسسية آمنة"
    },
    "By joining, you agree to your organization's device management policies and data privacy standards.": {
        "en": "By joining, you agree to your organization's device management policies and data privacy standards.",
        "de": "Mit Ihrem Beitritt stimmen Sie den Geräteverwaltungsrichtlinien und Datenschutzstandards Ihrer Organisation zu.",
        "fr": "En rejoignant l'organisation, vous acceptez ses règles de gestion des appareils et ses normes de confidentialité des données.",
        "es": "Al unirte, aceptas las políticas de gestión de dispositivos y los estándares de privacidad de datos de tu organización.",
        "ar-SA": "بانضمامك، فإنك توافق على سياسات إدارة الأجهزة ومعايير خصوصية البيانات الخاصة بمؤسستك."
    },
    "Enter Your Name": {
        "en": "Enter Your Name",
        "de": "Namen eingeben",
        "fr": "Saisissez votre nom",
        "es": "Introduce tu nombre",
        "ar-SA": "أدخل اسمك"
    },
    "At Least 8 Characters": {
        "en": "At Least 8 Characters",
        "de": "Mindestens 8 Zeichen",
        "fr": "Au moins 8 caractères",
        "es": "Al menos 8 caracteres",
        "ar-SA": "8 أحرف على الأقل"
    },
    "Repeat Password": {
        "en": "Repeat Password",
        "de": "Passwort wiederholen",
        "fr": "Répéter le mot de passe",
        "es": "Repetir contraseña",
        "ar-SA": "أعد إدخال كلمة المرور"
    },
    "Full Name Is Required": {
        "en": "Full Name Is Required",
        "de": "Vollständiger Name ist erforderlich",
        "fr": "Le nom complet est obligatoire",
        "es": "El nombre completo es obligatorio",
        "ar-SA": "الاسم الكامل مطلوب"
    },
    "Passwords Do Not Match": {
        "en": "Passwords Do Not Match",
        "de": "Passwörter stimmen nicht überein",
        "fr": "Les mots de passe ne correspondent pas",
        "es": "Las contraseñas no coinciden",
        "ar-SA": "كلمتا المرور غير متطابقتين"
    },
    "Password must be at least 8 characters": {
        "en": "Password must be at least 8 characters",
        "de": "Das Passwort muss mindestens 8 Zeichen lang sein",
        "fr": "Le mot de passe doit comporter au moins 8 caractères",
        "es": "La contraseña debe tener al menos 8 caracteres",
        "ar-SA": "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل"
    },
    "Loading Organization...": {
        "en": "Loading Organization...",
        "de": "Organisation wird geladen...",
        "fr": "Chargement de l'organisation...",
        "es": "Cargando organización...",
        "ar-SA": "جارٍ تحميل المؤسسة..."
    },
    "Failed To Load": {
        "en": "Failed To Load",
        "de": "Laden fehlgeschlagen",
        "fr": "Échec du chargement",
        "es": "Error al cargar",
        "ar-SA": "فشل التحميل"
    },
    "Go Back": {
        "en": "Go Back",
        "de": "Zurück",
        "fr": "Retour",
        "es": "Volver",
        "ar-SA": "رجوع"
    },
    "Back To Analytics": {
        "en": "Back To Analytics",
        "de": "Zurück zu Analysen",
        "fr": "Retour aux analyses",
        "es": "Volver a Análisis",
        "ar-SA": "العودة إلى التحليلات"
    },
    "No Members": {
        "en": "No Members",
        "de": "Keine Mitglieder",
        "fr": "Aucun membre",
        "es": "Sin miembros",
        "ar-SA": "لا يوجد أعضاء"
    },
    "No Devices Registered": {
        "en": "No Devices Registered",
        "de": "Keine Geräte registriert",
        "fr": "Aucun appareil enregistré",
        "es": "No hay dispositivos registrados",
        "ar-SA": "لا توجد أجهزة مسجلة"
    },
    "Last seen": {
        "en": "Last seen",
        "de": "Zuletzt online",
        "fr": "Vu pour la dernière fois",
        "es": "Última conexión",
        "ar-SA": "آخر ظهور"
    },
    "Super Admin": {
        "en": "Super Admin",
        "de": "Super-Admin",
        "fr": "Super administrateur",
        "es": "Superadministrador",
        "ar-SA": "مسؤول أعلى"
    },
    "Technician": {
        "en": "Technician",
        "de": "Techniker",
        "fr": "Technicien",
        "es": "Técnico",
        "ar-SA": "فني"
    },
    "Security Policies": {
        "en": "Security Policies",
        "de": "Sicherheitsrichtlinien",
        "fr": "Règles de sécurité",
        "es": "Políticas de seguridad",
        "ar-SA": "سياسات الأمان"
    },
    "Enforce 2FA": {
        "en": "Enforce 2FA",
        "de": "2FA erzwingen",
        "fr": "Imposer la 2FA",
        "es": "Exigir 2FA",
        "ar-SA": "فرض 2FA"
    },
    "Require all members to have 2FA enabled to access devices": {
        "en": "Require all members to have 2FA enabled to access devices",
        "de": "Alle Mitglieder müssen 2FA aktiviert haben, um auf Geräte zuzugreifen",
        "fr": "Exiger que tous les membres activent la 2FA pour accéder aux appareils",
        "es": "Exigir que todos los miembros tengan 2FA activada para acceder a los dispositivos",
        "ar-SA": "إلزام جميع الأعضاء بتفعيل 2FA للوصول إلى الأجهزة"
    },
    "Default Member Role": {
        "en": "Default Member Role",
        "de": "Standardrolle für Mitglieder",
        "fr": "Rôle par défaut des membres",
        "es": "Rol predeterminado de los miembros",
        "ar-SA": "الدور الافتراضي للأعضاء"
    },
    "Initial permissions assigned to newly invited organization members": {
        "en": "Initial permissions assigned to newly invited organization members",
        "de": "Anfangsberechtigungen für neu eingeladene Organisationsmitglieder",
        "fr": "Autorisations initiales attribuées aux nouveaux membres invités",
        "es": "Permisos iniciales asignados a los nuevos miembros invitados de la organización",
        "ar-SA": "الأذونات الأولية المعيّنة لأعضاء المؤسسة المدعوين حديثًا"
    },
    "Fleet Management": {
        "en": "Fleet Management",
        "de": "Flottenverwaltung",
        "fr": "Gestion du parc",
        "es": "Gestión de la flota",
        "ar-SA": "إدارة الأسطول"
    },
    "Active Members": {
        "en": "Active Members",
        "de": "Aktive Mitglieder",
        "fr": "Membres actifs",
        "es": "Miembros activos",
        "ar-SA": "الأعضاء النشطون"
    },
    "Asset Tags": {
        "en": "Asset Tags",
        "de": "Asset-Tags",
        "fr": "Étiquettes d'inventaire",
        "es": "Etiquetas de activos",
        "ar-SA": "علامات الأصول"
    },
    "Global Device Organization Tags": {
        "en": "Global Device Organization Tags",
        "de": "Globale Tags zur Geräteorganisation",
        "fr": "Étiquettes globales d'organisation des appareils",
        "es": "Etiquetas globales de organización de dispositivos",
        "ar-SA": "علامات تنظيم الأجهزة العامة"
    },
    "Subscription & Limits": {
        "en": "Subscription & Limits",
        "de": "Abonnement & Limits",
        "fr": "Abonnement et limites",
        "es": "Suscripción y límites",
        "ar-SA": "الاشتراك والحدود"
    },
    "Device Limit": {
        "en": "Device Limit",
        "de": "Gerätelimit",
        "fr": "Limite d'appareils",
        "es": "Límite de dispositivos",
        "ar-SA": "حد الأجهزة"
    },
    "View Billing Console": {
        "en": "View Billing Console",
        "de": "Abrechnungskonsole anzeigen",
        "fr": "Afficher la console de facturation",
        "es": "Ver consola de facturación",
        "ar-SA": "عرض وحدة الفوترة"
    },
    "Total Revenue:": {
        "en": "Total Revenue:",
        "de": "Gesamtumsatz:",
        "fr": "Revenu total :",
        "es": "Ingresos totales:",
        "ar-SA": "إجمالي الإيرادات:"
    },
    "New Org": {
        "en": "New Org",
        "de": "Neue Org.",
        "fr": "Nouvelle org.",
        "es": "Nueva org.",
        "ar-SA": "مؤسسة جديدة"
    },
    "No Organizations Found": {
        "en": "No Organizations Found",
        "de": "Keine Organisationen gefunden",
        "fr": "Aucune organisation trouvée",
        "es": "No se encontraron organizaciones",
        "ar-SA": "لم يتم العثور على مؤسسات"
    },
    "Plan": {
        "en": "Plan",
        "de": "Tarif",
        "fr": "Forfait",
        "es": "Plan",
        "ar-SA": "الخطة"
    },
    "No Members Yet": {
        "en": "No Members Yet",
        "de": "Noch keine Mitglieder",
        "fr": "Aucun membre pour l'instant",
        "es": "Aún no hay miembros",
        "ar-SA": "لا يوجد أعضاء بعد"
    },
    "No Billing Data Found": {
        "en": "No Billing Data Found",
        "de": "Keine Abrechnungsdaten gefunden",
        "fr": "Aucune donnée de facturation trouvée",
        "es": "No se encontraron datos de facturación",
        "ar-SA": "لم يتم العثور على بيانات فوترة"
    },
    "No recent invoices.": {
        "en": "No recent invoices.",
        "de": "Keine aktuellen Rechnungen.",
        "fr": "Aucune facture récente.",
        "es": "No hay facturas recientes.",
        "ar-SA": "لا توجد فواتير حديثة."
    },
    "Lifetime Access · No Expiry": {
        "en": "Lifetime Access · No Expiry",
        "de": "Lebenslanger Zugriff · Kein Ablauf",
        "fr": "Accès à vie · Sans expiration",
        "es": "Acceso de por vida · Sin caducidad",
        "ar-SA": "وصول مدى الحياة · بدون انتهاء"
    },
    "Billing Plan": {
        "en": "Billing Plan",
        "de": "Abrechnungstarif",
        "fr": "Forfait de facturation",
        "es": "Plan de facturación",
        "ar-SA": "خطة الفوترة"
    },
    "Assign Plan To This Organization's Admin": {
        "en": "Assign Plan To This Organization's Admin",
        "de": "Tarif dem Admin dieser Organisation zuweisen",
        "fr": "Attribuer le forfait à l'administrateur de cette organisation",
        "es": "Asignar plan al administrador de esta organización",
        "ar-SA": "تعيين الخطة لمسؤول هذه المؤسسة"
    },
    "View In Devices": {
        "en": "View In Devices",
        "de": "In Geräten anzeigen",
        "fr": "Afficher dans Appareils",
        "es": "Ver en Dispositivos",
        "ar-SA": "عرض في الأجهزة"
    },
    "Delete Org": {
        "en": "Delete Org",
        "de": "Org. löschen",
        "fr": "Supprimer l'org.",
        "es": "Eliminar org.",
        "ar-SA": "حذف المؤسسة"
    },
    "Permanently Delete?": {
        "en": "Permanently Delete?",
        "de": "Endgültig löschen?",
        "fr": "Supprimer définitivement ?",
        "es": "¿Eliminar permanentemente?",
        "ar-SA": "حذف نهائيًا؟"
    },
    "Yes": {
        "en": "Yes",
        "de": "Ja",
        "fr": "Oui",
        "es": "Sí",
        "ar-SA": "نعم"
    },
    "No": {
        "en": "No",
        "de": "Nein",
        "fr": "Non",
        "es": "No",
        "ar-SA": "لا"
    },
    "Create Organization": {
        "en": "Create Organization",
        "de": "Organisation erstellen",
        "fr": "Créer une organisation",
        "es": "Crear organización",
        "ar-SA": "إنشاء مؤسسة"
    },
    "Display Name": {
        "en": "Display Name",
        "de": "Anzeigename",
        "fr": "Nom d'affichage",
        "es": "Nombre visible",
        "ar-SA": "الاسم المعروض"
    },
    "Slug (URL Identifier)": {
        "en": "Slug (URL Identifier)",
        "de": "Slug (URL-Kennung)",
        "fr": "Slug (identifiant d'URL)",
        "es": "Slug (identificador de URL)",
        "ar-SA": "Slug (معرّف URL)"
    },
    "Provision Organization": {
        "en": "Provision Organization",
        "de": "Organisation bereitstellen",
        "fr": "Provisionner l'organisation",
        "es": "Aprovisionar organización",
        "ar-SA": "تجهيز المؤسسة"
    },
    "Search Organizations...": {
        "en": "Search Organizations...",
        "de": "Organisationen suchen...",
        "fr": "Rechercher des organisations...",
        "es": "Buscar organizaciones...",
        "ar-SA": "البحث في المؤسسات..."
    },
    "No Recent Connections": {
        "en": "No Recent Connections",
        "de": "Keine letzten Verbindungen",
        "fr": "Aucune connexion récente",
        "es": "No hay conexiones recientes",
        "ar-SA": "لا توجد اتصالات حديثة"
    },
    "Manage your personal account and language preferences.": {
        "en": "Manage your personal account and language preferences.",
        "de": "Verwalten Sie Ihr persönliches Konto und Ihre Spracheinstellungen.",
        "fr": "Gérez votre compte personnel et vos préférences de langue.",
        "es": "Gestiona tu cuenta personal y tus preferencias de idioma.",
        "ar-SA": "إدارة حسابك الشخصي وتفضيلات اللغة."
    },
    "PNG, JPEG Under 2MB": {
        "en": "PNG, JPEG Under 2MB",
        "de": "PNG, JPEG unter 2MB",
        "fr": "PNG, JPEG de moins de 2MB",
        "es": "PNG, JPEG de menos de 2MB",
        "ar-SA": "PNG، JPEG أقل من 2MB"
    },
    "The name shown to your team and on session requests.": {
        "en": "The name shown to your team and on session requests.",
        "de": "Der Name, der Ihrem Team und bei Sitzungsanfragen angezeigt wird.",
        "fr": "Le nom affiché pour votre équipe et dans les demandes de session.",
        "es": "El nombre que ve tu equipo y que aparece en las solicitudes de sesión.",
        "ar-SA": "الاسم الذي يظهر لفريقك وفي طلبات الجلسات."
    },
    "We send security alerts and login codes here.": {
        "en": "We send security alerts and login codes here.",
        "de": "Hierhin senden wir Sicherheitswarnungen und Anmeldecodes.",
        "fr": "Nous envoyons ici les alertes de sécurité et les codes de connexion.",
        "es": "Aquí enviamos las alertas de seguridad y los códigos de inicio de sesión.",
        "ar-SA": "نرسل تنبيهات الأمان ورموز تسجيل الدخول إلى هنا."
    },
    "Interface Language": {
        "en": "Interface Language",
        "de": "Oberflächensprache",
        "fr": "Langue de l'interface",
        "es": "Idioma de la interfaz",
        "ar-SA": "لغة الواجهة"
    },
    "Changes the language across all Remote365 surfaces.": {
        "en": "Changes the language across all Remote365 surfaces.",
        "de": "Ändert die Sprache in allen Bereichen von Remote365.",
        "fr": "Modifie la langue sur l'ensemble de Remote365.",
        "es": "Cambia el idioma en todas las áreas de Remote365.",
        "ar-SA": "يغيّر اللغة في جميع واجهات Remote365."
    },
    "Regional Time Zone": {
        "en": "Regional Time Zone",
        "de": "Regionale Zeitzone",
        "fr": "Fuseau horaire régional",
        "es": "Zona horaria regional",
        "ar-SA": "المنطقة الزمنية الإقليمية"
    },
    "Used for session timestamps, audit logs, and scheduling.": {
        "en": "Used for session timestamps, audit logs, and scheduling.",
        "de": "Wird für Sitzungszeitstempel, Audit-Protokolle und die Terminplanung verwendet.",
        "fr": "Utilisé pour l'horodatage des sessions, les journaux d'audit et la planification.",
        "es": "Se usa para las marcas de tiempo de las sesiones, los registros de auditoría y la programación.",
        "ar-SA": "يُستخدم للطوابع الزمنية للجلسات وسجلات التدقيق والجدولة."
    },
    "Only users in your contact can see your status and send you messages": {
        "en": "Only users in your contact can see your status and send you messages",
        "de": "Nur Benutzer in Ihren Kontakten können Ihren Status sehen und Ihnen Nachrichten senden",
        "fr": "Seuls les utilisateurs de vos contacts peuvent voir votre statut et vous envoyer des messages",
        "es": "Solo los usuarios de tus contactos pueden ver tu estado y enviarte mensajes",
        "ar-SA": "يمكن للمستخدمين في جهات اتصالك فقط رؤية حالتك وإرسال رسائل إليك"
    },
    "Account Security": {
        "en": "Account Security",
        "de": "Kontosicherheit",
        "fr": "Sécurité du compte",
        "es": "Seguridad de la cuenta",
        "ar-SA": "أمان الحساب"
    },
    "Manage your account security": {
        "en": "Manage your account security",
        "de": "Verwalten Sie die Sicherheit Ihres Kontos",
        "fr": "Gérez la sécurité de votre compte",
        "es": "Gestiona la seguridad de tu cuenta",
        "ar-SA": "إدارة أمان حسابك"
    },
    "Review the installed version and latest release before installing updates.": {
        "en": "Review the installed version and latest release before installing updates.",
        "de": "Prüfen Sie vor der Installation von Updates die installierte Version und das neueste Release.",
        "fr": "Vérifiez la version installée et la dernière version disponible avant d'installer des mises à jour.",
        "es": "Revisa la versión instalada y la última versión antes de instalar actualizaciones.",
        "ar-SA": "راجع الإصدار المثبّت وأحدث إصدار قبل تثبيت التحديثات."
    },
    "Check Again": {
        "en": "Check Again",
        "de": "Erneut prüfen",
        "fr": "Vérifier à nouveau",
        "es": "Volver a comprobar",
        "ar-SA": "التحقق مرة أخرى"
    },
    "What Changed": {
        "en": "What Changed",
        "de": "Was ist neu",
        "fr": "Nouveautés",
        "es": "Novedades",
        "ar-SA": "ما الجديد"
    },
    "No release notes were published for this version yet.": {
        "en": "No release notes were published for this version yet.",
        "de": "Für diese Version wurden noch keine Versionshinweise veröffentlicht.",
        "fr": "Aucune note de version n'a encore été publiée pour cette version.",
        "es": "Aún no se han publicado notas de la versión para esta versión.",
        "ar-SA": "لم تُنشر ملاحظات الإصدار لهذا الإصدار بعد."
    },
    "Restart And Install": {
        "en": "Restart And Install",
        "de": "Neu starten und installieren",
        "fr": "Redémarrer et installer",
        "es": "Reiniciar e instalar",
        "ar-SA": "إعادة التشغيل والتثبيت"
    },
    "Personalize the look and feel of Remote365.": {
        "en": "Personalize the look and feel of Remote365.",
        "de": "Passen Sie das Erscheinungsbild von Remote365 an.",
        "fr": "Personnalisez l'apparence de Remote365.",
        "es": "Personaliza el aspecto de Remote365.",
        "ar-SA": "خصّص مظهر Remote365."
    },
    "Color Mode": {
        "en": "Color Mode",
        "de": "Farbmodus",
        "fr": "Mode de couleur",
        "es": "Modo de color",
        "ar-SA": "وضع الألوان"
    },
    "Select the color mode for you Remote365": {
        "en": "Select the color mode for you Remote365",
        "de": "Wählen Sie den Farbmodus für Ihr Remote365",
        "fr": "Sélectionnez le mode de couleur de votre Remote365",
        "es": "Selecciona el modo de color de tu Remote365",
        "ar-SA": "اختر وضع الألوان لـ Remote365"
    },
    "Global Font Scaling": {
        "en": "Global Font Scaling",
        "de": "Globale Schriftskalierung",
        "fr": "Mise à l'échelle globale du texte",
        "es": "Escala de fuente global",
        "ar-SA": "تغيير حجم الخط العام"
    },
    "Adjust text size across the entire application.": {
        "en": "Adjust text size across the entire application.",
        "de": "Passen Sie die Textgröße in der gesamten Anwendung an.",
        "fr": "Ajustez la taille du texte dans toute l'application.",
        "es": "Ajusta el tamaño del texto en toda la aplicación.",
        "ar-SA": "اضبط حجم النص في التطبيق بأكمله."
    },
    "Manage your device identity and startup behavior.": {
        "en": "Manage your device identity and startup behavior.",
        "de": "Verwalten Sie die Geräteidentität und das Startverhalten.",
        "fr": "Gérez l'identité de votre appareil et son comportement au démarrage.",
        "es": "Gestiona la identidad de tu dispositivo y el comportamiento de inicio.",
        "ar-SA": "إدارة هوية جهازك وسلوك بدء التشغيل."
    },
    "Name to identify this machine across your fleet.": {
        "en": "Name to identify this machine across your fleet.",
        "de": "Name zur Identifizierung dieses Computers in Ihrer Flotte.",
        "fr": "Nom permettant d'identifier cette machine dans votre parc.",
        "es": "Nombre para identificar este equipo en tu flota.",
        "ar-SA": "اسم لتعريف هذا الجهاز ضمن أسطولك."
    },
    "Remote365 will launch automatically after you start your device.": {
        "en": "Remote365 will launch automatically after you start your device.",
        "de": "Remote365 startet automatisch, nachdem Sie Ihr Gerät eingeschaltet haben.",
        "fr": "Remote365 se lancera automatiquement au démarrage de votre appareil.",
        "es": "Remote365 se iniciará automáticamente al encender tu dispositivo.",
        "ar-SA": "سيبدأ تشغيل Remote365 تلقائيًا بعد تشغيل جهازك."
    },
    "Remote365 Device Dock": {
        "en": "Remote365 Device Dock",
        "de": "Remote365 Geräte-Dock",
        "fr": "Dock d'appareils Remote365",
        "es": "Dock de dispositivos Remote365",
        "ar-SA": "منصة أجهزة Remote365"
    },
    "Keep agent running when app is closed": {
        "en": "Keep agent running when app is closed",
        "de": "Agent nach dem Schließen der App weiter ausführen",
        "fr": "Laisser l'agent actif quand l'application est fermée",
        "es": "Mantener el agente activo al cerrar la aplicación",
        "ar-SA": "إبقاء الوكيل قيد التشغيل عند إغلاق التطبيق"
    },
    "Allow your team to connect to this device even when the app isn't open.": {
        "en": "Allow your team to connect to this device even when the app isn't open.",
        "de": "Ihr Team kann sich mit diesem Gerät verbinden, auch wenn die App nicht geöffnet ist.",
        "fr": "Permettez à votre équipe de se connecter à cet appareil même lorsque l'application n'est pas ouverte.",
        "es": "Permite que tu equipo se conecte a este dispositivo aunque la aplicación no esté abierta.",
        "ar-SA": "اسمح لفريقك بالاتصال بهذا الجهاز حتى عندما يكون التطبيق مغلقًا."
    },
    "Updates Automatically": {
        "en": "Updates Automatically",
        "de": "Automatische Updates",
        "fr": "Mises à jour automatiques",
        "es": "Actualizaciones automáticas",
        "ar-SA": "التحديث تلقائيًا"
    },
    "New versions download and install by themselves.": {
        "en": "New versions download and install by themselves.",
        "de": "Neue Versionen werden automatisch heruntergeladen und installiert.",
        "fr": "Les nouvelles versions se téléchargent et s'installent automatiquement.",
        "es": "Las nuevas versiones se descargan e instalan solas.",
        "ar-SA": "يتم تنزيل الإصدارات الجديدة وتثبيتها تلقائيًا."
    },
    "Protect your account and control how sessions are authenticated.": {
        "en": "Protect your account and control how sessions are authenticated.",
        "de": "Schützen Sie Ihr Konto und legen Sie fest, wie Sitzungen authentifiziert werden.",
        "fr": "Protégez votre compte et contrôlez l'authentification des sessions.",
        "es": "Protege tu cuenta y controla cómo se autentican las sesiones.",
        "ar-SA": "احمِ حسابك وتحكّم في طريقة مصادقة الجلسات."
    },
    "Signed In With Google": {
        "en": "Signed In With Google",
        "de": "Mit Google angemeldet",
        "fr": "Connecté avec Google",
        "es": "Sesión iniciada con Google",
        "ar-SA": "تم تسجيل الدخول باستخدام Google"
    },
    "Very Secure": {
        "en": "Very Secure",
        "de": "Sehr sicher",
        "fr": "Très sécurisé",
        "es": "Muy seguro",
        "ar-SA": "آمن جدًا"
    },
    "Reset Password": {
        "en": "Reset Password",
        "de": "Passwort zurücksetzen",
        "fr": "Réinitialiser le mot de passe",
        "es": "Restablecer contraseña",
        "ar-SA": "إعادة تعيين كلمة المرور"
    },
    "Installed": {
        "en": "Installed",
        "de": "Installiert",
        "fr": "Installé",
        "es": "Instalado",
        "ar-SA": "مثبّت"
    },
    "Configure the hardware used during remote sessions.": {
        "en": "Configure the hardware used during remote sessions.",
        "de": "Konfigurieren Sie die Hardware für Remote-Sitzungen.",
        "fr": "Configurez le matériel utilisé pendant les sessions à distance.",
        "es": "Configura el hardware que se usa durante las sesiones remotas.",
        "ar-SA": "اضبط الأجهزة المستخدمة أثناء الجلسات عن بُعد."
    },
    "Input Volume": {
        "en": "Input Volume",
        "de": "Eingangslautstärke",
        "fr": "Volume d'entrée",
        "es": "Volumen de entrada",
        "ar-SA": "مستوى صوت الإدخال"
    },
    "Output Volume": {
        "en": "Output Volume",
        "de": "Ausgangslautstärke",
        "fr": "Volume de sortie",
        "es": "Volumen de salida",
        "ar-SA": "مستوى صوت الإخراج"
    },
    "Click To Enable Preview": {
        "en": "Click To Enable Preview",
        "de": "Klicken, um Vorschau zu aktivieren",
        "fr": "Cliquez pour activer l'aperçu",
        "es": "Haz clic para activar la vista previa",
        "ar-SA": "انقر لتفعيل المعاينة"
    },
    "Video Source": {
        "en": "Video Source",
        "de": "Videoquelle",
        "fr": "Source vidéo",
        "es": "Fuente de vídeo",
        "ar-SA": "مصدر الفيديو"
    },
    "Choose what to be alerted about and how.": {
        "en": "Choose what to be alerted about and how.",
        "de": "Legen Sie fest, worüber und wie Sie benachrichtigt werden.",
        "fr": "Choisissez les alertes à recevoir et leur mode de réception.",
        "es": "Elige sobre qué recibir alertas y cómo.",
        "ar-SA": "اختر ما تريد التنبيه بشأنه وطريقة التنبيه."
    },
    "Windows Notification for incoming sessions.": {
        "en": "Windows Notification for incoming sessions.",
        "de": "Windows-Benachrichtigung bei eingehenden Sitzungen.",
        "fr": "Notification Windows pour les sessions entrantes.",
        "es": "Notificación de Windows para sesiones entrantes.",
        "ar-SA": "إشعار Windows للجلسات الواردة."
    },
    "Get notified when a session starts or ends.": {
        "en": "Get notified when a session starts or ends.",
        "de": "Benachrichtigung erhalten, wenn eine Sitzung beginnt oder endet.",
        "fr": "Soyez averti lorsqu'une session commence ou se termine.",
        "es": "Recibe una notificación cuando una sesión empiece o termine.",
        "ar-SA": "احصل على إشعار عند بدء جلسة أو انتهائها."
    },
    "Devices and browsers currently signed in to your account.": {
        "en": "Devices and browsers currently signed in to your account.",
        "de": "Geräte und Browser, die derzeit bei Ihrem Konto angemeldet sind.",
        "fr": "Appareils et navigateurs actuellement connectés à votre compte.",
        "es": "Dispositivos y navegadores con sesión iniciada en tu cuenta.",
        "ar-SA": "الأجهزة والمتصفحات المسجّل دخولها حاليًا إلى حسابك."
    },
    "Current Session": {
        "en": "Current Session",
        "de": "Aktuelle Sitzung",
        "fr": "Session actuelle",
        "es": "Sesión actual",
        "ar-SA": "الجلسة الحالية"
    },
    "Active Now": {
        "en": "Active Now",
        "de": "Jetzt aktiv",
        "fr": "Actif maintenant",
        "es": "Activo ahora",
        "ar-SA": "نشط الآن"
    },
    "Other Active Sessions": {
        "en": "Other Active Sessions",
        "de": "Andere aktive Sitzungen",
        "fr": "Autres sessions actives",
        "es": "Otras sesiones activas",
        "ar-SA": "جلسات نشطة أخرى"
    },
    "Loading Sessions…": {
        "en": "Loading Sessions…",
        "de": "Sitzungen werden geladen…",
        "fr": "Chargement des sessions…",
        "es": "Cargando sesiones…",
        "ar-SA": "جارٍ تحميل الجلسات…"
    },
    "No other active sessions. You're only signed in on this device.": {
        "en": "No other active sessions. You're only signed in on this device.",
        "de": "Keine anderen aktiven Sitzungen. Sie sind nur auf diesem Gerät angemeldet.",
        "fr": "Aucune autre session active. Vous êtes connecté uniquement sur cet appareil.",
        "es": "No hay otras sesiones activas. Solo has iniciado sesión en este dispositivo.",
        "ar-SA": "لا توجد جلسات نشطة أخرى. أنت مسجّل الدخول على هذا الجهاز فقط."
    },
    "IP Address": {
        "en": "IP Address",
        "de": "IP-Adresse",
        "fr": "Adresse IP",
        "es": "Dirección IP",
        "ar-SA": "عنوان IP"
    },
    "Last Active": {
        "en": "Last Active",
        "de": "Zuletzt aktiv",
        "fr": "Dernière activité",
        "es": "Última actividad",
        "ar-SA": "آخر نشاط"
    },
    "Control how this machine can be accessed by your team.": {
        "en": "Control how this machine can be accessed by your team.",
        "de": "Legen Sie fest, wie Ihr Team auf diesen Computer zugreifen kann.",
        "fr": "Contrôlez la façon dont votre équipe peut accéder à cette machine.",
        "es": "Controla cómo puede acceder tu equipo a este equipo.",
        "ar-SA": "تحكّم في طريقة وصول فريقك إلى هذا الجهاز."
    },
    "Assigned To": {
        "en": "Assigned To",
        "de": "Zugewiesen an",
        "fr": "Attribué à",
        "es": "Asignado a",
        "ar-SA": "مُسند إلى"
    },
    "Primary owner of this device.": {
        "en": "Primary owner of this device.",
        "de": "Hauptbesitzer dieses Geräts.",
        "fr": "Propriétaire principal de cet appareil.",
        "es": "Propietario principal de este dispositivo.",
        "ar-SA": "المالك الأساسي لهذا الجهاز."
    },
    "Tags": {
        "en": "Tags",
        "de": "Tags",
        "fr": "Étiquettes",
        "es": "Etiquetas",
        "ar-SA": "الوسوم"
    },
    "Add Tag": {
        "en": "Add Tag",
        "de": "Tag hinzufügen",
        "fr": "Ajouter une étiquette",
        "es": "Añadir etiqueta",
        "ar-SA": "إضافة وسم"
    },
    "Department": {
        "en": "Department",
        "de": "Abteilung",
        "fr": "Service",
        "es": "Departamento",
        "ar-SA": "القسم"
    },
    "Temporary Access": {
        "en": "Temporary Access",
        "de": "Temporärer Zugriff",
        "fr": "Accès temporaire",
        "es": "Acceso temporal",
        "ar-SA": "وصول مؤقت"
    },
    "Give someone one-time access without sharing your real password. They still connect using your": {
        "en": "Give someone one-time access without sharing your real password. They still connect using your",
        "de": "Gewähren Sie jemandem einmaligen Zugriff, ohne Ihr echtes Passwort weiterzugeben. Die Verbindung erfolgt weiterhin über Ihre",
        "fr": "Donnez un accès unique à quelqu'un sans partager votre vrai mot de passe. La personne se connecte toujours avec votre",
        "es": "Da acceso de un solo uso a alguien sin compartir tu contraseña real. Seguirá conectándose con tu",
        "ar-SA": "امنح شخصًا وصولًا لمرة واحدة دون مشاركة كلمة مرورك الحقيقية. سيظل يتصل باستخدام"
    },
    "Where The Password Is Asked": {
        "en": "Where The Password Is Asked",
        "de": "Wo das Passwort abgefragt wird",
        "fr": "Où le mot de passe est demandé",
        "es": "Dónde se pide la contraseña",
        "ar-SA": "مكان طلب كلمة المرور"
    },
    "Your Device ID:": {
        "en": "Your Device ID:",
        "de": "Ihre Geräte-ID:",
        "fr": "ID de votre appareil :",
        "es": "ID de tu dispositivo:",
        "ar-SA": "ID جهازك:"
    },
    "Code": {
        "en": "Code",
        "de": "Code",
        "fr": "Code",
        "es": "Código",
        "ar-SA": "الرمز"
    },
    "Copy": {
        "en": "Copy",
        "de": "Kopieren",
        "fr": "Copier",
        "es": "Copiar",
        "ar-SA": "نسخ"
    },
    "Revoke": {
        "en": "Revoke",
        "de": "Widerrufen",
        "fr": "Révoquer",
        "es": "Revocar",
        "ar-SA": "إلغاء"
    },
    "Access Schedule": {
        "en": "Access Schedule",
        "de": "Zugriffszeitplan",
        "fr": "Planning d'accès",
        "es": "Horario de acceso",
        "ar-SA": "جدول الوصول"
    },
    "To": {
        "en": "To",
        "de": "Bis",
        "fr": "À",
        "es": "Hasta",
        "ar-SA": "إلى"
    },
    "Hide This Device From Non-Admins": {
        "en": "Hide This Device From Non-Admins",
        "de": "Gerät vor Nicht-Administratoren verbergen",
        "fr": "Masquer cet appareil aux non-administrateurs",
        "es": "Ocultar este dispositivo a quienes no son administradores",
        "ar-SA": "إخفاء هذا الجهاز عن غير المسؤولين"
    },
    "Only Super Admins and Department Managers can see this machine": {
        "en": "Only Super Admins and Department Managers can see this machine",
        "de": "Nur Super-Admins und Abteilungsleiter können diesen Computer sehen",
        "fr": "Seuls les super-administrateurs et les responsables de service peuvent voir cette machine",
        "es": "Solo los superadministradores y los responsables de departamento pueden ver este equipo",
        "ar-SA": "لا يمكن رؤية هذا الجهاز إلا للمسؤولين الرئيسيين ومديري الأقسام"
    },
    "Notify Me When Accessed": {
        "en": "Notify Me When Accessed",
        "de": "Bei Zugriff benachrichtigen",
        "fr": "M'avertir en cas d'accès",
        "es": "Avisarme cuando se acceda",
        "ar-SA": "إعلامي عند الوصول"
    },
    "Default behavior during remote control sessions with another device.": {
        "en": "Default behavior during remote control sessions with another device.",
        "de": "Standardverhalten bei Fernsteuerungssitzungen mit einem anderen Gerät.",
        "fr": "Comportement par défaut pendant les sessions de contrôle à distance avec un autre appareil.",
        "es": "Comportamiento predeterminado durante las sesiones de control remoto con otro dispositivo.",
        "ar-SA": "السلوك الافتراضي أثناء جلسات التحكم عن بُعد مع جهاز آخر."
    },
    "Input And Display": {
        "en": "Input And Display",
        "de": "Eingabe und Anzeige",
        "fr": "Saisie et affichage",
        "es": "Entrada y pantalla",
        "ar-SA": "الإدخال والعرض"
    },
    "Clipboard Syncing": {
        "en": "Clipboard Syncing",
        "de": "Zwischenablage-Synchronisierung",
        "fr": "Synchronisation du presse-papiers",
        "es": "Sincronización del portapapeles",
        "ar-SA": "مزامنة الحافظة"
    },
    "Share copied text and files between your device and the remote.": {
        "en": "Share copied text and files between your device and the remote.",
        "de": "Kopierten Text und Dateien zwischen Ihrem Gerät und dem Remote-Gerät teilen.",
        "fr": "Partagez le texte et les fichiers copiés entre votre appareil et l'appareil distant.",
        "es": "Comparte texto y archivos copiados entre tu dispositivo y el remoto.",
        "ar-SA": "شارك النصوص والملفات المنسوخة بين جهازك والجهاز البعيد."
    },
    "Sync Keyboard Layout": {
        "en": "Sync Keyboard Layout",
        "de": "Tastaturlayout synchronisieren",
        "fr": "Synchroniser la disposition du clavier",
        "es": "Sincronizar distribución del teclado",
        "ar-SA": "مزامنة تخطيط لوحة المفاتيح"
    },
    "Use the remote machine's keyboard layout instead of yours.": {
        "en": "Use the remote machine's keyboard layout instead of yours.",
        "de": "Tastaturlayout des Remote-Computers statt Ihres eigenen verwenden.",
        "fr": "Utiliser la disposition du clavier de la machine distante au lieu de la vôtre.",
        "es": "Usa la distribución del teclado del equipo remoto en lugar de la tuya.",
        "ar-SA": "استخدام تخطيط لوحة مفاتيح الجهاز البعيد بدلًا من تخطيطك."
    },
    "Enable Drag And Drop": {
        "en": "Enable Drag And Drop",
        "de": "Drag & Drop aktivieren",
        "fr": "Activer le glisser-déposer",
        "es": "Activar arrastrar y soltar",
        "ar-SA": "تفعيل السحب والإفلات"
    },
    "When enabled, the files can be transferred by drag and drop.": {
        "en": "When enabled, the files can be transferred by drag and drop.",
        "de": "Wenn aktiviert, können Dateien per Drag & Drop übertragen werden.",
        "fr": "Lorsque cette option est activée, les fichiers peuvent être transférés par glisser-déposer.",
        "es": "Si está activado, los archivos se pueden transferir arrastrando y soltando.",
        "ar-SA": "عند التفعيل، يمكن نقل الملفات بالسحب والإفلات."
    },
    "Remote Cursor Style": {
        "en": "Remote Cursor Style",
        "de": "Stil des Remote-Cursors",
        "fr": "Style du curseur distant",
        "es": "Estilo del cursor remoto",
        "ar-SA": "نمط المؤشر البعيد"
    },
    "PERFORMANCE": {
        "en": "PERFORMANCE",
        "de": "LEISTUNG",
        "fr": "PERFORMANCES",
        "es": "RENDIMIENTO",
        "ar-SA": "الأداء"
    },
    "Display Quality": {
        "en": "Display Quality",
        "de": "Anzeigequalität",
        "fr": "Qualité d'affichage",
        "es": "Calidad de imagen",
        "ar-SA": "جودة العرض"
    },
    "Higher quality uses more bandwidth.": {
        "en": "Higher quality uses more bandwidth.",
        "de": "Höhere Qualität benötigt mehr Bandbreite.",
        "fr": "Une qualité supérieure consomme plus de bande passante.",
        "es": "Una calidad mayor consume más ancho de banda.",
        "ar-SA": "الجودة الأعلى تستهلك نطاقًا تردديًا أكبر."
    },
    "Suppress Remote Wallpaper": {
        "en": "Suppress Remote Wallpaper",
        "de": "Remote-Hintergrundbild ausblenden",
        "fr": "Masquer le fond d'écran distant",
        "es": "Ocultar fondo de pantalla remoto",
        "ar-SA": "إخفاء خلفية الجهاز البعيد"
    },
    "Hide the remote machine's desktop wallpaper to improve speed.": {
        "en": "Hide the remote machine's desktop wallpaper to improve speed.",
        "de": "Desktop-Hintergrund des Remote-Computers ausblenden, um die Geschwindigkeit zu verbessern.",
        "fr": "Masquer le fond d'écran de la machine distante pour améliorer la vitesse.",
        "es": "Oculta el fondo de escritorio del equipo remoto para mejorar la velocidad.",
        "ar-SA": "إخفاء خلفية سطح مكتب الجهاز البعيد لتحسين السرعة."
    },
    "Incoming Connections": {
        "en": "Incoming Connections",
        "de": "Eingehende Verbindungen",
        "fr": "Connexions entrantes",
        "es": "Conexiones entrantes",
        "ar-SA": "الاتصالات الواردة"
    },
    "Enable Local Inputs Doe Incoming Connections": {
        "en": "Enable Local Inputs Doe Incoming Connections",
        "de": "Lokale Eingaben bei eingehenden Verbindungen aktivieren",
        "fr": "Activer les saisies locales pour les connexions entrantes",
        "es": "Activar entradas locales en conexiones entrantes",
        "ar-SA": "تفعيل الإدخال المحلي للاتصالات الواردة"
    },
    "Allow data input operations by the end user who connects to this device.": {
        "en": "Allow data input operations by the end user who connects to this device.",
        "de": "Dateneingaben durch den Endbenutzer zulassen, der sich mit diesem Gerät verbindet.",
        "fr": "Autoriser les saisies de l'utilisateur final qui se connecte à cet appareil.",
        "es": "Permite la entrada de datos del usuario final que se conecta a este dispositivo.",
        "ar-SA": "السماح بعمليات إدخال البيانات من المستخدم النهائي الذي يتصل بهذا الجهاز."
    },
    "Enable Black Screen For Incoming Connections": {
        "en": "Enable Black Screen For Incoming Connections",
        "de": "Schwarzen Bildschirm bei eingehenden Verbindungen aktivieren",
        "fr": "Activer l'écran noir pour les connexions entrantes",
        "es": "Activar pantalla negra en conexiones entrantes",
        "ar-SA": "تفعيل الشاشة السوداء للاتصالات الواردة"
    },
    "Switches the device screen into black.": {
        "en": "Switches the device screen into black.",
        "de": "Schaltet den Gerätebildschirm schwarz.",
        "fr": "Passe l'écran de l'appareil au noir.",
        "es": "Pone la pantalla del dispositivo en negro.",
        "ar-SA": "يحوّل شاشة الجهاز إلى اللون الأسود."
    },
    "Hotkey To End Incoming Session": {
        "en": "Hotkey To End Incoming Session",
        "de": "Tastenkürzel zum Beenden eingehender Sitzungen",
        "fr": "Raccourci pour mettre fin à une session entrante",
        "es": "Atajo para finalizar la sesión entrante",
        "ar-SA": "اختصار لإنهاء الجلسة الواردة"
    },
    "Set a keyboard shortcut to instantly end any incoming session.": {
        "en": "Set a keyboard shortcut to instantly end any incoming session.",
        "de": "Legen Sie ein Tastenkürzel fest, um eingehende Sitzungen sofort zu beenden.",
        "fr": "Définissez un raccourci clavier pour mettre fin instantanément à toute session entrante.",
        "es": "Define un atajo de teclado para finalizar al instante cualquier sesión entrante.",
        "ar-SA": "عيّن اختصار لوحة مفاتيح لإنهاء أي جلسة واردة فورًا."
    },
    "Outgoing Connections": {
        "en": "Outgoing Connections",
        "de": "Ausgehende Verbindungen",
        "fr": "Connexions sortantes",
        "es": "Conexiones salientes",
        "ar-SA": "الاتصالات الصادرة"
    },
    "Play Device Sounds And Music": {
        "en": "Play Device Sounds And Music",
        "de": "Gerätesounds und Musik wiedergeben",
        "fr": "Lire les sons et la musique de l'appareil",
        "es": "Reproducir sonidos y música del dispositivo",
        "ar-SA": "تشغيل أصوات الجهاز والموسيقى"
    },
    "When activated, the sound from remote device is transferred to local device.": {
        "en": "When activated, the sound from remote device is transferred to local device.",
        "de": "Wenn aktiviert, wird der Ton des Remote-Geräts auf das lokale Gerät übertragen.",
        "fr": "Lorsque cette option est activée, le son de l'appareil distant est transmis à l'appareil local.",
        "es": "Si está activado, el sonido del dispositivo remoto se transmite al dispositivo local.",
        "ar-SA": "عند التفعيل، يتم نقل الصوت من الجهاز البعيد إلى الجهاز المحلي."
    },
    "Session Security": {
        "en": "Session Security",
        "de": "Sitzungssicherheit",
        "fr": "Sécurité des sessions",
        "es": "Seguridad de la sesión",
        "ar-SA": "أمان الجلسة"
    },
    "How this device behaves when someone connects to it. These settings are saved to your account.": {
        "en": "How this device behaves when someone connects to it. These settings are saved to your account.",
        "de": "Verhalten dieses Geräts, wenn sich jemand damit verbindet. Diese Einstellungen werden in Ihrem Konto gespeichert.",
        "fr": "Comportement de cet appareil lorsque quelqu'un s'y connecte. Ces paramètres sont enregistrés dans votre compte.",
        "es": "Cómo se comporta este dispositivo cuando alguien se conecta. Esta configuración se guarda en tu cuenta.",
        "ar-SA": "طريقة تصرّف هذا الجهاز عند اتصال شخص به. تُحفظ هذه الإعدادات في حسابك."
    },
    "Who Can Control This Device": {
        "en": "Who Can Control This Device",
        "de": "Wer dieses Gerät steuern darf",
        "fr": "Qui peut contrôler cet appareil",
        "es": "Quién puede controlar este dispositivo",
        "ar-SA": "من يمكنه التحكم في هذا الجهاز"
    },
    "View only lets people watch but not touch. Ask me shows a prompt each time. Allow grants control immediately.": {
        "en": "View only lets people watch but not touch. Ask me shows a prompt each time. Allow grants control immediately.",
        "de": "„Nur ansehen“ erlaubt Zuschauen, aber keine Eingaben. „Erst fragen“ zeigt jedes Mal eine Abfrage. „Zulassen“ gewährt sofort die Steuerung.",
        "fr": "« Lecture seule » permet de regarder sans interagir. « Me demander » affiche une invite à chaque fois. « Autoriser » accorde le contrôle immédiatement.",
        "es": "«Solo ver» permite mirar sin tocar. «Preguntarme» muestra un aviso cada vez. «Permitir» concede el control de inmediato.",
        "ar-SA": "\"العرض فقط\" يتيح المشاهدة دون تحكم. \"اسألني\" يعرض طلبًا في كل مرة. \"السماح\" يمنح التحكم فورًا."
    },
    "Panic Hotkey": {
        "en": "Panic Hotkey",
        "de": "Notfall-Tastenkürzel",
        "fr": "Raccourci d'urgence",
        "es": "Atajo de emergencia",
        "ar-SA": "اختصار الطوارئ"
    },
    "A system-wide shortcut that instantly ends every remote session — works even when Remote365 is minimized.": {
        "en": "A system-wide shortcut that instantly ends every remote session — works even when Remote365 is minimized.",
        "de": "Ein systemweites Tastenkürzel, das sofort jede Remote-Sitzung beendet — funktioniert auch, wenn Remote365 minimiert ist.",
        "fr": "Un raccourci système qui met fin instantanément à toutes les sessions à distance — fonctionne même lorsque Remote365 est réduit.",
        "es": "Un atajo de todo el sistema que finaliza al instante cualquier sesión remota — funciona incluso con Remote365 minimizado.",
        "ar-SA": "اختصار على مستوى النظام يُنهي كل جلسة عن بُعد فورًا — يعمل حتى عند تصغير Remote365."
    },
    "Press a combo like Ctrl + Shift + F8 · Esc to cancel": {
        "en": "Press a combo like Ctrl + Shift + F8 · Esc to cancel",
        "de": "Drücken Sie eine Kombination wie Ctrl + Shift + F8 · Esc zum Abbrechen",
        "fr": "Appuyez sur une combinaison comme Ctrl + Shift + F8 · Esc pour annuler",
        "es": "Pulsa una combinación como Ctrl + Shift + F8 · Esc para cancelar",
        "ar-SA": "اضغط على مجموعة مفاتيح مثل Ctrl + Shift + F8 · Esc للإلغاء"
    },
    "Also block new connections until I re-enable them": {
        "en": "Also block new connections until I re-enable them",
        "de": "Neue Verbindungen außerdem blockieren, bis ich sie wieder aktiviere",
        "fr": "Bloquer aussi les nouvelles connexions jusqu'à ce que je les réactive",
        "es": "Bloquear también nuevas conexiones hasta que las vuelva a activar",
        "ar-SA": "حظر الاتصالات الجديدة أيضًا حتى أعيد تفعيلها"
    },
    "Disconnect Idle Viewers": {
        "en": "Disconnect Idle Viewers",
        "de": "Inaktive Betrachter trennen",
        "fr": "Déconnecter les spectateurs inactifs",
        "es": "Desconectar espectadores inactivos",
        "ar-SA": "فصل المشاهدين غير النشطين"
    },
    "Automatically end a session when there's been no remote input for a while, so a forgotten session can't stay open.": {
        "en": "Automatically end a session when there's been no remote input for a while, so a forgotten session can't stay open.",
        "de": "Sitzung automatisch beenden, wenn eine Weile keine Remote-Eingabe erfolgt ist, damit keine vergessene Sitzung offen bleibt.",
        "fr": "Mettre fin automatiquement à une session sans saisie distante depuis un moment, pour qu'une session oubliée ne reste pas ouverte.",
        "es": "Finaliza automáticamente una sesión cuando no hay entrada remota durante un tiempo, para que una sesión olvidada no quede abierta.",
        "ar-SA": "إنهاء الجلسة تلقائيًا عند عدم وجود إدخال عن بُعد لفترة، حتى لا تبقى جلسة منسية مفتوحة."
    },
    "Save Received Files To": {
        "en": "Save Received Files To",
        "de": "Empfangene Dateien speichern in",
        "fr": "Enregistrer les fichiers reçus dans",
        "es": "Guardar archivos recibidos en",
        "ar-SA": "حفظ الملفات المستلمة في"
    },
    "Where files sent to this device are stored. Defaults to a Remote365 folder inside Downloads.": {
        "en": "Where files sent to this device are stored. Defaults to a Remote365 folder inside Downloads.",
        "de": "Speicherort für an dieses Gerät gesendete Dateien. Standard ist ein Remote365-Ordner unter Downloads.",
        "fr": "Emplacement des fichiers envoyés à cet appareil. Par défaut, un dossier Remote365 dans Téléchargements.",
        "es": "Dónde se guardan los archivos enviados a este dispositivo. De forma predeterminada, una carpeta Remote365 dentro de Descargas.",
        "ar-SA": "مكان تخزين الملفات المرسلة إلى هذا الجهاز. الافتراضي هو مجلد Remote365 داخل التنزيلات."
    },
    "Choose Folder": {
        "en": "Choose Folder",
        "de": "Ordner auswählen",
        "fr": "Choisir un dossier",
        "es": "Elegir carpeta",
        "ar-SA": "اختيار مجلد"
    },
    "Reset": {
        "en": "Reset",
        "de": "Zurücksetzen",
        "fr": "Réinitialiser",
        "es": "Restablecer",
        "ar-SA": "إعادة تعيين"
    },
    "Block File Transfer": {
        "en": "Block File Transfer",
        "de": "Dateiübertragung blockieren",
        "fr": "Bloquer le transfert de fichiers",
        "es": "Bloquear transferencia de archivos",
        "ar-SA": "حظر نقل الملفات"
    },
    "Nobody connected to this device can browse its files, send files to it, or take files from it. Remote control keeps working.": {
        "en": "Nobody connected to this device can browse its files, send files to it, or take files from it. Remote control keeps working.",
        "de": "Niemand, der mit diesem Gerät verbunden ist, kann dessen Dateien durchsuchen, Dateien dorthin senden oder von dort abrufen. Die Fernsteuerung funktioniert weiterhin.",
        "fr": "Personne connecté à cet appareil ne peut parcourir ses fichiers, lui en envoyer ou en récupérer. Le contrôle à distance continue de fonctionner.",
        "es": "Nadie conectado a este dispositivo podrá explorar sus archivos, enviarle archivos ni obtenerlos. El control remoto sigue funcionando.",
        "ar-SA": "لن يتمكن أي شخص متصل بهذا الجهاز من تصفح ملفاته أو إرسال ملفات إليه أو أخذ ملفات منه. يستمر التحكم عن بُعد في العمل."
    },
    "Configure how Remote365 connects, wakes devices, and optimizes session routing.": {
        "en": "Configure how Remote365 connects, wakes devices, and optimizes session routing.",
        "de": "Legen Sie fest, wie Remote365 Verbindungen herstellt, Geräte aufweckt und das Sitzungsrouting optimiert.",
        "fr": "Configurez la façon dont Remote365 se connecte, réveille les appareils et optimise le routage des sessions.",
        "es": "Configura cómo Remote365 se conecta, activa dispositivos y optimiza el enrutamiento de sesiones.",
        "ar-SA": "اضبط طريقة اتصال Remote365 وإيقاظه للأجهزة وتحسينه لتوجيه الجلسات."
    },
    "Proxy": {
        "en": "Proxy",
        "de": "Proxy",
        "fr": "Proxy",
        "es": "Proxy",
        "ar-SA": "الوكيل (Proxy)"
    },
    "If needed, you can use the recommended settings or set up a manual proxy.": {
        "en": "If needed, you can use the recommended settings or set up a manual proxy.",
        "de": "Bei Bedarf können Sie die empfohlenen Einstellungen verwenden oder einen Proxy manuell einrichten.",
        "fr": "Si nécessaire, vous pouvez utiliser les paramètres recommandés ou configurer un proxy manuel.",
        "es": "Si es necesario, puedes usar la configuración recomendada o configurar un proxy manual.",
        "ar-SA": "يمكنك عند الحاجة استخدام الإعدادات الموصى بها أو إعداد وكيل يدويًا."
    },
    "Performance": {
        "en": "Performance",
        "de": "Leistung",
        "fr": "Performances",
        "es": "Rendimiento",
        "ar-SA": "الأداء"
    },
    "Use the recommended settings for optimal performance on your remote control sessions.": {
        "en": "Use the recommended settings for optimal performance on your remote control sessions.",
        "de": "Verwenden Sie die empfohlenen Einstellungen für optimale Leistung bei Fernsteuerungssitzungen.",
        "fr": "Utilisez les paramètres recommandés pour des performances optimales lors de vos sessions de contrôle à distance.",
        "es": "Usa la configuración recomendada para obtener un rendimiento óptimo en tus sesiones de control remoto.",
        "ar-SA": "استخدم الإعدادات الموصى بها للحصول على أفضل أداء في جلسات التحكم عن بُعد."
    },
    "Reset To Defaults": {
        "en": "Reset To Defaults",
        "de": "Auf Standard zurücksetzen",
        "fr": "Rétablir les valeurs par défaut",
        "es": "Restablecer valores predeterminados",
        "ar-SA": "إعادة التعيين إلى الافتراضي"
    },
    "Fine tune desktop behavior, diagnostics, and maintenance options for this device.": {
        "en": "Fine tune desktop behavior, diagnostics, and maintenance options for this device.",
        "de": "Desktop-Verhalten, Diagnose- und Wartungsoptionen für dieses Gerät feinabstimmen.",
        "fr": "Ajustez le comportement du bureau, les diagnostics et les options de maintenance de cet appareil.",
        "es": "Ajusta el comportamiento del escritorio, los diagnósticos y las opciones de mantenimiento de este dispositivo.",
        "ar-SA": "اضبط سلوك سطح المكتب وخيارات التشخيص والصيانة لهذا الجهاز بدقة."
    },
    "System Behavior": {
        "en": "System Behavior",
        "de": "Systemverhalten",
        "fr": "Comportement du système",
        "es": "Comportamiento del sistema",
        "ar-SA": "سلوك النظام"
    },
    "Show File Logs": {
        "en": "Show File Logs",
        "de": "Dateiprotokolle anzeigen",
        "fr": "Afficher les journaux",
        "es": "Mostrar registros de archivos",
        "ar-SA": "عرض سجلات الملفات"
    },
    "Open Remote365 Log Folder": {
        "en": "Open Remote365 Log Folder",
        "de": "Remote365-Protokollordner öffnen",
        "fr": "Ouvrir le dossier des journaux Remote365",
        "es": "Abrir carpeta de registros de Remote365",
        "ar-SA": "فتح مجلد سجلات Remote365"
    },
    "Export Diagnostic Bundle": {
        "en": "Export Diagnostic Bundle",
        "de": "Diagnosepaket exportieren",
        "fr": "Exporter le paquet de diagnostic",
        "es": "Exportar paquete de diagnóstico",
        "ar-SA": "تصدير حزمة التشخيص"
    },
    "Open": {
        "en": "Open",
        "de": "Öffnen",
        "fr": "Ouvrir",
        "es": "Abrir",
        "ar-SA": "فتح"
    },
    "Restore Advanced Defaults": {
        "en": "Restore Advanced Defaults",
        "de": "Erweiterte Standardeinstellungen wiederherstellen",
        "fr": "Restaurer les paramètres avancés par défaut",
        "es": "Restaurar valores avanzados predeterminados",
        "ar-SA": "استعادة الإعدادات المتقدمة الافتراضية"
    },
    "Enter your current password and choose a new one.": {
        "en": "Enter your current password and choose a new one.",
        "de": "Geben Sie Ihr aktuelles Passwort ein und wählen Sie ein neues.",
        "fr": "Saisissez votre mot de passe actuel et choisissez-en un nouveau.",
        "es": "Introduce tu contraseña actual y elige una nueva.",
        "ar-SA": "أدخل كلمة مرورك الحالية واختر كلمة مرور جديدة."
    },
    "Current Password": {
        "en": "Current Password",
        "de": "Aktuelles Passwort",
        "fr": "Mot de passe actuel",
        "es": "Contraseña actual",
        "ar-SA": "كلمة المرور الحالية"
    },
    "Confirm New Password": {
        "en": "Confirm New Password",
        "de": "Neues Passwort bestätigen",
        "fr": "Confirmer le nouveau mot de passe",
        "es": "Confirmar nueva contraseña",
        "ar-SA": "تأكيد كلمة المرور الجديدة"
    },
    "Password updated.": {
        "en": "Password updated.",
        "de": "Passwort aktualisiert.",
        "fr": "Mot de passe mis à jour.",
        "es": "Contraseña actualizada.",
        "ar-SA": "تم تحديث كلمة المرور."
    },
    "Add": {
        "en": "Add",
        "de": "Hinzufügen",
        "fr": "Ajouter",
        "es": "Añadir",
        "ar-SA": "إضافة"
    },
    "Uninstall": {
        "en": "Uninstall",
        "de": "Deinstallieren",
        "fr": "Désinstaller",
        "es": "Desinstalar",
        "ar-SA": "إلغاء التثبيت"
    },
    "This action is permanent and cannot be undone.": {
        "en": "This action is permanent and cannot be undone.",
        "de": "Diese Aktion ist dauerhaft und kann nicht rückgängig gemacht werden.",
        "fr": "Cette action est définitive et irréversible.",
        "es": "Esta acción es permanente y no se puede deshacer.",
        "ar-SA": "هذا الإجراء دائم ولا يمكن التراجع عنه."
    },
    "Type": {
        "en": "Type",
        "de": "Typ",
        "fr": "Type",
        "es": "Tipo",
        "ar-SA": "النوع"
    },
    "Weak": {
        "en": "Weak",
        "de": "Schwach",
        "fr": "Faible",
        "es": "Débil",
        "ar-SA": "ضعيفة"
    },
    "Good": {
        "en": "Good",
        "de": "Gut",
        "fr": "Bon",
        "es": "Buena",
        "ar-SA": "جيدة"
    },
    "English": {
        "en": "English",
        "de": "Englisch",
        "fr": "Anglais",
        "es": "Inglés",
        "ar-SA": "الإنجليزية"
    },
    "German": {
        "en": "German",
        "de": "Deutsch",
        "fr": "Allemand",
        "es": "Alemán",
        "ar-SA": "الألمانية"
    },
    "Arabic (Saudi Arabia)": {
        "en": "Arabic (Saudi Arabia)",
        "de": "Arabisch (Saudi-Arabien)",
        "fr": "Arabe (Arabie saoudite)",
        "es": "Árabe (Arabia Saudí)",
        "ar-SA": "العربية (المملكة العربية السعودية)"
    },
    "Spanish": {
        "en": "Spanish",
        "de": "Spanisch",
        "fr": "Espagnol",
        "es": "Español",
        "ar-SA": "الإسبانية"
    },
    "French": {
        "en": "French",
        "de": "Französisch",
        "fr": "Français",
        "es": "Francés",
        "ar-SA": "الفرنسية"
    },
    "(GMT+05:00) Karachi": {
        "en": "(GMT+05:00) Karachi",
        "de": "(GMT+05:00) Karatschi",
        "fr": "(GMT+05:00) Karachi",
        "es": "(GMT+05:00) Karachi",
        "ar-SA": "(GMT+05:00) كراتشي"
    },
    "(GMT+04:00) Dubai": {
        "en": "(GMT+04:00) Dubai",
        "de": "(GMT+04:00) Dubai",
        "fr": "(GMT+04:00) Dubaï",
        "es": "(GMT+04:00) Dubái",
        "ar-SA": "(GMT+04:00) دبي"
    },
    "(GMT+00:00) London": {
        "en": "(GMT+00:00) London",
        "de": "(GMT+00:00) London",
        "fr": "(GMT+00:00) Londres",
        "es": "(GMT+00:00) Londres",
        "ar-SA": "(GMT+00:00) لندن"
    },
    "(GMT+01:00) Berlin": {
        "en": "(GMT+01:00) Berlin",
        "de": "(GMT+01:00) Berlin",
        "fr": "(GMT+01:00) Berlin",
        "es": "(GMT+01:00) Berlín",
        "ar-SA": "(GMT+01:00) برلين"
    },
    "(GMT-05:00) New York": {
        "en": "(GMT-05:00) New York",
        "de": "(GMT-05:00) New York",
        "fr": "(GMT-05:00) New York",
        "es": "(GMT-05:00) Nueva York",
        "ar-SA": "(GMT-05:00) نيويورك"
    },
    "(GMT-08:00) Los Angeles": {
        "en": "(GMT-08:00) Los Angeles",
        "de": "(GMT-08:00) Los Angeles",
        "fr": "(GMT-08:00) Los Angeles",
        "es": "(GMT-08:00) Los Ángeles",
        "ar-SA": "(GMT-08:00) لوس أنجلوس"
    },
    "(GMT+09:00) Tokyo": {
        "en": "(GMT+09:00) Tokyo",
        "de": "(GMT+09:00) Tokio",
        "fr": "(GMT+09:00) Tokyo",
        "es": "(GMT+09:00) Tokio",
        "ar-SA": "(GMT+09:00) طوكيو"
    },
    "(GMT+11:00) Sydney": {
        "en": "(GMT+11:00) Sydney",
        "de": "(GMT+11:00) Sydney",
        "fr": "(GMT+11:00) Sydney",
        "es": "(GMT+11:00) Sídney",
        "ar-SA": "(GMT+11:00) سيدني"
    },
    "Preferences": {
        "en": "Preferences",
        "de": "Einstellungen",
        "fr": "Préférences",
        "es": "Preferencias",
        "ar-SA": "التفضيلات"
    },
    "Light Mode": {
        "en": "Light Mode",
        "de": "Heller Modus",
        "fr": "Mode clair",
        "es": "Modo claro",
        "ar-SA": "الوضع الفاتح"
    },
    "Soundcard-Microphone": {
        "en": "Soundcard-Microphone",
        "de": "Soundkarte-Mikrofon",
        "fr": "Carte son - Microphone",
        "es": "Tarjeta de sonido - Micrófono",
        "ar-SA": "بطاقة الصوت - الميكروفون"
    },
    "Soundcard-Speaker": {
        "en": "Soundcard-Speaker",
        "de": "Soundkarte-Lautsprecher",
        "fr": "Carte son - Haut-parleur",
        "es": "Tarjeta de sonido - Altavoz",
        "ar-SA": "بطاقة الصوت - السماعة"
    },
    "Refresh Sessions": {
        "en": "Refresh Sessions",
        "de": "Sitzungen aktualisieren",
        "fr": "Actualiser les sessions",
        "es": "Actualizar sesiones",
        "ar-SA": "تحديث الجلسات"
    },
    "Tag Name": {
        "en": "Tag Name",
        "de": "Tag-Name",
        "fr": "Nom de l'étiquette",
        "es": "Nombre de la etiqueta",
        "ar-SA": "اسم الوسم"
    },
    "Sales": {
        "en": "Sales",
        "de": "Vertrieb",
        "fr": "Ventes",
        "es": "Ventas",
        "ar-SA": "المبيعات"
    },
    "Engineering": {
        "en": "Engineering",
        "de": "Entwicklung",
        "fr": "Ingénierie",
        "es": "Ingeniería",
        "ar-SA": "الهندسة"
    },
    "IT": {
        "en": "IT",
        "de": "IT",
        "fr": "Informatique",
        "es": "TI",
        "ar-SA": "تقنية المعلومات"
    },
    "Allow Incoming Connections": {
        "en": "Allow Incoming Connections",
        "de": "Eingehende Verbindungen zulassen",
        "fr": "Autoriser les connexions entrantes",
        "es": "Permitir conexiones entrantes",
        "ar-SA": "السماح بالاتصالات الواردة"
    },
    "Unattended Access": {
        "en": "Unattended Access",
        "de": "Unbeaufsichtigter Zugriff",
        "fr": "Accès sans surveillance",
        "es": "Acceso desatendido",
        "ar-SA": "الوصول غير المراقب"
    },
    "Allow Control Without Asking": {
        "en": "Allow Control Without Asking",
        "de": "Steuerung ohne Nachfrage zulassen",
        "fr": "Autoriser le contrôle sans demander",
        "es": "Permitir control sin preguntar",
        "ar-SA": "السماح بالتحكم دون سؤال"
    },
    "15 Minutes": {
        "en": "15 Minutes",
        "de": "15 Minuten",
        "fr": "15 minutes",
        "es": "15 minutos",
        "ar-SA": "15 دقيقة"
    },
    "1 Hour": {
        "en": "1 Hour",
        "de": "1 Stunde",
        "fr": "1 heure",
        "es": "1 hora",
        "ar-SA": "ساعة واحدة"
    },
    "4 Hours": {
        "en": "4 Hours",
        "de": "4 Stunden",
        "fr": "4 heures",
        "es": "4 horas",
        "ar-SA": "4 ساعات"
    },
    "24 Hours": {
        "en": "24 Hours",
        "de": "24 Stunden",
        "fr": "24 heures",
        "es": "24 horas",
        "ar-SA": "24 ساعة"
    },
    "Outgoing Only": {
        "en": "Outgoing Only",
        "de": "Nur ausgehend",
        "fr": "Sortant uniquement",
        "es": "Solo salientes",
        "ar-SA": "الصادرة فقط"
    },
    "Incoming Only": {
        "en": "Incoming Only",
        "de": "Nur eingehend",
        "fr": "Entrant uniquement",
        "es": "Solo entrantes",
        "ar-SA": "الواردة فقط"
    },
    "Both": {
        "en": "Both",
        "de": "Beide",
        "fr": "Les deux",
        "es": "Ambas",
        "ar-SA": "كلاهما"
    },
    "Off": {
        "en": "Off",
        "de": "Aus",
        "fr": "Désactivé",
        "es": "Desactivado",
        "ar-SA": "إيقاف"
    },
    "Dot": {
        "en": "Dot",
        "de": "Punkt",
        "fr": "Point",
        "es": "Punto",
        "ar-SA": "نقطة"
    },
    "Hidden": {
        "en": "Hidden",
        "de": "Ausgeblendet",
        "fr": "Masqué",
        "es": "Oculto",
        "ar-SA": "مخفي"
    },
    "Optimize Speed": {
        "en": "Optimize Speed",
        "de": "Geschwindigkeit optimieren",
        "fr": "Optimiser la vitesse",
        "es": "Optimizar velocidad",
        "ar-SA": "تحسين السرعة"
    },
    "Optimize Quality": {
        "en": "Optimize Quality",
        "de": "Qualität optimieren",
        "fr": "Optimiser la qualité",
        "es": "Optimizar calidad",
        "ar-SA": "تحسين الجودة"
    },
    "View Only": {
        "en": "View Only",
        "de": "Nur ansehen",
        "fr": "Lecture seule",
        "es": "Solo ver",
        "ar-SA": "العرض فقط"
    },
    "Ask Me First": {
        "en": "Ask Me First",
        "de": "Erst fragen",
        "fr": "Me demander d'abord",
        "es": "Preguntarme primero",
        "ar-SA": "اسألني أولًا"
    },
    "Allow Control": {
        "en": "Allow Control",
        "de": "Steuerung zulassen",
        "fr": "Autoriser le contrôle",
        "es": "Permitir control",
        "ar-SA": "السماح بالتحكم"
    },
    "Never": {
        "en": "Never",
        "de": "Nie",
        "fr": "Jamais",
        "es": "Nunca",
        "ar-SA": "أبدًا"
    },
    "After 10 Minutes": {
        "en": "After 10 Minutes",
        "de": "Nach 10 Minuten",
        "fr": "Après 10 minutes",
        "es": "Después de 10 minutos",
        "ar-SA": "بعد 10 دقائق"
    },
    "After 30 Minutes": {
        "en": "After 30 Minutes",
        "de": "Nach 30 Minuten",
        "fr": "Après 30 minutes",
        "es": "Después de 30 minutos",
        "ar-SA": "بعد 30 دقيقة"
    },
    "After 1 Hour": {
        "en": "After 1 Hour",
        "de": "Nach 1 Stunde",
        "fr": "Après 1 heure",
        "es": "Después de 1 hora",
        "ar-SA": "بعد ساعة واحدة"
    },
    "Recommended": {
        "en": "Recommended",
        "de": "Empfohlen",
        "fr": "Recommandé",
        "es": "Recomendado",
        "ar-SA": "موصى به"
    },
    "System Proxy": {
        "en": "System Proxy",
        "de": "System-Proxy",
        "fr": "Proxy système",
        "es": "Proxy del sistema",
        "ar-SA": "وكيل النظام"
    },
    "Manual Proxy": {
        "en": "Manual Proxy",
        "de": "Manueller Proxy",
        "fr": "Proxy manuel",
        "es": "Proxy manual",
        "ar-SA": "وكيل يدوي"
    },
    "No Proxy": {
        "en": "No Proxy",
        "de": "Kein Proxy",
        "fr": "Aucun proxy",
        "es": "Sin proxy",
        "ar-SA": "بدون وكيل"
    },
    "Low Bandwidth": {
        "en": "Low Bandwidth",
        "de": "Geringe Bandbreite",
        "fr": "Faible bande passante",
        "es": "Ancho de banda bajo",
        "ar-SA": "نطاق ترددي منخفض"
    },
    "Start Remote365 minimized to the system tray (needs restart).": {
        "en": "Start Remote365 minimized to the system tray (needs restart).",
        "de": "Remote365 minimiert im Infobereich starten (Neustart erforderlich).",
        "fr": "Démarrer Remote365 réduit dans la zone de notification (redémarrage requis).",
        "es": "Iniciar Remote365 minimizado en la bandeja del sistema (requiere reiniciar).",
        "ar-SA": "تشغيل Remote365 مصغّرًا في علبة النظام (يتطلب إعادة التشغيل)."
    },
    "Use hardware acceleration — turn off if you see black screens or rendering glitches (needs restart).": {
        "en": "Use hardware acceleration — turn off if you see black screens or rendering glitches (needs restart).",
        "de": "Hardwarebeschleunigung verwenden — deaktivieren, wenn schwarze Bildschirme oder Darstellungsfehler auftreten (Neustart erforderlich).",
        "fr": "Utiliser l'accélération matérielle — désactivez-la en cas d'écrans noirs ou de problèmes d'affichage (redémarrage requis).",
        "es": "Usar aceleración por hardware — desactívala si ves pantallas negras o fallos de renderizado (requiere reiniciar).",
        "ar-SA": "استخدام تسريع الأجهزة — أوقفه إذا ظهرت شاشات سوداء أو أخطاء في العرض (يتطلب إعادة التشغيل)."
    },
    "Start Remote365 when Windows starts.": {
        "en": "Start Remote365 when Windows starts.",
        "de": "Remote365 beim Windows-Start starten.",
        "fr": "Démarrer Remote365 au démarrage de Windows.",
        "es": "Iniciar Remote365 al iniciar Windows.",
        "ar-SA": "تشغيل Remote365 عند بدء تشغيل Windows."
    },
    "Keep Remote365 running in the tray after closing the window.": {
        "en": "Keep Remote365 running in the tray after closing the window.",
        "de": "Remote365 nach dem Schließen des Fensters im Infobereich weiter ausführen.",
        "fr": "Laisser Remote365 actif dans la zone de notification après la fermeture de la fenêtre.",
        "es": "Mantener Remote365 en la bandeja tras cerrar la ventana.",
        "ar-SA": "إبقاء Remote365 قيد التشغيل في علبة النظام بعد إغلاق النافذة."
    },
    "Allow direct peer connections when available (turn off to force all traffic through the relay).": {
        "en": "Allow direct peer connections when available (turn off to force all traffic through the relay).",
        "de": "Direkte Peer-Verbindungen zulassen, wenn verfügbar (deaktivieren, um den gesamten Datenverkehr über das Relay zu leiten).",
        "fr": "Autoriser les connexions directes entre pairs si disponibles (désactivez pour forcer tout le trafic via le relais).",
        "es": "Permitir conexiones directas entre pares cuando estén disponibles (desactívalo para forzar todo el tráfico por el relé).",
        "ar-SA": "السماح بالاتصالات المباشرة بين الأجهزة عند توفرها (أوقفه لتمرير كل حركة البيانات عبر المُرحِّل)."
    },
    "Collect connection diagnostics for troubleshooting.": {
        "en": "Collect connection diagnostics for troubleshooting.",
        "de": "Verbindungsdiagnosen zur Fehlerbehebung erfassen.",
        "fr": "Collecter des diagnostics de connexion pour le dépannage.",
        "es": "Recopilar diagnósticos de conexión para solucionar problemas.",
        "ar-SA": "جمع بيانات تشخيص الاتصال لاستكشاف الأخطاء وإصلاحها."
    },
    "Keep detailed application logs.": {
        "en": "Keep detailed application logs.",
        "de": "Detaillierte Anwendungsprotokolle führen.",
        "fr": "Conserver des journaux d'application détaillés.",
        "es": "Guardar registros detallados de la aplicación.",
        "ar-SA": "الاحتفاظ بسجلات تفصيلية للتطبيق."
    },
    "Include crash reports.": {
        "en": "Include crash reports.",
        "de": "Absturzberichte einschließen.",
        "fr": "Inclure les rapports de plantage.",
        "es": "Incluir informes de errores.",
        "ar-SA": "تضمين تقارير الأعطال."
    },
    "Include update logs.": {
        "en": "Include update logs.",
        "de": "Update-Protokolle einschließen.",
        "fr": "Inclure les journaux de mise à jour.",
        "es": "Incluir registros de actualización.",
        "ar-SA": "تضمين سجلات التحديث."
    },
    "Block & Allow List": {
        "en": "Block & Allow List",
        "de": "Sperr- & Zulassungsliste",
        "fr": "Liste de blocage et d'autorisation",
        "es": "Lista de bloqueo y permitidos",
        "ar-SA": "قائمة الحظر والسماح"
    },
    "Authentication Settings": {
        "en": "Authentication Settings",
        "de": "Authentifizierungseinstellungen",
        "fr": "Paramètres d'authentification",
        "es": "Configuración de autenticación",
        "ar-SA": "إعدادات المصادقة"
    },
    "Remote365 ID Or Email": {
        "en": "Remote365 ID Or Email",
        "de": "Remote365-ID oder E-Mail",
        "fr": "ID Remote365 ou e-mail",
        "es": "ID de Remote365 o correo electrónico",
        "ar-SA": "ID أو البريد الإلكتروني في Remote365"
    },
    "Require Password Every Connection": {
        "en": "Require Password Every Connection",
        "de": "Passwort bei jeder Verbindung verlangen",
        "fr": "Exiger le mot de passe à chaque connexion",
        "es": "Pedir contraseña en cada conexión",
        "ar-SA": "طلب كلمة المرور عند كل اتصال"
    },
    "Grant Easy Access": {
        "en": "Grant Easy Access",
        "de": "Einfachen Zugriff gewähren",
        "fr": "Accorder l'accès facile",
        "es": "Conceder acceso fácil",
        "ar-SA": "منح الوصول السهل"
    },
    "Confirm Each Incoming Connection": {
        "en": "Confirm Each Incoming Connection",
        "de": "Jede eingehende Verbindung bestätigen",
        "fr": "Confirmer chaque connexion entrante",
        "es": "Confirmar cada conexión entrante",
        "ar-SA": "تأكيد كل اتصال وارد"
    },
    "Lock Screen On Disconnect": {
        "en": "Lock Screen On Disconnect",
        "de": "Bildschirm beim Trennen sperren",
        "fr": "Verrouiller l'écran à la déconnexion",
        "es": "Bloquear pantalla al desconectar",
        "ar-SA": "قفل الشاشة عند قطع الاتصال"
    },
    "Allow Remote Control": {
        "en": "Allow Remote Control",
        "de": "Fernsteuerung zulassen",
        "fr": "Autoriser le contrôle à distance",
        "es": "Permitir control remoto",
        "ar-SA": "السماح بالتحكم عن بُعد"
    },
    "Allow Clipboard Sharing": {
        "en": "Allow Clipboard Sharing",
        "de": "Freigabe der Zwischenablage zulassen",
        "fr": "Autoriser le partage du presse-papiers",
        "es": "Permitir compartir portapapeles",
        "ar-SA": "السماح بمشاركة الحافظة"
    },
    "Allow File Transfer": {
        "en": "Allow File Transfer",
        "de": "Dateiübertragung zulassen",
        "fr": "Autoriser le transfert de fichiers",
        "es": "Permitir transferencia de archivos",
        "ar-SA": "السماح بنقل الملفات"
    },
    "Max Participants": {
        "en": "Max Participants",
        "de": "Max. Teilnehmer",
        "fr": "Participants max.",
        "es": "Máx. participantes",
        "ar-SA": "الحد الأقصى للمشاركين"
    },
    "Type 'Delete' To Confirm": {
        "en": "Type 'Delete' To Confirm",
        "de": "Zum Bestätigen 'Delete' eingeben",
        "fr": "Saisissez 'Delete' pour confirmer",
        "es": "Escribe 'Delete' para confirmar",
        "ar-SA": "اكتب 'Delete' للتأكيد"
    },
    "New passwords do not match.": {
        "en": "New passwords do not match.",
        "de": "Die neuen Passwörter stimmen nicht überein.",
        "fr": "Les nouveaux mots de passe ne correspondent pas.",
        "es": "Las nuevas contraseñas no coinciden.",
        "ar-SA": "كلمتا المرور الجديدتان غير متطابقتين."
    },
    "Choose a stronger password (mix of upper/lowercase, numbers, and symbols).": {
        "en": "Choose a stronger password (mix of upper/lowercase, numbers, and symbols).",
        "de": "Wählen Sie ein stärkeres Passwort (Groß-/Kleinbuchstaben, Zahlen und Symbole kombinieren).",
        "fr": "Choisissez un mot de passe plus fort (majuscules/minuscules, chiffres et symboles).",
        "es": "Elige una contraseña más segura (combina mayúsculas/minúsculas, números y símbolos).",
        "ar-SA": "اختر كلمة مرور أقوى (مزيج من الأحرف الكبيرة/الصغيرة والأرقام والرموز)."
    },
    "Archived Devices": {
        "en": "Archived Devices",
        "de": "Archivierte Geräte",
        "fr": "Appareils archivés",
        "es": "Dispositivos archivados",
        "ar-SA": "الأجهزة المؤرشفة"
    },
    "Check For New Version": {
        "en": "Check For New Version",
        "de": "Nach neuer Version suchen",
        "fr": "Rechercher une nouvelle version",
        "es": "Buscar nueva versión",
        "ar-SA": "البحث عن إصدار جديد"
    },
    "Customer Support Identifier": {
        "en": "Customer Support Identifier",
        "de": "Kundensupport-Kennung",
        "fr": "Identifiant du support client",
        "es": "Identificador de atención al cliente",
        "ar-SA": "معرّف دعم العملاء"
    },
    "Privacy Policy": {
        "en": "Privacy Policy",
        "de": "Datenschutzerklärung",
        "fr": "Politique de confidentialité",
        "es": "Política de privacidad",
        "ar-SA": "سياسة الخصوصية"
    },
    "Copy Right": {
        "en": "Copy Right",
        "de": "Urheberrecht",
        "fr": "Droits d'auteur",
        "es": "Derechos de autor",
        "ar-SA": "حقوق النشر"
    },
    "Open File Logs": {
        "en": "Open File Logs",
        "de": "Dateiprotokolle öffnen",
        "fr": "Ouvrir les journaux",
        "es": "Abrir registros de archivos",
        "ar-SA": "فتح سجلات الملفات"
    },
    "About Remote365": {
        "en": "About Remote365",
        "de": "Über Remote365",
        "fr": "À propos de Remote365",
        "es": "Acerca de Remote365",
        "ar-SA": "حول Remote365"
    },
    "Global Nodes": {
        "en": "Global Nodes",
        "de": "Globale Knoten",
        "fr": "Nœuds mondiaux",
        "es": "Nodos globales",
        "ar-SA": "العُقد العالمية"
    },
    "Personal Details": {
        "en": "Personal Details",
        "de": "Persönliche Daten",
        "fr": "Informations personnelles",
        "es": "Datos personales",
        "ar-SA": "البيانات الشخصية"
    },
    "Member Since": {
        "en": "Member Since",
        "de": "Mitglied seit",
        "fr": "Membre depuis",
        "es": "Miembro desde",
        "ar-SA": "عضو منذ"
    },
    "Password Protection": {
        "en": "Password Protection",
        "de": "Passwortschutz",
        "fr": "Protection par mot de passe",
        "es": "Protección con contraseña",
        "ar-SA": "الحماية بكلمة مرور"
    },
    "New Session Alert": {
        "en": "New Session Alert",
        "de": "Hinweis bei neuer Sitzung",
        "fr": "Alerte de nouvelle session",
        "es": "Alerta de nueva sesión",
        "ar-SA": "تنبيه جلسة جديدة"
    },
    "Notify when a viewer connects to this device": {
        "en": "Notify when a viewer connects to this device",
        "de": "Benachrichtigen, wenn sich ein Betrachter mit diesem Gerät verbindet",
        "fr": "M'avertir lorsqu'un spectateur se connecte à cet appareil",
        "es": "Avisar cuando un espectador se conecte a este dispositivo",
        "ar-SA": "الإعلام عند اتصال مشاهد بهذا الجهاز"
    },
    "Disconnect Alert": {
        "en": "Disconnect Alert",
        "de": "Hinweis bei Verbindungsabbruch",
        "fr": "Alerte de déconnexion",
        "es": "Alerta de desconexión",
        "ar-SA": "تنبيه قطع الاتصال"
    },
    "Notify when a remote session ends unexpectedly": {
        "en": "Notify when a remote session ends unexpectedly",
        "de": "Benachrichtigen, wenn eine Remote-Sitzung unerwartet endet",
        "fr": "M'avertir lorsqu'une session à distance se termine de façon inattendue",
        "es": "Avisar cuando una sesión remota termine inesperadamente",
        "ar-SA": "الإعلام عند انتهاء جلسة عن بُعد بشكل غير متوقع"
    },
    "Sound Effects": {
        "en": "Sound Effects",
        "de": "Soundeffekte",
        "fr": "Effets sonores",
        "es": "Efectos de sonido",
        "ar-SA": "المؤثرات الصوتية"
    },
    "Play Audio Cues For Connection Events": {
        "en": "Play Audio Cues For Connection Events",
        "de": "Tonsignale bei Verbindungsereignissen abspielen",
        "fr": "Émettre des signaux sonores lors des événements de connexion",
        "es": "Reproducir avisos sonoros en eventos de conexión",
        "ar-SA": "تشغيل تنبيهات صوتية لأحداث الاتصال"
    },
    "Two-Factor Authentication": {
        "en": "Two-Factor Authentication",
        "de": "Zwei-Faktor-Authentifizierung",
        "fr": "Authentification à deux facteurs",
        "es": "Autenticación en dos pasos",
        "ar-SA": "المصادقة الثنائية"
    },
    "Enable": {
        "en": "Enable",
        "de": "Aktivieren",
        "fr": "Activer",
        "es": "Activar",
        "ar-SA": "تفعيل"
    },
    "Danger Zone": {
        "en": "Danger Zone",
        "de": "Gefahrenbereich",
        "fr": "Zone de danger",
        "es": "Zona de peligro",
        "ar-SA": "منطقة الخطر"
    },
    "Permanently remove all your nodes and account data.": {
        "en": "Permanently remove all your nodes and account data.",
        "de": "Alle Ihre Knoten und Kontodaten dauerhaft entfernen.",
        "fr": "Supprimer définitivement tous vos nœuds et les données de votre compte.",
        "es": "Elimina de forma permanente todos tus nodos y los datos de tu cuenta.",
        "ar-SA": "إزالة جميع العُقد وبيانات حسابك نهائيًا."
    },
    "Close Account": {
        "en": "Close Account",
        "de": "Konto schließen",
        "fr": "Fermer le compte",
        "es": "Cerrar cuenta",
        "ar-SA": "إغلاق الحساب"
    },
    "This action is permanent and irreversible": {
        "en": "This action is permanent and irreversible",
        "de": "Diese Aktion ist dauerhaft und nicht umkehrbar",
        "fr": "Cette action est définitive et irréversible",
        "es": "Esta acción es permanente e irreversible",
        "ar-SA": "هذا الإجراء دائم ولا رجعة فيه"
    },
    "This will permanently delete your organization, all team members and subordinate accounts, all registered devices, and all session history. You cannot undo this.": {
        "en": "This will permanently delete your organization, all team members and subordinate accounts, all registered devices, and all session history. You cannot undo this.",
        "de": "Dadurch werden Ihre Organisation, alle Teammitglieder und untergeordneten Konten, alle registrierten Geräte und der gesamte Sitzungsverlauf dauerhaft gelöscht. Dies kann nicht rückgängig gemacht werden.",
        "fr": "Cela supprimera définitivement votre organisation, tous les membres de l'équipe et comptes subordonnés, tous les appareils enregistrés et tout l'historique des sessions. Cette action est irréversible.",
        "es": "Esto eliminará de forma permanente tu organización, todos los miembros del equipo y cuentas subordinadas, todos los dispositivos registrados y todo el historial de sesiones. No se puede deshacer.",
        "ar-SA": "سيؤدي هذا إلى حذف مؤسستك وجميع أعضاء الفريق والحسابات التابعة وجميع الأجهزة المسجلة وسجل الجلسات بالكامل نهائيًا. لا يمكن التراجع عن ذلك."
    },
    "Enable Two-Factor Auth": {
        "en": "Enable Two-Factor Auth",
        "de": "Zwei-Faktor-Authentifizierung aktivieren",
        "fr": "Activer l'authentification à deux facteurs",
        "es": "Activar autenticación en dos pasos",
        "ar-SA": "تفعيل المصادقة الثنائية"
    },
    "Scan With An Authenticator App": {
        "en": "Scan With An Authenticator App",
        "de": "Mit einer Authenticator-App scannen",
        "fr": "Scanner avec une application d'authentification",
        "es": "Escanear con una aplicación de autenticación",
        "ar-SA": "امسح باستخدام تطبيق مصادقة"
    },
    "2FA Enabled!": {
        "en": "2FA Enabled!",
        "de": "2FA aktiviert!",
        "fr": "2FA activée !",
        "es": "¡2FA activada!",
        "ar-SA": "تم تفعيل 2FA!"
    },
    "Your account is now protected.": {
        "en": "Your account is now protected.",
        "de": "Ihr Konto ist jetzt geschützt.",
        "fr": "Votre compte est désormais protégé.",
        "es": "Tu cuenta ya está protegida.",
        "ar-SA": "حسابك محمي الآن."
    },
    "Scan with": {
        "en": "Scan with",
        "de": "Scannen mit",
        "fr": "Scanner avec",
        "es": "Escanear con",
        "ar-SA": "امسح باستخدام"
    },
    "This page is the fastest way to give or take remote control — no setup needed.": {
        "en": "This page is the fastest way to give or take remote control — no setup needed.",
        "de": "Diese Seite ist der schnellste Weg, Fernsteuerung zu gewähren oder zu übernehmen — ohne Einrichtung.",
        "fr": "Cette page est le moyen le plus rapide de donner ou prendre le contrôle à distance — sans configuration.",
        "es": "Esta página es la forma más rápida de dar o tomar el control remoto — sin configuración.",
        "ar-SA": "هذه الصفحة هي أسرع طريقة لمنح التحكم عن بُعد أو تولّيه — دون أي إعداد."
    },
    "Share Your ID & Password": {
        "en": "Share Your ID & Password",
        "de": "ID & Passwort teilen",
        "fr": "Partagez votre ID et mot de passe",
        "es": "Comparte tu ID y contraseña",
        "ar-SA": "شارك ID وكلمة المرور"
    },
    "To let someone control THIS computer, share the ID and password shown here. They expire never — the password only changes when you change it.": {
        "en": "To let someone control THIS computer, share the ID and password shown here. They expire never — the password only changes when you change it.",
        "de": "Damit jemand DIESEN Computer steuern kann, teilen Sie die hier angezeigte ID und das Passwort. Sie laufen nie ab — das Passwort ändert sich nur, wenn Sie es ändern.",
        "fr": "Pour permettre à quelqu'un de contrôler CET ordinateur, partagez l'ID et le mot de passe affichés ici. Ils n'expirent jamais — le mot de passe ne change que si vous le modifiez.",
        "es": "Para que alguien controle ESTE equipo, comparte el ID y la contraseña que se muestran aquí. Nunca caducan — la contraseña solo cambia cuando tú la cambias.",
        "ar-SA": "للسماح لشخص بالتحكم في هذا الكمبيوتر، شارك ID وكلمة المرور الظاهرين هنا. لا تنتهي صلاحيتهما أبدًا — تتغير كلمة المرور فقط عندما تغيّرها أنت."
    },
    "Control A Remote Device": {
        "en": "Control A Remote Device",
        "de": "Ein Remote-Gerät steuern",
        "fr": "Contrôler un appareil distant",
        "es": "Controlar un dispositivo remoto",
        "ar-SA": "التحكم في جهاز بعيد"
    },
    "Choose A Theme": {
        "en": "Choose A Theme",
        "de": "Design auswählen",
        "fr": "Choisir un thème",
        "es": "Elegir un tema",
        "ar-SA": "اختر مظهرًا"
    },
    "Light": {
        "en": "Light",
        "de": "Hell",
        "fr": "Clair",
        "es": "Claro",
        "ar-SA": "فاتح"
    },
    "Dark": {
        "en": "Dark",
        "de": "Dunkel",
        "fr": "Sombre",
        "es": "Oscuro",
        "ar-SA": "داكن"
    },
    "Receive Insider Builds": {
        "en": "Receive Insider Builds",
        "de": "Insider-Builds erhalten",
        "fr": "Recevoir les versions Insider",
        "es": "Recibir versiones Insider",
        "ar-SA": "تلقي إصدارات Insider"
    },
    "Network Settings": {
        "en": "Network Settings",
        "de": "Netzwerkeinstellungen",
        "fr": "Paramètres réseau",
        "es": "Configuración de red",
        "ar-SA": "إعدادات الشبكة"
    },
    "Proxy Settings": {
        "en": "Proxy Settings",
        "de": "Proxy-Einstellungen",
        "fr": "Paramètres du proxy",
        "es": "Configuración del proxy",
        "ar-SA": "إعدادات الوكيل"
    },
    "Configure...": {
        "en": "Configure...",
        "de": "Konfigurieren...",
        "fr": "Configurer...",
        "es": "Configurar...",
        "ar-SA": "تكوين..."
    },
    "Incoming LAN Connections": {
        "en": "Incoming LAN Connections",
        "de": "Eingehende LAN-Verbindungen",
        "fr": "Connexions LAN entrantes",
        "es": "Conexiones LAN entrantes",
        "ar-SA": "اتصالات LAN الواردة"
    },
    "Deactivated": {
        "en": "Deactivated",
        "de": "Deaktiviert",
        "fr": "Désactivé",
        "es": "Desactivado",
        "ar-SA": "معطّل"
    },
    "Account Assignment": {
        "en": "Account Assignment",
        "de": "Kontozuweisung",
        "fr": "Attribution au compte",
        "es": "Asignación de cuenta",
        "ar-SA": "إسناد الحساب"
    },
    "By assigning this device to a Remote365 account it can be remotely managed and monitored.": {
        "en": "By assigning this device to a Remote365 account it can be remotely managed and monitored.",
        "de": "Wenn Sie dieses Gerät einem Remote365-Konto zuweisen, kann es aus der Ferne verwaltet und überwacht werden.",
        "fr": "En attribuant cet appareil à un compte Remote365, il peut être géré et surveillé à distance.",
        "es": "Al asignar este dispositivo a una cuenta de Remote365, se puede administrar y supervisar de forma remota.",
        "ar-SA": "بإسناد هذا الجهاز إلى حساب Remote365 يمكن إدارته ومراقبته عن بُعد."
    },
    "Assign To Account...": {
        "en": "Assign To Account...",
        "de": "Konto zuweisen...",
        "fr": "Attribuer à un compte...",
        "es": "Asignar a cuenta...",
        "ar-SA": "إسناد إلى حساب..."
    },
    "Options For Your Remote365 Account": {
        "en": "Options For Your Remote365 Account",
        "de": "Optionen für Ihr Remote365-Konto",
        "fr": "Options de votre compte Remote365",
        "es": "Opciones de tu cuenta de Remote365",
        "ar-SA": "خيارات حساب Remote365 الخاص بك"
    },
    "Account Settings": {
        "en": "Account Settings",
        "de": "Kontoeinstellungen",
        "fr": "Paramètres du compte",
        "es": "Configuración de la cuenta",
        "ar-SA": "إعدادات الحساب"
    },
    "Manage Two Factor Authentication": {
        "en": "Manage Two Factor Authentication",
        "de": "Zwei-Faktor-Authentifizierung verwalten",
        "fr": "Gérer l'authentification à deux facteurs",
        "es": "Administrar autenticación en dos pasos",
        "ar-SA": "إدارة المصادقة الثنائية"
    },
    "Activated License": {
        "en": "Activated License",
        "de": "Aktivierte Lizenz",
        "fr": "Licence activée",
        "es": "Licencia activada",
        "ar-SA": "الترخيص المفعّل"
    },
    "Only partners in my list may see my online status and send messages to me": {
        "en": "Only partners in my list may see my online status and send messages to me",
        "de": "Nur Partner in meiner Liste dürfen meinen Online-Status sehen und mir Nachrichten senden",
        "fr": "Seuls les partenaires de ma liste peuvent voir mon statut en ligne et m'envoyer des messages",
        "es": "Solo los contactos de mi lista pueden ver mi estado en línea y enviarme mensajes",
        "ar-SA": "يمكن فقط للشركاء في قائمتي رؤية حالة اتصالي وإرسال رسائل إليّ"
    },
    "Options For Access To This Computer": {
        "en": "Options For Access To This Computer",
        "de": "Optionen für den Zugriff auf diesen Computer",
        "fr": "Options d'accès à cet ordinateur",
        "es": "Opciones de acceso a este equipo",
        "ar-SA": "خيارات الوصول إلى هذا الكمبيوتر"
    },
    "Easy Access is the recommended way to access your device remotely. To set a personal password instead, go to the Advanced tab.": {
        "en": "Easy Access is the recommended way to access your device remotely. To set a personal password instead, go to the Advanced tab.",
        "de": "Einfacher Zugriff ist die empfohlene Methode für den Fernzugriff auf Ihr Gerät. Um stattdessen ein persönliches Passwort festzulegen, wechseln Sie zur Registerkarte „Erweitert“.",
        "fr": "L'accès facile est la méthode recommandée pour accéder à distance à votre appareil. Pour définir plutôt un mot de passe personnel, accédez à l'onglet Avancé.",
        "es": "El acceso fácil es la forma recomendada de acceder a tu dispositivo de forma remota. Para establecer una contraseña personal, ve a la pestaña Avanzado.",
        "ar-SA": "الوصول السهل هو الطريقة الموصى بها للوصول إلى جهازك عن بُعد. لتعيين كلمة مرور شخصية بدلًا من ذلك، انتقل إلى علامة التبويب \"متقدم\"."
    },
    "Random Password (For Spontaneous Access)": {
        "en": "Random Password (For Spontaneous Access)",
        "de": "Zufälliges Passwort (für spontanen Zugriff)",
        "fr": "Mot de passe aléatoire (pour un accès ponctuel)",
        "es": "Contraseña aleatoria (para acceso puntual)",
        "ar-SA": "كلمة مرور عشوائية (للوصول الفوري)"
    },
    "Password Strength": {
        "en": "Password Strength",
        "de": "Passwortstärke",
        "fr": "Robustesse du mot de passe",
        "es": "Seguridad de la contraseña",
        "ar-SA": "قوة كلمة المرور"
    },
    "8 Characters": {
        "en": "8 Characters",
        "de": "8 Zeichen",
        "fr": "8 caractères",
        "es": "8 caracteres",
        "ar-SA": "8 أحرف"
    },
    "10 Characters": {
        "en": "10 Characters",
        "de": "10 Zeichen",
        "fr": "10 caractères",
        "es": "10 caracteres",
        "ar-SA": "10 أحرف"
    },
    "Standard (6 Characters)": {
        "en": "Standard (6 Characters)",
        "de": "Standard (6 Zeichen)",
        "fr": "Standard (6 caractères)",
        "es": "Estándar (6 caracteres)",
        "ar-SA": "قياسي (6 أحرف)"
    },
    "Secure (10 Characters)": {
        "en": "Secure (10 Characters)",
        "de": "Sicher (10 Zeichen)",
        "fr": "Sécurisé (10 caractères)",
        "es": "Seguro (10 caracteres)",
        "ar-SA": "آمن (10 أحرف)"
    },
    "Enable One-Time Access Feature": {
        "en": "Enable One-Time Access Feature",
        "de": "Einmalzugriff aktivieren",
        "fr": "Activer l'accès unique",
        "es": "Activar acceso de un solo uso",
        "ar-SA": "تفعيل ميزة الوصول لمرة واحدة"
    },
    "Rules For Connections To This Computer": {
        "en": "Rules For Connections To This Computer",
        "de": "Regeln für Verbindungen zu diesem Computer",
        "fr": "Règles de connexion à cet ordinateur",
        "es": "Reglas de conexión a este equipo",
        "ar-SA": "قواعد الاتصال بهذا الكمبيوتر"
    },
    "Windows Logon": {
        "en": "Windows Logon",
        "de": "Windows-Anmeldung",
        "fr": "Ouverture de session Windows",
        "es": "Inicio de sesión de Windows",
        "ar-SA": "تسجيل الدخول إلى Windows"
    },
    "Not Allowed": {
        "en": "Not Allowed",
        "de": "Nicht zulässig",
        "fr": "Non autorisé",
        "es": "No permitido",
        "ar-SA": "غير مسموح"
    },
    "Allowed": {
        "en": "Allowed",
        "de": "Zulässig",
        "fr": "Autorisé",
        "es": "Permitido",
        "ar-SA": "مسموح"
    },
    "Block And Allowlist": {
        "en": "Block And Allowlist",
        "de": "Sperr- und Zulassungsliste",
        "fr": "Liste de blocage et d'autorisation",
        "es": "Lista de bloqueo y permitidos",
        "ar-SA": "قائمة الحظر والسماح"
    },
    "Manage Approval Devices": {
        "en": "Manage Approval Devices",
        "de": "Genehmigungsgeräte verwalten",
        "fr": "Gérer les appareils d'approbation",
        "es": "Administrar dispositivos de aprobación",
        "ar-SA": "إدارة أجهزة الموافقة"
    },
    "Options for remote control of other computers": {
        "en": "Options for remote control of other computers",
        "de": "Optionen für die Fernsteuerung anderer Computer",
        "fr": "Options de contrôle à distance d'autres ordinateurs",
        "es": "Opciones para el control remoto de otros equipos",
        "ar-SA": "خيارات التحكم عن بُعد في أجهزة الكمبيوتر الأخرى"
    },
    "Display": {
        "en": "Display",
        "de": "Anzeige",
        "fr": "Affichage",
        "es": "Pantalla",
        "ar-SA": "العرض"
    },
    "Quality": {
        "en": "Quality",
        "de": "Qualität",
        "fr": "Qualité",
        "es": "Calidad",
        "ar-SA": "الجودة"
    },
    "Automatic Selection": {
        "en": "Automatic Selection",
        "de": "Automatische Auswahl",
        "fr": "Sélection automatique",
        "es": "Selección automática",
        "ar-SA": "تحديد تلقائي"
    },
    "Remove Remote Wallpaper": {
        "en": "Remove Remote Wallpaper",
        "de": "Remote-Hintergrundbild entfernen",
        "fr": "Supprimer le fond d'écran distant",
        "es": "Quitar el fondo de pantalla remoto",
        "ar-SA": "إزالة خلفية الشاشة البعيدة"
    },
    "Show Remote Cursor": {
        "en": "Show Remote Cursor",
        "de": "Remote-Cursor anzeigen",
        "fr": "Afficher le curseur distant",
        "es": "Mostrar el cursor remoto",
        "ar-SA": "إظهار المؤشر البعيد"
    },
    "Remote Control Defaults": {
        "en": "Remote Control Defaults",
        "de": "Standardeinstellungen für Fernsteuerung",
        "fr": "Paramètres par défaut du contrôle à distance",
        "es": "Valores predeterminados del control remoto",
        "ar-SA": "الإعدادات الافتراضية للتحكم عن بُعد"
    },
    "Play Computer Sounds And Music": {
        "en": "Play Computer Sounds And Music",
        "de": "Computersounds und Musik wiedergeben",
        "fr": "Lire les sons et la musique de l'ordinateur",
        "es": "Reproducir sonidos y música del equipo",
        "ar-SA": "تشغيل أصوات الكمبيوتر والموسيقى"
    },
    "Record Partner's Video And VOIP": {
        "en": "Record Partner's Video And VOIP",
        "de": "Video und VoIP des Partners aufzeichnen",
        "fr": "Enregistrer la vidéo et la VoIP du partenaire",
        "es": "Grabar el vídeo y VoIP del interlocutor",
        "ar-SA": "تسجيل فيديو الشريك ومكالمات VoIP"
    },
    "Options For Audio Conferencing": {
        "en": "Options For Audio Conferencing",
        "de": "Optionen für Audiokonferenzen",
        "fr": "Options de conférence audio",
        "es": "Opciones de audioconferencia",
        "ar-SA": "خيارات المؤتمرات الصوتية"
    },
    "Voice Transmission": {
        "en": "Voice Transmission",
        "de": "Sprachübertragung",
        "fr": "Transmission vocale",
        "es": "Transmisión de voz",
        "ar-SA": "نقل الصوت"
    },
    "Default Communication Device": {
        "en": "Default Communication Device",
        "de": "Standardkommunikationsgerät",
        "fr": "Périphérique de communication par défaut",
        "es": "Dispositivo de comunicación predeterminado",
        "ar-SA": "جهاز الاتصال الافتراضي"
    },
    "Microphone (Realtek High Definition Audio)": {
        "en": "Microphone (Realtek High Definition Audio)",
        "de": "Mikrofon (Realtek High Definition Audio)",
        "fr": "Microphone (Realtek High Definition Audio)",
        "es": "Micrófono (Realtek High Definition Audio)",
        "ar-SA": "الميكروفون (Realtek High Definition Audio)"
    },
    "Speakers": {
        "en": "Speakers",
        "de": "Lautsprecher",
        "fr": "Haut-parleurs",
        "es": "Altavoces",
        "ar-SA": "مكبرات الصوت"
    },
    "Speakers (Realtek High Definition Audio)": {
        "en": "Speakers (Realtek High Definition Audio)",
        "de": "Lautsprecher (Realtek High Definition Audio)",
        "fr": "Haut-parleurs (Realtek High Definition Audio)",
        "es": "Altavoces (Realtek High Definition Audio)",
        "ar-SA": "مكبرات الصوت (Realtek High Definition Audio)"
    },
    "Volume": {
        "en": "Volume",
        "de": "Lautstärke",
        "fr": "Volume",
        "es": "Volumen",
        "ar-SA": "مستوى الصوت"
    },
    "Options For Video Conferencing": {
        "en": "Options For Video Conferencing",
        "de": "Optionen für Videokonferenzen",
        "fr": "Options de visioconférence",
        "es": "Opciones de videoconferencia",
        "ar-SA": "خيارات مؤتمرات الفيديو"
    },
    "Integrated Webcam": {
        "en": "Integrated Webcam",
        "de": "Integrierte Webcam",
        "fr": "Webcam intégrée",
        "es": "Cámara web integrada",
        "ar-SA": "كاميرا الويب المدمجة"
    },
    "Mirror My Video": {
        "en": "Mirror My Video",
        "de": "Mein Video spiegeln",
        "fr": "Mettre ma vidéo en miroir",
        "es": "Reflejar mi vídeo",
        "ar-SA": "عكس الفيديو الخاص بي"
    },
    "Offline computers & contacts in separate group": {
        "en": "Offline computers & contacts in separate group",
        "de": "Offline-Computer & -Kontakte in separater Gruppe",
        "fr": "Ordinateurs et contacts hors ligne dans un groupe distinct",
        "es": "Equipos y contactos sin conexión en un grupo aparte",
        "ar-SA": "أجهزة الكمبيوتر وجهات الاتصال غير المتصلة في مجموعة منفصلة"
    },
    "Notify Me Of Incoming Messages": {
        "en": "Notify Me Of Incoming Messages",
        "de": "Bei eingehenden Nachrichten benachrichtigen",
        "fr": "M'avertir des messages entrants",
        "es": "Notificarme los mensajes entrantes",
        "ar-SA": "إعلامي بالرسائل الواردة"
    },
    "Notify Me When Partners Sign In": {
        "en": "Notify Me When Partners Sign In",
        "de": "Benachrichtigen, wenn sich Partner anmelden",
        "fr": "M'avertir lorsque des partenaires se connectent",
        "es": "Notificarme cuando los interlocutores inicien sesión",
        "ar-SA": "إعلامي عند تسجيل دخول الشركاء"
    },
    "Notify Me About Service Case Changes": {
        "en": "Notify Me About Service Case Changes",
        "de": "Über Änderungen an Servicefällen benachrichtigen",
        "fr": "M'avertir des modifications des dossiers de service",
        "es": "Notificarme los cambios en los casos de servicio",
        "ar-SA": "إعلامي بتغييرات حالات الخدمة"
    },
    "Log Sessions For Connection Reporting": {
        "en": "Log Sessions For Connection Reporting",
        "de": "Sitzungen für Verbindungsberichte protokollieren",
        "fr": "Journaliser les sessions pour les rapports de connexion",
        "es": "Registrar sesiones para informes de conexión",
        "ar-SA": "تسجيل الجلسات لتقارير الاتصال"
    },
    "Show Comment Window After Each Session": {
        "en": "Show Comment Window After Each Session",
        "de": "Kommentarfenster nach jeder Sitzung anzeigen",
        "fr": "Afficher la fenêtre de commentaire après chaque session",
        "es": "Mostrar la ventana de comentarios después de cada sesión",
        "ar-SA": "إظهار نافذة التعليق بعد كل جلسة"
    },
    "Show In-Product Marketing Messages": {
        "en": "Show In-Product Marketing Messages",
        "de": "Marketingmeldungen im Produkt anzeigen",
        "fr": "Afficher les messages marketing dans le produit",
        "es": "Mostrar mensajes de marketing en el producto",
        "ar-SA": "إظهار الرسائل التسويقية داخل المنتج"
    },
    "Close To Tray Menu": {
        "en": "Close To Tray Menu",
        "de": "In den Infobereich schließen",
        "fr": "Fermer dans la zone de notification",
        "es": "Cerrar en la bandeja del sistema",
        "ar-SA": "الإغلاق إلى علبة النظام"
    },
    "Dashboards": {
        "en": "Dashboards",
        "de": "Dashboards",
        "fr": "Tableaux de bord",
        "es": "Paneles",
        "ar-SA": "لوحات المعلومات"
    },
    "Host Device": {
        "en": "Host Device",
        "de": "Host-Gerät",
        "fr": "Appareil hôte",
        "es": "Dispositivo host",
        "ar-SA": "الجهاز المضيف"
    },
    "Platform Analytics": {
        "en": "Platform Analytics",
        "de": "Plattformanalysen",
        "fr": "Analyses de la plateforme",
        "es": "Análisis de la plataforma",
        "ar-SA": "تحليلات المنصة"
    },
    "Support Hub": {
        "en": "Support Hub",
        "de": "Support-Center",
        "fr": "Centre d'assistance",
        "es": "Centro de soporte",
        "ar-SA": "مركز الدعم"
    },
    "Logout Session": {
        "en": "Logout Session",
        "de": "Sitzung abmelden",
        "fr": "Déconnecter la session",
        "es": "Cerrar sesión",
        "ar-SA": "تسجيل الخروج من الجلسة"
    },
    "Secure Node Mesh": {
        "en": "Secure Node Mesh",
        "de": "Sicheres Knotennetz",
        "fr": "Maillage de nœuds sécurisé",
        "es": "Malla de nodos segura",
        "ar-SA": "شبكة العقد الآمنة"
    },
    "You signed in with Google — set a password to also sign in with email and password.": {
        "en": "You signed in with Google — set a password to also sign in with email and password.",
        "de": "Sie haben sich mit Google angemeldet — legen Sie ein Passwort fest, um sich auch mit E-Mail und Passwort anmelden zu können.",
        "fr": "Vous vous êtes connecté avec Google — définissez un mot de passe pour pouvoir aussi vous connecter avec votre e-mail et votre mot de passe.",
        "es": "Iniciaste sesión con Google — establece una contraseña para poder iniciar sesión también con correo electrónico y contraseña.",
        "ar-SA": "لقد سجّلت الدخول باستخدام Google — عيّن كلمة مرور لتتمكن أيضًا من تسجيل الدخول بالبريد الإلكتروني وكلمة المرور."
    },
    "Active Sessions": {
        "en": "Active Sessions",
        "de": "Aktive Sitzungen",
        "fr": "Sessions actives",
        "es": "Sesiones activas",
        "ar-SA": "الجلسات النشطة"
    },
    "App Experience": {
        "en": "App Experience",
        "de": "App-Erlebnis",
        "fr": "Expérience de l'application",
        "es": "Experiencia de la aplicación",
        "ar-SA": "تجربة التطبيق"
    },
    "Auto-Host On Launch": {
        "en": "Auto-Host On Launch",
        "de": "Beim Start automatisch hosten",
        "fr": "Hébergement automatique au lancement",
        "es": "Alojar automáticamente al iniciar",
        "ar-SA": "الاستضافة التلقائية عند التشغيل"
    },
    "Automatically start broadcasting this device when app starts": {
        "en": "Automatically start broadcasting this device when app starts",
        "de": "Dieses Gerät beim App-Start automatisch freigeben",
        "fr": "Diffuser automatiquement cet appareil au démarrage de l'application",
        "es": "Empezar a transmitir este dispositivo automáticamente al iniciar la aplicación",
        "ar-SA": "بدء بث هذا الجهاز تلقائيًا عند تشغيل التطبيق"
    },
    "Reduced Motion": {
        "en": "Reduced Motion",
        "de": "Reduzierte Bewegung",
        "fr": "Animations réduites",
        "es": "Movimiento reducido",
        "ar-SA": "تقليل الحركة"
    },
    "Disable animations and transitions for better performance": {
        "en": "Disable animations and transitions for better performance",
        "de": "Animationen und Übergänge für bessere Leistung deaktivieren",
        "fr": "Désactiver les animations et transitions pour de meilleures performances",
        "es": "Desactivar animaciones y transiciones para mejorar el rendimiento",
        "ar-SA": "تعطيل الرسوم المتحركة والانتقالات لتحسين الأداء"
    },
    "Streaming Quality": {
        "en": "Streaming Quality",
        "de": "Streaming-Qualität",
        "fr": "Qualité du streaming",
        "es": "Calidad de transmisión",
        "ar-SA": "جودة البث"
    },
    "Notification Alerts": {
        "en": "Notification Alerts",
        "de": "Benachrichtigungen",
        "fr": "Alertes de notification",
        "es": "Alertas de notificación",
        "ar-SA": "تنبيهات الإشعارات"
    },
    "Session Connection": {
        "en": "Session Connection",
        "de": "Sitzungsverbindung",
        "fr": "Connexion de session",
        "es": "Conexión de sesión",
        "ar-SA": "اتصال الجلسة"
    },
    "Alert me when someone connects to this device": {
        "en": "Alert me when someone connects to this device",
        "de": "Benachrichtigen, wenn sich jemand mit diesem Gerät verbindet",
        "fr": "M'alerter lorsque quelqu'un se connecte à cet appareil",
        "es": "Avisarme cuando alguien se conecte a este dispositivo",
        "ar-SA": "نبّهني عند اتصال شخص ما بهذا الجهاز"
    },
    "Unexpected Disconnect": {
        "en": "Unexpected Disconnect",
        "de": "Unerwartete Trennung",
        "fr": "Déconnexion inattendue",
        "es": "Desconexión inesperada",
        "ar-SA": "انقطاع غير متوقع"
    },
    "Notify if a remote session ends abruptly": {
        "en": "Notify if a remote session ends abruptly",
        "de": "Benachrichtigen, wenn eine Remotesitzung abrupt endet",
        "fr": "M'avertir si une session à distance se termine brusquement",
        "es": "Notificar si una sesión remota finaliza de forma abrupta",
        "ar-SA": "إعلامي إذا انتهت جلسة عن بُعد بشكل مفاجئ"
    },
    "Interface Sounds": {
        "en": "Interface Sounds",
        "de": "Oberflächentöne",
        "fr": "Sons de l'interface",
        "es": "Sonidos de la interfaz",
        "ar-SA": "أصوات الواجهة"
    },
    "Play audio cues for app events and alerts": {
        "en": "Play audio cues for app events and alerts",
        "de": "Audiosignale für App-Ereignisse und Warnungen abspielen",
        "fr": "Émettre des signaux sonores pour les événements et alertes de l'application",
        "es": "Reproducir sonidos para eventos y alertas de la aplicación",
        "ar-SA": "تشغيل تنبيهات صوتية لأحداث التطبيق والتنبيهات"
    },
    "Revoke all access keys and permanently close your account.": {
        "en": "Revoke all access keys and permanently close your account.",
        "de": "Alle Zugriffsschlüssel widerrufen und Ihr Konto endgültig schließen.",
        "fr": "Révoquer toutes les clés d'accès et fermer définitivement votre compte.",
        "es": "Revocar todas las claves de acceso y cerrar tu cuenta de forma permanente.",
        "ar-SA": "إلغاء جميع مفاتيح الوصول وإغلاق حسابك نهائيًا."
    },
    "2FA Activated": {
        "en": "2FA Activated",
        "de": "2FA aktiviert",
        "fr": "2FA activée",
        "es": "2FA activada",
        "ar-SA": "تم تفعيل 2FA"
    },
    "Your account is now more secure.": {
        "en": "Your account is now more secure.",
        "de": "Ihr Konto ist jetzt sicherer.",
        "fr": "Votre compte est désormais plus sécurisé.",
        "es": "Tu cuenta ahora es más segura.",
        "ar-SA": "أصبح حسابك الآن أكثر أمانًا."
    },
    "Setup 2FA": {
        "en": "Setup 2FA",
        "de": "2FA einrichten",
        "fr": "Configurer la 2FA",
        "es": "Configurar 2FA",
        "ar-SA": "إعداد 2FA"
    },
    "Scan this QR with Google Authenticator or Authy, then enter the 6-digit code.": {
        "en": "Scan this QR with Google Authenticator or Authy, then enter the 6-digit code.",
        "de": "Scannen Sie diesen QR-Code mit Google Authenticator oder Authy und geben Sie dann den 6-stelligen Code ein.",
        "fr": "Scannez ce code QR avec Google Authenticator ou Authy, puis saisissez le code à 6 chiffres.",
        "es": "Escanea este código QR con Google Authenticator o Authy y, a continuación, introduce el código de 6 dígitos.",
        "ar-SA": "امسح رمز QR هذا باستخدام Google Authenticator أو Authy، ثم أدخل الرمز المكوّن من 6 أرقام."
    },
    "Confirm New": {
        "en": "Confirm New",
        "de": "Neues Passwort bestätigen",
        "fr": "Confirmer le nouveau mot de passe",
        "es": "Confirmar nueva contraseña",
        "ar-SA": "تأكيد كلمة المرور الجديدة"
    },
    "Account Suspended": {
        "en": "Account Suspended",
        "de": "Konto gesperrt",
        "fr": "Compte suspendu",
        "es": "Cuenta suspendida",
        "ar-SA": "تم تعليق الحساب"
    },
    "Back To Sign In": {
        "en": "Back To Sign In",
        "de": "Zurück zur Anmeldung",
        "fr": "Retour à la connexion",
        "es": "Volver a iniciar sesión",
        "ar-SA": "العودة إلى تسجيل الدخول"
    },
    "Update Now": {
        "en": "Update Now",
        "de": "Jetzt aktualisieren",
        "fr": "Mettre à jour maintenant",
        "es": "Actualizar ahora",
        "ar-SA": "التحديث الآن"
    },
    "Restart Now": {
        "en": "Restart Now",
        "de": "Jetzt neu starten",
        "fr": "Redémarrer maintenant",
        "es": "Reiniciar ahora",
        "ar-SA": "إعادة التشغيل الآن"
    },
    "Connecting Safely": {
        "en": "Connecting Safely",
        "de": "Sichere Verbindung wird hergestellt",
        "fr": "Connexion sécurisée en cours",
        "es": "Conectando de forma segura",
        "ar-SA": "جارٍ الاتصال بأمان"
    },
    "Connecting To Remote Computer": {
        "en": "Connecting To Remote Computer",
        "de": "Verbindung zum Remotecomputer wird hergestellt",
        "fr": "Connexion à l'ordinateur distant",
        "es": "Conectando con el equipo remoto",
        "ar-SA": "جارٍ الاتصال بالكمبيوتر البعيد"
    },
    "Remote365 is opening the screen and getting controls ready. This may take a moment.": {
        "en": "Remote365 is opening the screen and getting controls ready. This may take a moment.",
        "de": "Remote365 öffnet den Bildschirm und bereitet die Steuerung vor. Dies kann einen Moment dauern.",
        "fr": "Remote365 ouvre l'écran et prépare les commandes. Cela peut prendre un moment.",
        "es": "Remote365 está abriendo la pantalla y preparando los controles. Esto puede tardar un momento.",
        "ar-SA": "يقوم Remote365 بفتح الشاشة وتجهيز عناصر التحكم. قد يستغرق ذلك لحظة."
    },
    "Cancel Session": {
        "en": "Cancel Session",
        "de": "Sitzung abbrechen",
        "fr": "Annuler la session",
        "es": "Cancelar sesión",
        "ar-SA": "إلغاء الجلسة"
    },
    "Copyright 2026 (c) Remote365. All Rights Reserved.": {
        "en": "Copyright 2026 (c) Remote365. All Rights Reserved.",
        "de": "Copyright 2026 (c) Remote365. Alle Rechte vorbehalten.",
        "fr": "Copyright 2026 (c) Remote365. Tous droits réservés.",
        "es": "Copyright 2026 (c) Remote365. Todos los derechos reservados.",
        "ar-SA": "حقوق النشر 2026 (c) Remote365. جميع الحقوق محفوظة."
    },
    "Click To Resume Stream": {
        "en": "Click To Resume Stream",
        "de": "Klicken, um den Stream fortzusetzen",
        "fr": "Cliquez pour reprendre le flux",
        "es": "Haz clic para reanudar la transmisión",
        "ar-SA": "انقر لاستئناف البث"
    },
    "Remote Command Deck": {
        "en": "Remote Command Deck",
        "de": "Remote-Befehlszentrale",
        "fr": "Centre de commandes à distance",
        "es": "Panel de comandos remotos",
        "ar-SA": "لوحة الأوامر عن بُعد"
    },
    "Run trusted navigation, transfer, audio, and recovery actions without leaving the stream.": {
        "en": "Run trusted navigation, transfer, audio, and recovery actions without leaving the stream.",
        "de": "Führen Sie vertrauenswürdige Navigations-, Übertragungs-, Audio- und Wiederherstellungsaktionen aus, ohne den Stream zu verlassen.",
        "fr": "Exécutez des actions fiables de navigation, de transfert, d'audio et de récupération sans quitter le flux.",
        "es": "Ejecuta acciones de confianza de navegación, transferencia, audio y recuperación sin salir de la transmisión.",
        "ar-SA": "نفّذ إجراءات موثوقة للتنقل والنقل والصوت والاسترداد دون مغادرة البث."
    },
    "Windows blocks normal apps from sending the secure Ctrl + Alt + Del screen. Use Task Manager for the same recovery path.": {
        "en": "Windows blocks normal apps from sending the secure Ctrl + Alt + Del screen. Use Task Manager for the same recovery path.",
        "de": "Windows verhindert, dass normale Apps den sicheren Ctrl + Alt + Del-Bildschirm senden. Verwenden Sie den Task-Manager für denselben Wiederherstellungsweg.",
        "fr": "Windows empêche les applications classiques d'envoyer l'écran sécurisé Ctrl + Alt + Del. Utilisez le Gestionnaire des tâches pour la même procédure de récupération.",
        "es": "Windows impide que las aplicaciones normales envíen la pantalla segura de Ctrl + Alt + Del. Usa el Administrador de tareas para la misma vía de recuperación.",
        "ar-SA": "يمنع Windows التطبيقات العادية من إرسال شاشة Ctrl + Alt + Del الآمنة. استخدم إدارة المهام لنفس مسار الاسترداد."
    },
    "Remote audio plays automatically when the host stream includes sound. Muting it here only silences this device — the host keeps its own mute on the dock.": {
        "en": "Remote audio plays automatically when the host stream includes sound. Muting it here only silences this device — the host keeps its own mute on the dock.",
        "de": "Remote-Audio wird automatisch wiedergegeben, wenn der Host-Stream Ton enthält. Wenn Sie es hier stummschalten, wird nur dieses Gerät stummgeschaltet — der Host behält seine eigene Stummschaltung im Dock.",
        "fr": "L'audio distant est lu automatiquement lorsque le flux de l'hôte contient du son. Le couper ici ne rend muet que cet appareil — l'hôte conserve sa propre sourdine dans le dock.",
        "es": "El audio remoto se reproduce automáticamente cuando la transmisión del host incluye sonido. Silenciarlo aquí solo afecta a este dispositivo — el host mantiene su propio silencio en el dock.",
        "ar-SA": "يُشغَّل الصوت البعيد تلقائيًا عندما يتضمن بث المضيف صوتًا. كتمه هنا يُسكت هذا الجهاز فقط — يحتفظ المضيف بزر الكتم الخاص به في شريط الإرساء."
    },
    "Record This Session?": {
        "en": "Record This Session?",
        "de": "Diese Sitzung aufzeichnen?",
        "fr": "Enregistrer cette session ?",
        "es": "¿Grabar esta sesión?",
        "ar-SA": "هل تريد تسجيل هذه الجلسة؟"
    },
    "Record": {
        "en": "Record",
        "de": "Aufzeichnen",
        "fr": "Enregistrer",
        "es": "Grabar",
        "ar-SA": "تسجيل"
    },
    "Not Now": {
        "en": "Not Now",
        "de": "Nicht jetzt",
        "fr": "Pas maintenant",
        "es": "Ahora no",
        "ar-SA": "ليس الآن"
    },
    "Save Macro": {
        "en": "Save Macro",
        "de": "Makro speichern",
        "fr": "Enregistrer la macro",
        "es": "Guardar macro",
        "ar-SA": "حفظ الماكرو"
    },
    "Discard": {
        "en": "Discard",
        "de": "Verwerfen",
        "fr": "Ignorer",
        "es": "Descartar",
        "ar-SA": "تجاهل"
    },
    "Waiting for the remote computer to choose a file...": {
        "en": "Waiting for the remote computer to choose a file...",
        "de": "Warten, bis der Remotecomputer eine Datei auswählt...",
        "fr": "En attente de la sélection d'un fichier par l'ordinateur distant...",
        "es": "Esperando a que el equipo remoto elija un archivo...",
        "ar-SA": "في انتظار اختيار الكمبيوتر البعيد لملف..."
    },
    "Preparing The Remote File...": {
        "en": "Preparing The Remote File...",
        "de": "Remote-Datei wird vorbereitet...",
        "fr": "Préparation du fichier distant...",
        "es": "Preparando el archivo remoto...",
        "ar-SA": "جارٍ تجهيز الملف البعيد..."
    },
    "Go to the phone home screen.": {
        "en": "Go to the phone home screen.",
        "de": "Zum Startbildschirm des Telefons wechseln.",
        "fr": "Aller à l'écran d'accueil du téléphone.",
        "es": "Ir a la pantalla de inicio del teléfono.",
        "ar-SA": "الانتقال إلى الشاشة الرئيسية للهاتف."
    },
    "Go back in the current app.": {
        "en": "Go back in the current app.",
        "de": "In der aktuellen App zurückgehen.",
        "fr": "Revenir en arrière dans l'application actuelle.",
        "es": "Volver atrás en la aplicación actual.",
        "ar-SA": "الرجوع في التطبيق الحالي."
    },
    "Recent Apps": {
        "en": "Recent Apps",
        "de": "Letzte Apps",
        "fr": "Applications récentes",
        "es": "Aplicaciones recientes",
        "ar-SA": "التطبيقات الأخيرة"
    },
    "Switcher": {
        "en": "Switcher",
        "de": "Umschalter",
        "fr": "Sélecteur",
        "es": "Selector",
        "ar-SA": "المبدّل"
    },
    "Open Android recent apps.": {
        "en": "Open Android recent apps.",
        "de": "Letzte Android-Apps öffnen.",
        "fr": "Ouvrir les applications récentes d'Android.",
        "es": "Abrir las aplicaciones recientes de Android.",
        "ar-SA": "فتح تطبيقات Android الأخيرة."
    },
    "Shade": {
        "en": "Shade",
        "de": "Leiste",
        "fr": "Volet",
        "es": "Cortina",
        "ar-SA": "الشريط"
    },
    "Open the notification shade.": {
        "en": "Open the notification shade.",
        "de": "Benachrichtigungsleiste öffnen.",
        "fr": "Ouvrir le volet des notifications.",
        "es": "Abrir el panel de notificaciones.",
        "ar-SA": "فتح لوحة الإشعارات."
    },
    "Quick Settings": {
        "en": "Quick Settings",
        "de": "Schnelleinstellungen",
        "fr": "Réglages rapides",
        "es": "Ajustes rápidos",
        "ar-SA": "الإعدادات السريعة"
    },
    "Panel": {
        "en": "Panel",
        "de": "Bereich",
        "fr": "Panneau",
        "es": "Panel",
        "ar-SA": "اللوحة"
    },
    "Open Android quick settings.": {
        "en": "Open Android quick settings.",
        "de": "Android-Schnelleinstellungen öffnen.",
        "fr": "Ouvrir les réglages rapides d'Android.",
        "es": "Abrir los ajustes rápidos de Android.",
        "ar-SA": "فتح الإعدادات السريعة في Android."
    },
    "Paste Clipboard": {
        "en": "Paste Clipboard",
        "de": "Zwischenablage einfügen",
        "fr": "Coller le presse-papiers",
        "es": "Pegar portapapeles",
        "ar-SA": "لصق الحافظة"
    },
    "Text": {
        "en": "Text",
        "de": "Text",
        "fr": "Texte",
        "es": "Texto",
        "ar-SA": "نص"
    },
    "Type your local clipboard into the phone.": {
        "en": "Type your local clipboard into the phone.",
        "de": "Lokale Zwischenablage auf dem Telefon eingeben.",
        "fr": "Saisir le contenu de votre presse-papiers local sur le téléphone.",
        "es": "Escribir el contenido del portapapeles local en el teléfono.",
        "ar-SA": "كتابة محتوى الحافظة المحلية على الهاتف."
    },
    "Task Manager": {
        "en": "Task Manager",
        "de": "Task-Manager",
        "fr": "Gestionnaire des tâches",
        "es": "Administrador de tareas",
        "ar-SA": "إدارة المهام"
    },
    "Open recovery and process controls.": {
        "en": "Open recovery and process controls.",
        "de": "Wiederherstellungs- und Prozesssteuerung öffnen.",
        "fr": "Ouvrir les commandes de récupération et de processus.",
        "es": "Abrir los controles de recuperación y procesos.",
        "ar-SA": "فتح عناصر التحكم في الاسترداد والعمليات."
    },
    "Switch App": {
        "en": "Switch App",
        "de": "App wechseln",
        "fr": "Changer d'application",
        "es": "Cambiar de aplicación",
        "ar-SA": "تبديل التطبيق"
    },
    "Move through open windows.": {
        "en": "Move through open windows.",
        "de": "Durch geöffnete Fenster wechseln.",
        "fr": "Parcourir les fenêtres ouvertes.",
        "es": "Recorrer las ventanas abiertas.",
        "ar-SA": "التنقل بين النوافذ المفتوحة."
    },
    "Close Window": {
        "en": "Close Window",
        "de": "Fenster schließen",
        "fr": "Fermer la fenêtre",
        "es": "Cerrar ventana",
        "ar-SA": "إغلاق النافذة"
    },
    "Close the foreground app.": {
        "en": "Close the foreground app.",
        "de": "Die App im Vordergrund schließen.",
        "fr": "Fermer l'application au premier plan.",
        "es": "Cerrar la aplicación en primer plano.",
        "ar-SA": "إغلاق التطبيق في المقدمة."
    },
    "Show Desktop": {
        "en": "Show Desktop",
        "de": "Desktop anzeigen",
        "fr": "Afficher le bureau",
        "es": "Mostrar escritorio",
        "ar-SA": "إظهار سطح المكتب"
    },
    "Minimize all windows.": {
        "en": "Minimize all windows.",
        "de": "Alle Fenster minimieren.",
        "fr": "Réduire toutes les fenêtres.",
        "es": "Minimizar todas las ventanas.",
        "ar-SA": "تصغير جميع النوافذ."
    },
    "File Explorer": {
        "en": "File Explorer",
        "de": "Datei-Explorer",
        "fr": "Explorateur de fichiers",
        "es": "Explorador de archivos",
        "ar-SA": "مستكشف الملفات"
    },
    "Open files on the remote device.": {
        "en": "Open files on the remote device.",
        "de": "Dateien auf dem Remotegerät öffnen.",
        "fr": "Ouvrir les fichiers sur l'appareil distant.",
        "es": "Abrir archivos en el dispositivo remoto.",
        "ar-SA": "فتح الملفات على الجهاز البعيد."
    },
    "Lock Device": {
        "en": "Lock Device",
        "de": "Gerät sperren",
        "fr": "Verrouiller l'appareil",
        "es": "Bloquear dispositivo",
        "ar-SA": "قفل الجهاز"
    },
    "Lock the remote session securely.": {
        "en": "Lock the remote session securely.",
        "de": "Remotesitzung sicher sperren.",
        "fr": "Verrouiller la session distante en toute sécurité.",
        "es": "Bloquear la sesión remota de forma segura.",
        "ar-SA": "قفل الجلسة البعيدة بأمان."
    },
    "Open Windows notifications.": {
        "en": "Open Windows notifications.",
        "de": "Windows-Benachrichtigungen öffnen.",
        "fr": "Ouvrir les notifications Windows.",
        "es": "Abrir las notificaciones de Windows.",
        "ar-SA": "فتح إشعارات Windows."
    },
    "Open network/audio quick settings.": {
        "en": "Open network/audio quick settings.",
        "de": "Schnelleinstellungen für Netzwerk/Audio öffnen.",
        "fr": "Ouvrir les paramètres rapides réseau/audio.",
        "es": "Abrir la configuración rápida de red/audio.",
        "ar-SA": "فتح الإعدادات السريعة للشبكة/الصوت."
    },
    "Wake Phone": {
        "en": "Wake Phone",
        "de": "Telefon aufwecken",
        "fr": "Réveiller le téléphone",
        "es": "Activar teléfono",
        "ar-SA": "إيقاظ الهاتف"
    },
    "Wake": {
        "en": "Wake",
        "de": "Aufwecken",
        "fr": "Réveiller",
        "es": "Activar",
        "ar-SA": "إيقاظ"
    },
    "Wake the phone display before controlling it.": {
        "en": "Wake the phone display before controlling it.",
        "de": "Telefondisplay vor der Steuerung aufwecken.",
        "fr": "Réveiller l'écran du téléphone avant de le contrôler.",
        "es": "Activar la pantalla del teléfono antes de controlarlo.",
        "ar-SA": "إيقاظ شاشة الهاتف قبل التحكم فيه."
    },
    "Volume Up": {
        "en": "Volume Up",
        "de": "Lauter",
        "fr": "Monter le volume",
        "es": "Subir volumen",
        "ar-SA": "رفع الصوت"
    },
    "Audio": {
        "en": "Audio",
        "de": "Audio",
        "fr": "Audio",
        "es": "Audio",
        "ar-SA": "الصوت"
    },
    "Raise Android media volume.": {
        "en": "Raise Android media volume.",
        "de": "Android-Medienlautstärke erhöhen.",
        "fr": "Augmenter le volume multimédia d'Android.",
        "es": "Subir el volumen multimedia de Android.",
        "ar-SA": "رفع مستوى صوت الوسائط في Android."
    },
    "Volume Down": {
        "en": "Volume Down",
        "de": "Leiser",
        "fr": "Baisser le volume",
        "es": "Bajar volumen",
        "ar-SA": "خفض الصوت"
    },
    "Lower Android media volume.": {
        "en": "Lower Android media volume.",
        "de": "Android-Medienlautstärke verringern.",
        "fr": "Baisser le volume multimédia d'Android.",
        "es": "Bajar el volumen multimedia de Android.",
        "ar-SA": "خفض مستوى صوت الوسائط في Android."
    },
    "Lock Phone": {
        "en": "Lock Phone",
        "de": "Telefon sperren",
        "fr": "Verrouiller le téléphone",
        "es": "Bloquear teléfono",
        "ar-SA": "قفل الهاتف"
    },
    "Lock": {
        "en": "Lock",
        "de": "Sperren",
        "fr": "Verrouiller",
        "es": "Bloquear",
        "ar-SA": "قفل"
    },
    "Lock the Android screen.": {
        "en": "Lock the Android screen.",
        "de": "Android-Bildschirm sperren.",
        "fr": "Verrouiller l'écran Android.",
        "es": "Bloquear la pantalla de Android.",
        "ar-SA": "قفل شاشة Android."
    },
    "Power Menu": {
        "en": "Power Menu",
        "de": "Ein/Aus-Menü",
        "fr": "Menu d'alimentation",
        "es": "Menú de encendido",
        "ar-SA": "قائمة الطاقة"
    },
    "Reboot": {
        "en": "Reboot",
        "de": "Neustart",
        "fr": "Redémarrer",
        "es": "Reiniciar",
        "ar-SA": "إعادة التشغيل"
    },
    "Reboot Device": {
        "en": "Reboot Device",
        "de": "Gerät neu starten",
        "fr": "Redémarrer l'appareil",
        "es": "Reiniciar dispositivo",
        "ar-SA": "إعادة تشغيل الجهاز"
    },
    "Restart the remote computer now.": {
        "en": "Restart the remote computer now.",
        "de": "Remotecomputer jetzt neu starten.",
        "fr": "Redémarrer l'ordinateur distant maintenant.",
        "es": "Reiniciar el equipo remoto ahora.",
        "ar-SA": "إعادة تشغيل الكمبيوتر البعيد الآن."
    },
    "Lock without ending the connection.": {
        "en": "Lock without ending the connection.",
        "de": "Sperren, ohne die Verbindung zu beenden.",
        "fr": "Verrouiller sans mettre fin à la connexion.",
        "es": "Bloquear sin finalizar la conexión.",
        "ar-SA": "القفل دون إنهاء الاتصال."
    },
    "Wake Display": {
        "en": "Wake Display",
        "de": "Bildschirm aufwecken",
        "fr": "Réveiller l'écran",
        "es": "Activar pantalla",
        "ar-SA": "إيقاظ الشاشة"
    },
    "Mouse Nudge": {
        "en": "Mouse Nudge",
        "de": "Maus anstoßen",
        "fr": "Petit mouvement de souris",
        "es": "Mover el ratón",
        "ar-SA": "تحريك الماوس"
    },
    "Move the pointer to wake a dimmed screen.": {
        "en": "Move the pointer to wake a dimmed screen.",
        "de": "Zeiger bewegen, um einen abgedunkelten Bildschirm aufzuwecken.",
        "fr": "Déplacer le pointeur pour réveiller un écran assombri.",
        "es": "Mover el puntero para activar una pantalla atenuada.",
        "ar-SA": "تحريك المؤشر لإيقاظ الشاشة المعتمة."
    },
    "Open Task Manager": {
        "en": "Open Task Manager",
        "de": "Task-Manager öffnen",
        "fr": "Ouvrir le Gestionnaire des tâches",
        "es": "Abrir el Administrador de tareas",
        "ar-SA": "فتح إدارة المهام"
    },
    "Recovery": {
        "en": "Recovery",
        "de": "Wiederherstellung",
        "fr": "Récupération",
        "es": "Recuperación",
        "ar-SA": "الاسترداد"
    },
    "Use this instead of Ctrl + Alt + Del.": {
        "en": "Use this instead of Ctrl + Alt + Del.",
        "de": "Verwenden Sie dies anstelle von Ctrl + Alt + Del.",
        "fr": "Utilisez ceci à la place de Ctrl + Alt + Del.",
        "es": "Usa esto en lugar de Ctrl + Alt + Del.",
        "ar-SA": "استخدم هذا بدلاً من Ctrl + Alt + Del."
    },
    "Type your local clipboard into the remote device.": {
        "en": "Type your local clipboard into the remote device.",
        "de": "Lokale Zwischenablage auf dem Remotegerät eingeben.",
        "fr": "Saisir le contenu de votre presse-papiers local sur l'appareil distant.",
        "es": "Escribir el contenido del portapapeles local en el dispositivo remoto.",
        "ar-SA": "كتابة محتوى الحافظة المحلية على الجهاز البعيد."
    },
    "Refresh Stream": {
        "en": "Refresh Stream",
        "de": "Stream aktualisieren",
        "fr": "Actualiser le flux",
        "es": "Actualizar transmisión",
        "ar-SA": "تحديث البث"
    },
    "Keyframe": {
        "en": "Keyframe",
        "de": "Keyframe",
        "fr": "Image clé",
        "es": "Fotograma clave",
        "ar-SA": "إطار رئيسي"
    },
    "Recover a stuck or blurry video stream.": {
        "en": "Recover a stuck or blurry video stream.",
        "de": "Einen hängenden oder unscharfen Videostream wiederherstellen.",
        "fr": "Rétablir un flux vidéo figé ou flou.",
        "es": "Recuperar una transmisión de vídeo bloqueada o borrosa.",
        "ar-SA": "استعادة بث فيديو متوقف أو ضبابي."
    },
    "Navigation": {
        "en": "Navigation",
        "de": "Navigation",
        "fr": "Navigation",
        "es": "Navegación",
        "ar-SA": "التنقل"
    },
    "Transfer": {
        "en": "Transfer",
        "de": "Übertragung",
        "fr": "Transfert",
        "es": "Transferencia",
        "ar-SA": "النقل"
    },
    "Close Remote Action Confirmation": {
        "en": "Close Remote Action Confirmation",
        "de": "Bestätigung der Remote-Aktion schließen",
        "fr": "Fermer la confirmation d'action à distance",
        "es": "Cerrar confirmación de acción remota",
        "ar-SA": "إغلاق تأكيد الإجراء البعيد"
    },
    "Discard Macro": {
        "en": "Discard Macro",
        "de": "Makro verwerfen",
        "fr": "Supprimer la macro",
        "es": "Descartar macro",
        "ar-SA": "تجاهل الماكرو"
    },
    "Macro Name": {
        "en": "Macro Name",
        "de": "Makroname",
        "fr": "Nom de la macro",
        "es": "Nombre de la macro",
        "ar-SA": "اسم الماكرو"
    },
    "Minimize": {
        "en": "Minimize",
        "de": "Minimieren",
        "fr": "Réduire",
        "es": "Minimizar",
        "ar-SA": "تصغير"
    },
    "Organize your devices into groups. These are the same groups shown on the Devices page.": {
        "en": "Organize your devices into groups. These are the same groups shown on the Devices page.",
        "de": "Ordnen Sie Ihre Geräte in Gruppen. Dies sind dieselben Gruppen wie auf der Seite „Geräte“.",
        "fr": "Organisez vos appareils en groupes. Ce sont les mêmes groupes que ceux de la page Appareils.",
        "es": "Organiza tus dispositivos en grupos. Son los mismos grupos que se muestran en la página Dispositivos.",
        "ar-SA": "نظّم أجهزتك في مجموعات. هذه هي نفس المجموعات المعروضة في صفحة الأجهزة."
    },
    "Devices In This Group": {
        "en": "Devices In This Group",
        "de": "Geräte in dieser Gruppe",
        "fr": "Appareils de ce groupe",
        "es": "Dispositivos de este grupo",
        "ar-SA": "الأجهزة في هذه المجموعة"
    },
    "No devices yet.": {
        "en": "No devices yet.",
        "de": "Noch keine Geräte.",
        "fr": "Aucun appareil pour l'instant.",
        "es": "Aún no hay dispositivos.",
        "ar-SA": "لا توجد أجهزة بعد."
    },
    "This removes the group. The devices in it stay and just become ungrouped.": {
        "en": "This removes the group. The devices in it stay and just become ungrouped.",
        "de": "Dadurch wird die Gruppe entfernt. Die darin enthaltenen Geräte bleiben erhalten und sind danach keiner Gruppe mehr zugeordnet.",
        "fr": "Cela supprime le groupe. Les appareils qu'il contient sont conservés et ne sont simplement plus groupés.",
        "es": "Esto elimina el grupo. Sus dispositivos se conservan y simplemente quedan sin grupo.",
        "ar-SA": "يؤدي هذا إلى إزالة المجموعة. تبقى الأجهزة الموجودة فيها وتصبح فقط غير مضمّنة في أي مجموعة."
    },
    "Group Name Is Required": {
        "en": "Group Name Is Required",
        "de": "Gruppenname ist erforderlich",
        "fr": "Le nom du groupe est obligatoire",
        "es": "El nombre del grupo es obligatorio",
        "ar-SA": "اسم المجموعة مطلوب"
    },
    "Could Not Delete Group": {
        "en": "Could Not Delete Group",
        "de": "Gruppe konnte nicht gelöscht werden",
        "fr": "Impossible de supprimer le groupe",
        "es": "No se pudo eliminar el grupo",
        "ar-SA": "تعذّر حذف المجموعة"
    },
    "Every device in your organization. Rename or remove them here.": {
        "en": "Every device in your organization. Rename or remove them here.",
        "de": "Alle Geräte Ihrer Organisation. Hier können Sie sie umbenennen oder entfernen.",
        "fr": "Tous les appareils de votre organisation. Renommez-les ou supprimez-les ici.",
        "es": "Todos los dispositivos de tu organización. Cámbiales el nombre o elimínalos aquí.",
        "ar-SA": "جميع الأجهزة في مؤسستك. أعد تسميتها أو أزلها من هنا."
    },
    "Refresh": {
        "en": "Refresh",
        "de": "Aktualisieren",
        "fr": "Actualiser",
        "es": "Actualizar",
        "ar-SA": "تحديث"
    },
    "No devices found.": {
        "en": "No devices found.",
        "de": "Keine Geräte gefunden.",
        "fr": "Aucun appareil trouvé.",
        "es": "No se encontraron dispositivos.",
        "ar-SA": "لم يتم العثور على أجهزة."
    },
    "Owned": {
        "en": "Owned",
        "de": "Eigene",
        "fr": "Possédés",
        "es": "Propios",
        "ar-SA": "مملوكة"
    },
    "Remove Device?": {
        "en": "Remove Device?",
        "de": "Gerät entfernen?",
        "fr": "Supprimer l'appareil ?",
        "es": "¿Quitar dispositivo?",
        "ar-SA": "هل تريد إزالة الجهاز؟"
    },
    "Search By Name, ID, Or Organization": {
        "en": "Search By Name, ID, Or Organization",
        "de": "Nach Name, ID oder Organisation suchen",
        "fr": "Rechercher par nom, ID ou organisation",
        "es": "Buscar por nombre, ID u organización",
        "ar-SA": "البحث بالاسم أو ID أو المؤسسة"
    },
    "Trial Workspace": {
        "en": "Trial Workspace",
        "de": "Test-Arbeitsbereich",
        "fr": "Espace de travail d'essai",
        "es": "Espacio de trabajo de prueba",
        "ar-SA": "مساحة عمل تجريبية"
    },
    "Upgrade to SOLO, PRO, BUSINESS, or ENTERPRISE when you need more seats and devices.": {
        "en": "Upgrade to SOLO, PRO, BUSINESS, or ENTERPRISE when you need more seats and devices.",
        "de": "Führen Sie ein Upgrade auf SOLO, PRO, BUSINESS oder ENTERPRISE durch, wenn Sie mehr Plätze und Geräte benötigen.",
        "fr": "Passez à SOLO, PRO, BUSINESS ou ENTERPRISE lorsque vous avez besoin de plus de sièges et d'appareils.",
        "es": "Actualiza a SOLO, PRO, BUSINESS o ENTERPRISE cuando necesites más puestos y dispositivos.",
        "ar-SA": "قم بالترقية إلى SOLO أو PRO أو BUSINESS أو ENTERPRISE عندما تحتاج إلى مزيد من المقاعد والأجهزة."
    },
    "View Options": {
        "en": "View Options",
        "de": "Ansichtsoptionen",
        "fr": "Options d'affichage",
        "es": "Opciones de vista",
        "ar-SA": "خيارات العرض"
    },
    "Recent Activity": {
        "en": "Recent Activity",
        "de": "Letzte Aktivitäten",
        "fr": "Activité récente",
        "es": "Actividad reciente",
        "ar-SA": "النشاط الأخير"
    },
    "Open Audit Log": {
        "en": "Open Audit Log",
        "de": "Audit-Protokoll öffnen",
        "fr": "Ouvrir le journal d'audit",
        "es": "Abrir registro de auditoría",
        "ar-SA": "فتح سجل التدقيق"
    },
    "No recent activity yet.": {
        "en": "No recent activity yet.",
        "de": "Noch keine aktuellen Aktivitäten.",
        "fr": "Aucune activité récente pour l'instant.",
        "es": "Aún no hay actividad reciente.",
        "ar-SA": "لا يوجد نشاط حديث بعد."
    },
    "Quick Actions": {
        "en": "Quick Actions",
        "de": "Schnellaktionen",
        "fr": "Actions rapides",
        "es": "Acciones rápidas",
        "ar-SA": "إجراءات سريعة"
    },
    "Invite Member": {
        "en": "Invite Member",
        "de": "Mitglied einladen",
        "fr": "Inviter un membre",
        "es": "Invitar miembro",
        "ar-SA": "دعوة عضو"
    },
    "Upload Logo": {
        "en": "Upload Logo",
        "de": "Logo hochladen",
        "fr": "Importer un logo",
        "es": "Subir logotipo",
        "ar-SA": "تحميل الشعار"
    },
    "Urdu": {
        "en": "Urdu",
        "de": "Urdu",
        "fr": "Ourdou",
        "es": "Urdu",
        "ar-SA": "الأردية"
    },
    "Arabic": {
        "en": "Arabic",
        "de": "Arabisch",
        "fr": "Arabe",
        "es": "Árabe",
        "ar-SA": "العربية"
    },
    "Permission": {
        "en": "Permission",
        "de": "Berechtigung",
        "fr": "Autorisation",
        "es": "Permiso",
        "ar-SA": "الإذن"
    },
    "Organization-wide registered devices.": {
        "en": "Organization-wide registered devices.",
        "de": "Organisationsweit registrierte Geräte.",
        "fr": "Appareils enregistrés dans toute l'organisation.",
        "es": "Dispositivos registrados en toda la organización.",
        "ar-SA": "الأجهزة المسجلة على مستوى المؤسسة."
    },
    "Placeholder": {
        "en": "Placeholder",
        "de": "Platzhalter",
        "fr": "Espace réservé",
        "es": "Marcador de posición",
        "ar-SA": "عنصر نائب"
    },
    "Audit API is not available yet. Events will appear here when /api/audit is implemented.": {
        "en": "Audit API is not available yet. Events will appear here when /api/audit is implemented.",
        "de": "Die Audit-API ist noch nicht verfügbar. Ereignisse werden hier angezeigt, sobald /api/audit implementiert ist.",
        "fr": "L'API d'audit n'est pas encore disponible. Les événements apparaîtront ici lorsque /api/audit sera implémentée.",
        "es": "La API de auditoría aún no está disponible. Los eventos aparecerán aquí cuando se implemente /api/audit.",
        "ar-SA": "واجهة API الخاصة بالتدقيق غير متاحة بعد. ستظهر الأحداث هنا عند تنفيذ /api/audit."
    },
    "No Events Yet": {
        "en": "No Events Yet",
        "de": "Noch keine Ereignisse",
        "fr": "Aucun événement pour l'instant",
        "es": "Aún no hay eventos",
        "ar-SA": "لا توجد أحداث بعد"
    },
    "Monitor Remote365 usage, device readiness, and recent organization activity.": {
        "en": "Monitor Remote365 usage, device readiness, and recent organization activity.",
        "de": "Überwachen Sie die Nutzung von Remote365, die Gerätebereitschaft und die letzten Aktivitäten der Organisation.",
        "fr": "Surveillez l'utilisation de Remote365, l'état de préparation des appareils et l'activité récente de l'organisation.",
        "es": "Supervisa el uso de Remote365, la disponibilidad de los dispositivos y la actividad reciente de la organización.",
        "ar-SA": "راقب استخدام Remote365 وجاهزية الأجهزة والنشاط الأخير للمؤسسة."
    },
    "Set organization details used across Remote365.": {
        "en": "Set organization details used across Remote365.",
        "de": "Legen Sie die Organisationsdetails fest, die in Remote365 verwendet werden.",
        "fr": "Définissez les informations de l'organisation utilisées dans Remote365.",
        "es": "Establece los datos de la organización que se usan en Remote365.",
        "ar-SA": "عيّن تفاصيل المؤسسة المستخدمة في Remote365."
    },
    "Displayed to team members and managed devices.": {
        "en": "Displayed to team members and managed devices.",
        "de": "Wird Teammitgliedern und verwalteten Geräten angezeigt.",
        "fr": "Affiché aux membres de l'équipe et sur les appareils gérés.",
        "es": "Se muestra a los miembros del equipo y en los dispositivos administrados.",
        "ar-SA": "يُعرض لأعضاء الفريق والأجهزة المُدارة."
    },
    "Logo": {
        "en": "Logo",
        "de": "Logo",
        "fr": "Logo",
        "es": "Logotipo",
        "ar-SA": "الشعار"
    },
    "Upload support will be available here.": {
        "en": "Upload support will be available here.",
        "de": "Das Hochladen wird hier verfügbar sein.",
        "fr": "L'importation sera disponible ici.",
        "es": "La carga estará disponible aquí.",
        "ar-SA": "سيتوفر التحميل هنا."
    },
    "Default Language": {
        "en": "Default Language",
        "de": "Standardsprache",
        "fr": "Langue par défaut",
        "es": "Idioma predeterminado",
        "ar-SA": "اللغة الافتراضية"
    },
    "Fallback language for new team members.": {
        "en": "Fallback language for new team members.",
        "de": "Ausweichsprache für neue Teammitglieder.",
        "fr": "Langue de secours pour les nouveaux membres de l'équipe.",
        "es": "Idioma alternativo para los nuevos miembros del equipo.",
        "ar-SA": "اللغة الاحتياطية لأعضاء الفريق الجدد."
    },
    "Default organization roles for Remote365 access.": {
        "en": "Default organization roles for Remote365 access.",
        "de": "Standardrollen der Organisation für den Zugriff auf Remote365.",
        "fr": "Rôles par défaut de l'organisation pour l'accès à Remote365.",
        "es": "Roles predeterminados de la organización para acceder a Remote365.",
        "ar-SA": "أدوار المؤسسة الافتراضية للوصول إلى Remote365."
    },
    "Require Host Approval": {
        "en": "Require Host Approval",
        "de": "Host-Genehmigung erforderlich",
        "fr": "Exiger l'approbation de l'hôte",
        "es": "Requerir aprobación del host",
        "ar-SA": "طلب موافقة المضيف"
    },
    "Ask the host to approve incoming remote control sessions.": {
        "en": "Ask the host to approve incoming remote control sessions.",
        "de": "Den Host bitten, eingehende Fernsteuerungssitzungen zu genehmigen.",
        "fr": "Demander à l'hôte d'approuver les sessions de contrôle à distance entrantes.",
        "es": "Pedir al host que apruebe las sesiones de control remoto entrantes.",
        "ar-SA": "مطالبة المضيف بالموافقة على جلسات التحكم عن بُعد الواردة."
    },
    "Default View-Only Sessions": {
        "en": "Default View-Only Sessions",
        "de": "Standardmäßig Nur-Ansicht-Sitzungen",
        "fr": "Sessions en lecture seule par défaut",
        "es": "Sesiones de solo visualización por defecto",
        "ar-SA": "جلسات العرض فقط افتراضيًا"
    },
    "Start new sessions without control permissions.": {
        "en": "Start new sessions without control permissions.",
        "de": "Neue Sitzungen ohne Steuerungsberechtigungen starten.",
        "fr": "Démarrer les nouvelles sessions sans autorisation de contrôle.",
        "es": "Iniciar nuevas sesiones sin permisos de control.",
        "ar-SA": "بدء الجلسات الجديدة دون أذونات التحكم."
    },
    "Permit moving files during sessions.": {
        "en": "Permit moving files during sessions.",
        "de": "Verschieben von Dateien während Sitzungen erlauben.",
        "fr": "Autoriser le déplacement de fichiers pendant les sessions.",
        "es": "Permitir mover archivos durante las sesiones.",
        "ar-SA": "السماح بنقل الملفات أثناء الجلسات."
    },
    "Allow Clipboard Sync": {
        "en": "Allow Clipboard Sync",
        "de": "Zwischenablage-Synchronisierung erlauben",
        "fr": "Autoriser la synchronisation du presse-papiers",
        "es": "Permitir sincronización del portapapeles",
        "ar-SA": "السماح بمزامنة الحافظة"
    },
    "Permit copied text to sync between devices.": {
        "en": "Permit copied text to sync between devices.",
        "de": "Synchronisierung von kopiertem Text zwischen Geräten erlauben.",
        "fr": "Autoriser la synchronisation du texte copié entre les appareils.",
        "es": "Permitir que el texto copiado se sincronice entre dispositivos.",
        "ar-SA": "السماح بمزامنة النص المنسوخ بين الأجهزة."
    },
    "Idle Session Timeout": {
        "en": "Idle Session Timeout",
        "de": "Zeitlimit für inaktive Sitzungen",
        "fr": "Délai d'expiration des sessions inactives",
        "es": "Tiempo de espera de sesión inactiva",
        "ar-SA": "مهلة الجلسة الخاملة"
    },
    "End idle sessions after this many minutes.": {
        "en": "End idle sessions after this many minutes.",
        "de": "Inaktive Sitzungen nach dieser Anzahl von Minuten beenden.",
        "fr": "Mettre fin aux sessions inactives après ce nombre de minutes.",
        "es": "Finalizar las sesiones inactivas tras este número de minutos.",
        "ar-SA": "إنهاء الجلسات الخاملة بعد هذا العدد من الدقائق."
    },
    "Session Recording": {
        "en": "Session Recording",
        "de": "Sitzungsaufzeichnung",
        "fr": "Enregistrement de session",
        "es": "Grabación de sesiones",
        "ar-SA": "تسجيل الجلسات"
    },
    "Allow approved session recordings for compliance.": {
        "en": "Allow approved session recordings for compliance.",
        "de": "Genehmigte Sitzungsaufzeichnungen für Compliance-Zwecke erlauben.",
        "fr": "Autoriser les enregistrements de session approuvés à des fins de conformité.",
        "es": "Permitir grabaciones de sesión aprobadas para el cumplimiento normativo.",
        "ar-SA": "السماح بتسجيلات الجلسات المعتمدة لأغراض الامتثال."
    },
    "Connection Policies": {
        "en": "Connection Policies",
        "de": "Verbindungsrichtlinien",
        "fr": "Stratégies de connexion",
        "es": "Directivas de conexión",
        "ar-SA": "سياسات الاتصال"
    },
    "Set default remote desktop behavior for the organization.": {
        "en": "Set default remote desktop behavior for the organization.",
        "de": "Standardverhalten für Remotedesktop in der Organisation festlegen.",
        "fr": "Définir le comportement par défaut du bureau à distance pour l'organisation.",
        "es": "Establecer el comportamiento predeterminado del escritorio remoto para la organización.",
        "ar-SA": "تعيين سلوك سطح المكتب البعيد الافتراضي للمؤسسة."
    },
    "Organization-wide authentication and trusted-device controls.": {
        "en": "Organization-wide authentication and trusted-device controls.",
        "de": "Organisationsweite Authentifizierung und Steuerung vertrauenswürdiger Geräte.",
        "fr": "Contrôles d'authentification et d'appareils de confiance à l'échelle de l'organisation.",
        "es": "Controles de autenticación y de dispositivos de confianza para toda la organización.",
        "ar-SA": "عناصر التحكم في المصادقة والأجهزة الموثوقة على مستوى المؤسسة."
    },
    "Enforce 2FA For Admins": {
        "en": "Enforce 2FA For Admins",
        "de": "2FA für Administratoren erzwingen",
        "fr": "Imposer la 2FA aux administrateurs",
        "es": "Exigir 2FA a los administradores",
        "ar-SA": "فرض 2FA على المسؤولين"
    },
    "Require elevated users to use two-factor authentication.": {
        "en": "Require elevated users to use two-factor authentication.",
        "de": "Benutzer mit erhöhten Rechten zur Zwei-Faktor-Authentifizierung verpflichten.",
        "fr": "Obliger les utilisateurs disposant de privilèges élevés à utiliser l'authentification à deux facteurs.",
        "es": "Exigir la autenticación en dos pasos a los usuarios con privilegios elevados.",
        "ar-SA": "إلزام المستخدمين ذوي الصلاحيات المرتفعة باستخدام المصادقة الثنائية."
    },
    "Minimum Password Length": {
        "en": "Minimum Password Length",
        "de": "Minimale Passwortlänge",
        "fr": "Longueur minimale du mot de passe",
        "es": "Longitud mínima de la contraseña",
        "ar-SA": "الحد الأدنى لطول كلمة المرور"
    },
    "Minimum password length for password-based accounts.": {
        "en": "Minimum password length for password-based accounts.",
        "de": "Minimale Passwortlänge für passwortbasierte Konten.",
        "fr": "Longueur minimale du mot de passe pour les comptes avec mot de passe.",
        "es": "Longitud mínima de la contraseña para cuentas basadas en contraseña.",
        "ar-SA": "الحد الأدنى لطول كلمة المرور للحسابات المعتمدة على كلمة المرور."
    },
    "Trusted Devices": {
        "en": "Trusted Devices",
        "de": "Vertrauenswürdige Geräte",
        "fr": "Appareils de confiance",
        "es": "Dispositivos de confianza",
        "ar-SA": "الأجهزة الموثوقة"
    },
    "Trusted device management will appear here.": {
        "en": "Trusted device management will appear here.",
        "de": "Die Verwaltung vertrauenswürdiger Geräte wird hier angezeigt.",
        "fr": "La gestion des appareils de confiance apparaîtra ici.",
        "es": "La gestión de dispositivos de confianza aparecerá aquí.",
        "ar-SA": "ستظهر إدارة الأجهزة الموثوقة هنا."
    },
    "Audit Log": {
        "en": "Audit Log",
        "de": "Audit-Protokoll",
        "fr": "Journal d'audit",
        "es": "Registro de auditoría",
        "ar-SA": "سجل التدقيق"
    },
    "Organization activity and administrative events.": {
        "en": "Organization activity and administrative events.",
        "de": "Organisationsaktivitäten und administrative Ereignisse.",
        "fr": "Activité de l'organisation et événements administratifs.",
        "es": "Actividad de la organización y eventos administrativos.",
        "ar-SA": "نشاط المؤسسة والأحداث الإدارية."
    },
    "Plan & Billing": {
        "en": "Plan & Billing",
        "de": "Tarif & Abrechnung",
        "fr": "Forfait et facturation",
        "es": "Plan y facturación",
        "ar-SA": "الخطة والفوترة"
    },
    "Review your current Remote365 plan and team seat usage.": {
        "en": "Review your current Remote365 plan and team seat usage.",
        "de": "Überprüfen Sie Ihren aktuellen Remote365-Tarif und die Platznutzung Ihres Teams.",
        "fr": "Consultez votre forfait Remote365 actuel et l'utilisation des sièges de votre équipe.",
        "es": "Revisa tu plan actual de Remote365 y el uso de puestos del equipo.",
        "ar-SA": "راجع خطة Remote365 الحالية واستخدام مقاعد الفريق."
    },
    "How much of your plan your organization is using.": {
        "en": "How much of your plan your organization is using.",
        "de": "Wie viel Ihres Tarifs Ihre Organisation nutzt.",
        "fr": "La part de votre forfait utilisée par votre organisation.",
        "es": "Cuánto de tu plan está usando tu organización.",
        "ar-SA": "مقدار ما تستخدمه مؤسستك من خطتك."
    },
    "Trial Ended": {
        "en": "Trial Ended",
        "de": "Testphase beendet",
        "fr": "Essai terminé",
        "es": "Prueba finalizada",
        "ar-SA": "انتهت الفترة التجريبية"
    },
    "Left In Trial": {
        "en": "Left In Trial",
        "de": "in der Testphase übrig",
        "fr": "restants dans l'essai",
        "es": "restantes de prueba",
        "ar-SA": "متبقية في الفترة التجريبية"
    },
    "Lifetime Access": {
        "en": "Lifetime Access",
        "de": "Lebenslanger Zugriff",
        "fr": "Accès à vie",
        "es": "Acceso de por vida",
        "ar-SA": "وصول مدى الحياة"
    },
    "Need more seats or devices? Change your plan on the Subscription tab.": {
        "en": "Need more seats or devices? Change your plan on the Subscription tab.",
        "de": "Benötigen Sie mehr Plätze oder Geräte? Ändern Sie Ihren Tarif auf der Registerkarte „Abonnement“.",
        "fr": "Besoin de plus de sièges ou d'appareils ? Changez de forfait dans l'onglet Abonnement.",
        "es": "¿Necesitas más puestos o dispositivos? Cambia tu plan en la pestaña Suscripción.",
        "ar-SA": "هل تحتاج إلى مزيد من المقاعد أو الأجهزة؟ غيّر خطتك من علامة التبويب \"الاشتراك\"."
    },
    "Signed-In Members": {
        "en": "Signed-In Members",
        "de": "Angemeldete Mitglieder",
        "fr": "Membres connectés",
        "es": "Miembros conectados",
        "ar-SA": "الأعضاء المسجّلون دخولهم"
    },
    "Each account can be signed in at up to your plan's concurrent-sessions cap in parallel.": {
        "en": "Each account can be signed in at up to your plan's concurrent-sessions cap in parallel.",
        "de": "Jedes Konto kann parallel bis zur Obergrenze gleichzeitiger Sitzungen Ihres Tarifs angemeldet sein.",
        "fr": "Chaque compte peut être connecté en parallèle jusqu'à la limite de sessions simultanées de votre forfait.",
        "es": "Cada cuenta puede tener sesiones abiertas en paralelo hasta el límite de sesiones simultáneas de tu plan.",
        "ar-SA": "يمكن تسجيل الدخول إلى كل حساب بالتوازي حتى الحد الأقصى للجلسات المتزامنة في خطتك."
    },
    "No members to show.": {
        "en": "No members to show.",
        "de": "Keine Mitglieder vorhanden.",
        "fr": "Aucun membre à afficher.",
        "es": "No hay miembros para mostrar.",
        "ar-SA": "لا يوجد أعضاء لعرضهم."
    },
    "Member Seats": {
        "en": "Member Seats",
        "de": "Mitgliederplätze",
        "fr": "Sièges membres",
        "es": "Puestos de miembros",
        "ar-SA": "مقاعد الأعضاء"
    },
    "Device Slots": {
        "en": "Device Slots",
        "de": "Geräteplätze",
        "fr": "Emplacements d'appareils",
        "es": "Espacios para dispositivos",
        "ar-SA": "خانات الأجهزة"
    },
    "Concurrent Sessions": {
        "en": "Concurrent Sessions",
        "de": "Gleichzeitige Sitzungen",
        "fr": "Sessions simultanées",
        "es": "Sesiones simultáneas",
        "ar-SA": "الجلسات المتزامنة"
    },
    "Click To See Who's Signed In": {
        "en": "Click To See Who's Signed In",
        "de": "Klicken, um angemeldete Benutzer anzuzeigen",
        "fr": "Cliquez pour voir qui est connecté",
        "es": "Haz clic para ver quién ha iniciado sesión",
        "ar-SA": "انقر لمعرفة من سجّل الدخول"
    },
    "Organization-wide rules for members and connections.": {
        "en": "Organization-wide rules for members and connections.",
        "de": "Organisationsweite Regeln für Mitglieder und Verbindungen.",
        "fr": "Règles à l'échelle de l'organisation pour les membres et les connexions.",
        "es": "Reglas para toda la organización sobre miembros y conexiones.",
        "ar-SA": "قواعد على مستوى المؤسسة للأعضاء والاتصالات."
    },
    "Applied automatically when a member is invited without a specific role.": {
        "en": "Applied automatically when a member is invited without a specific role.",
        "de": "Wird automatisch angewendet, wenn ein Mitglied ohne bestimmte Rolle eingeladen wird.",
        "fr": "Appliqué automatiquement lorsqu'un membre est invité sans rôle spécifique.",
        "es": "Se aplica automáticamente cuando se invita a un miembro sin un rol específico.",
        "ar-SA": "يُطبَّق تلقائيًا عند دعوة عضو دون دور محدد."
    },
    "Every member of your organization must have 2FA enabled on their account.": {
        "en": "Every member of your organization must have 2FA enabled on their account.",
        "de": "Jedes Mitglied Ihrer Organisation muss 2FA für sein Konto aktiviert haben.",
        "fr": "Chaque membre de votre organisation doit activer la 2FA sur son compte.",
        "es": "Todos los miembros de tu organización deben tener la 2FA activada en su cuenta.",
        "ar-SA": "يجب على كل عضو في مؤسستك تفعيل 2FA على حسابه."
    },
    "Selected Plan": {
        "en": "Selected Plan",
        "de": "Ausgewählter Tarif",
        "fr": "Forfait sélectionné",
        "es": "Plan seleccionado",
        "ar-SA": "الخطة المحددة"
    },
    "Recurring Monthly": {
        "en": "Recurring Monthly",
        "de": "Monatlich wiederkehrend",
        "fr": "Mensuel récurrent",
        "es": "Mensual recurrente",
        "ar-SA": "متكرر شهريًا"
    },
    "Card Details": {
        "en": "Card Details",
        "de": "Kartendaten",
        "fr": "Détails de la carte",
        "es": "Datos de la tarjeta",
        "ar-SA": "تفاصيل البطاقة"
    },
    "Your payment info is encrypted and never stored on our servers.": {
        "en": "Your payment info is encrypted and never stored on our servers.",
        "de": "Ihre Zahlungsdaten werden verschlüsselt und niemals auf unseren Servern gespeichert.",
        "fr": "Vos informations de paiement sont chiffrées et ne sont jamais stockées sur nos serveurs.",
        "es": "Tu información de pago está cifrada y nunca se almacena en nuestros servidores.",
        "ar-SA": "معلومات الدفع الخاصة بك مشفرة ولا تُخزَّن أبدًا على خوادمنا."
    },
    "Processing…": {
        "en": "Processing…",
        "de": "Wird verarbeitet…",
        "fr": "Traitement…",
        "es": "Procesando…",
        "ar-SA": "جارٍ المعالجة…"
    },
    "Pay & Subscribe": {
        "en": "Pay & Subscribe",
        "de": "Bezahlen & abonnieren",
        "fr": "Payer et s'abonner",
        "es": "Pagar y suscribirse",
        "ar-SA": "الدفع والاشتراك"
    },
    "Subscription Successful!": {
        "en": "Subscription Successful!",
        "de": "Abonnement erfolgreich!",
        "fr": "Abonnement réussi !",
        "es": "¡Suscripción completada!",
        "ar-SA": "تم الاشتراك بنجاح!"
    },
    "You have successfully upgraded to your new plan. Your new features are unlocked.": {
        "en": "You have successfully upgraded to your new plan. Your new features are unlocked.",
        "de": "Sie haben erfolgreich ein Upgrade auf Ihren neuen Tarif durchgeführt. Ihre neuen Funktionen sind freigeschaltet.",
        "fr": "Vous êtes bien passé à votre nouveau forfait. Vos nouvelles fonctionnalités sont débloquées.",
        "es": "Has cambiado correctamente a tu nuevo plan. Tus nuevas funciones están desbloqueadas.",
        "ar-SA": "لقد قمت بالترقية إلى خطتك الجديدة بنجاح. تم فتح ميزاتك الجديدة."
    },
    "Continue To Dashboard": {
        "en": "Continue To Dashboard",
        "de": "Weiter zum Dashboard",
        "fr": "Continuer vers le tableau de bord",
        "es": "Continuar al panel",
        "ar-SA": "المتابعة إلى لوحة المعلومات"
    },
    "Upgrade Workspace": {
        "en": "Upgrade Workspace",
        "de": "Arbeitsbereich upgraden",
        "fr": "Mettre à niveau l'espace de travail",
        "es": "Mejorar espacio de trabajo",
        "ar-SA": "ترقية مساحة العمل"
    },
    "Stripe Test Card:": {
        "en": "Stripe Test Card:",
        "de": "Stripe-Testkarte:",
        "fr": "Carte de test Stripe :",
        "es": "Tarjeta de prueba de Stripe:",
        "ar-SA": "بطاقة اختبار Stripe:"
    },
    "4242 4242 4242 4242, any future expiry, any CVC and postal code.": {
        "en": "4242 4242 4242 4242, any future expiry, any CVC and postal code.",
        "de": "4242 4242 4242 4242, beliebiges zukünftiges Ablaufdatum, beliebiger CVC und beliebige Postleitzahl.",
        "fr": "4242 4242 4242 4242, n'importe quelle date d'expiration future, n'importe quel CVC et code postal.",
        "es": "4242 4242 4242 4242, cualquier fecha de caducidad futura, cualquier CVC y código postal.",
        "ar-SA": "4242 4242 4242 4242، أي تاريخ انتهاء مستقبلي، وأي رمز CVC ورمز بريدي."
    },
    "Your Free Trial Has Ended": {
        "en": "Your Free Trial Has Ended",
        "de": "Ihre kostenlose Testphase ist abgelaufen",
        "fr": "Votre essai gratuit est terminé",
        "es": "Tu prueba gratuita ha finalizado",
        "ar-SA": "انتهت فترتك التجريبية المجانية"
    },
    "Access Type": {
        "en": "Access Type",
        "de": "Zugriffsart",
        "fr": "Type d'accès",
        "es": "Tipo de acceso",
        "ar-SA": "نوع الوصول"
    },
    "No groups yet. Create one in Device groups.": {
        "en": "No groups yet. Create one in Device groups.",
        "de": "Noch keine Gruppen. Erstellen Sie eine unter „Gerätegruppen“.",
        "fr": "Aucun groupe pour l'instant. Créez-en un dans Groupes d'appareils.",
        "es": "Aún no hay grupos. Crea uno en Grupos de dispositivos.",
        "ar-SA": "لا توجد مجموعات بعد. أنشئ مجموعة في مجموعات الأجهزة."
    },
    "None": {
        "en": "None",
        "de": "Keine",
        "fr": "Aucun",
        "es": "Ninguno",
        "ar-SA": "لا شيء"
    },
    "Specific Groups": {
        "en": "Specific Groups",
        "de": "Bestimmte Gruppen",
        "fr": "Groupes spécifiques",
        "es": "Grupos específicos",
        "ar-SA": "مجموعات محددة"
    },
    "Specific Devices": {
        "en": "Specific Devices",
        "de": "Bestimmte Geräte",
        "fr": "Appareils spécifiques",
        "es": "Dispositivos específicos",
        "ar-SA": "أجهزة محددة"
    },
    "The role sets the starting point for permissions. Fine-tune below.": {
        "en": "The role sets the starting point for permissions. Fine-tune below.",
        "de": "Die Rolle legt den Ausgangspunkt für Berechtigungen fest. Unten können Sie sie anpassen.",
        "fr": "Le rôle définit le point de départ des autorisations. Affinez-les ci-dessous.",
        "es": "El rol establece el punto de partida de los permisos. Ajústalos a continuación.",
        "ar-SA": "يحدد الدور نقطة البداية للأذونات. يمكنك ضبطها بدقة أدناه."
    },
    "Device Access": {
        "en": "Device Access",
        "de": "Gerätezugriff",
        "fr": "Accès aux appareils",
        "es": "Acceso a dispositivos",
        "ar-SA": "الوصول إلى الأجهزة"
    },
    "Choose which devices this member can see.": {
        "en": "Choose which devices this member can see.",
        "de": "Wählen Sie, welche Geräte dieses Mitglied sehen kann.",
        "fr": "Choisissez les appareils que ce membre peut voir.",
        "es": "Elige qué dispositivos puede ver este miembro.",
        "ar-SA": "اختر الأجهزة التي يمكن لهذا العضو رؤيتها."
    },
    "Role Default": {
        "en": "Role Default",
        "de": "Rollenstandard",
        "fr": "Valeur par défaut du rôle",
        "es": "Predeterminado del rol",
        "ar-SA": "الافتراضي للدور"
    },
    "What this user sees in the sidebar and menus.": {
        "en": "What this user sees in the sidebar and menus.",
        "de": "Was dieser Benutzer in der Seitenleiste und in Menüs sieht.",
        "fr": "Ce que cet utilisateur voit dans la barre latérale et les menus.",
        "es": "Lo que este usuario ve en la barra lateral y los menús.",
        "ar-SA": "ما يراه هذا المستخدم في الشريط الجانبي والقوائم."
    },
    "See and start remote-support connections.": {
        "en": "See and start remote-support connections.",
        "de": "Fernsupport-Verbindungen sehen und starten.",
        "fr": "Voir et démarrer des connexions d'assistance à distance.",
        "es": "Ver e iniciar conexiones de soporte remoto.",
        "ar-SA": "عرض اتصالات الدعم عن بُعد وبدئها."
    },
    "What this user can do to devices they can access.": {
        "en": "What this user can do to devices they can access.",
        "de": "Was dieser Benutzer mit Geräten tun kann, auf die er Zugriff hat.",
        "fr": "Ce que cet utilisateur peut faire sur les appareils auxquels il a accès.",
        "es": "Lo que este usuario puede hacer en los dispositivos a los que tiene acceso.",
        "ar-SA": "ما يمكن لهذا المستخدم فعله على الأجهزة التي يمكنه الوصول إليها."
    },
    "Add / Register Devices": {
        "en": "Add / Register Devices",
        "de": "Geräte hinzufügen / registrieren",
        "fr": "Ajouter / enregistrer des appareils",
        "es": "Añadir / registrar dispositivos",
        "ar-SA": "إضافة / تسجيل الأجهزة"
    },
    "Enroll new devices into the organization.": {
        "en": "Enroll new devices into the organization.",
        "de": "Neue Geräte in der Organisation registrieren.",
        "fr": "Inscrire de nouveaux appareils dans l'organisation.",
        "es": "Registra nuevos dispositivos en la organización.",
        "ar-SA": "تسجيل أجهزة جديدة في المؤسسة."
    },
    "Rename & Configure Devices": {
        "en": "Rename & Configure Devices",
        "de": "Geräte umbenennen & konfigurieren",
        "fr": "Renommer et configurer des appareils",
        "es": "Renombrar y configurar dispositivos",
        "ar-SA": "إعادة تسمية الأجهزة وتكوينها"
    },
    "Edit a device name, tags, and settings.": {
        "en": "Edit a device name, tags, and settings.",
        "de": "Gerätename, Tags und Einstellungen bearbeiten.",
        "fr": "Modifier le nom, les balises et les paramètres d'un appareil.",
        "es": "Edita el nombre, las etiquetas y los ajustes de un dispositivo.",
        "ar-SA": "تعديل اسم الجهاز وعلاماته وإعداداته."
    },
    "Delete / Remove Devices": {
        "en": "Delete / Remove Devices",
        "de": "Geräte löschen / entfernen",
        "fr": "Supprimer / retirer des appareils",
        "es": "Eliminar / quitar dispositivos",
        "ar-SA": "حذف / إزالة الأجهزة"
    },
    "Remove devices from the organization.": {
        "en": "Remove devices from the organization.",
        "de": "Geräte aus der Organisation entfernen.",
        "fr": "Retirer des appareils de l'organisation.",
        "es": "Quita dispositivos de la organización.",
        "ar-SA": "إزالة الأجهزة من المؤسسة."
    },
    "Assign Devices To Members": {
        "en": "Assign Devices To Members",
        "de": "Geräte Mitgliedern zuweisen",
        "fr": "Attribuer des appareils aux membres",
        "es": "Asignar dispositivos a miembros",
        "ar-SA": "تعيين الأجهزة للأعضاء"
    },
    "Grant or revoke other members’ device access.": {
        "en": "Grant or revoke other members’ device access.",
        "de": "Gerätezugriff anderer Mitglieder gewähren oder entziehen.",
        "fr": "Accorder ou révoquer l'accès des autres membres aux appareils.",
        "es": "Concede o revoca el acceso de otros miembros a los dispositivos.",
        "ar-SA": "منح أو إلغاء وصول الأعضاء الآخرين إلى الأجهزة."
    },
    "Create Device Groups": {
        "en": "Create Device Groups",
        "de": "Gerätegruppen erstellen",
        "fr": "Créer des groupes d'appareils",
        "es": "Crear grupos de dispositivos",
        "ar-SA": "إنشاء مجموعات الأجهزة"
    },
    "Create and rename device groups.": {
        "en": "Create and rename device groups.",
        "de": "Gerätegruppen erstellen und umbenennen.",
        "fr": "Créer et renommer des groupes d'appareils.",
        "es": "Crea y renombra grupos de dispositivos.",
        "ar-SA": "إنشاء مجموعات الأجهزة وإعادة تسميتها."
    },
    "Delete Device Groups": {
        "en": "Delete Device Groups",
        "de": "Gerätegruppen löschen",
        "fr": "Supprimer des groupes d'appareils",
        "es": "Eliminar grupos de dispositivos",
        "ar-SA": "حذف مجموعات الأجهزة"
    },
    "Delete device groups.": {
        "en": "Delete device groups.",
        "de": "Gerätegruppen löschen.",
        "fr": "Supprimer des groupes d'appareils.",
        "es": "Elimina grupos de dispositivos.",
        "ar-SA": "حذف مجموعات الأجهزة."
    },
    "Report A Device Problem": {
        "en": "Report A Device Problem",
        "de": "Geräteproblem melden",
        "fr": "Signaler un problème d'appareil",
        "es": "Informar de un problema del dispositivo",
        "ar-SA": "الإبلاغ عن مشكلة في جهاز"
    },
    "Flag a device issue to owners/admins.": {
        "en": "Flag a device issue to owners/admins.",
        "de": "Ein Geräteproblem an Eigentümer/Administratoren melden.",
        "fr": "Signaler un problème d'appareil aux propriétaires/administrateurs.",
        "es": "Notifica un problema del dispositivo a propietarios/administradores.",
        "ar-SA": "الإبلاغ عن مشكلة جهاز إلى المالكين/المسؤولين."
    },
    "Remote-control session capabilities.": {
        "en": "Remote-control session capabilities.",
        "de": "Funktionen für Fernsteuerungssitzungen.",
        "fr": "Fonctionnalités des sessions de contrôle à distance.",
        "es": "Funciones de las sesiones de control remoto.",
        "ar-SA": "إمكانات جلسات التحكم عن بُعد."
    },
    "Start Remote Sessions": {
        "en": "Start Remote Sessions",
        "de": "Remote-Sitzungen starten",
        "fr": "Démarrer des sessions à distance",
        "es": "Iniciar sesiones remotas",
        "ar-SA": "بدء الجلسات عن بُعد"
    },
    "Initiate a remote-control session to a device.": {
        "en": "Initiate a remote-control session to a device.",
        "de": "Eine Fernsteuerungssitzung mit einem Gerät starten.",
        "fr": "Lancer une session de contrôle à distance vers un appareil.",
        "es": "Inicia una sesión de control remoto en un dispositivo.",
        "ar-SA": "بدء جلسة تحكم عن بُعد مع جهاز."
    },
    "Join Remote Sessions": {
        "en": "Join Remote Sessions",
        "de": "Remote-Sitzungen beitreten",
        "fr": "Rejoindre des sessions à distance",
        "es": "Unirse a sesiones remotas",
        "ar-SA": "الانضمام إلى الجلسات عن بُعد"
    },
    "Join a session started by someone else.": {
        "en": "Join a session started by someone else.",
        "de": "Einer von jemand anderem gestarteten Sitzung beitreten.",
        "fr": "Rejoindre une session démarrée par quelqu'un d'autre.",
        "es": "Únete a una sesión iniciada por otra persona.",
        "ar-SA": "الانضمام إلى جلسة بدأها شخص آخر."
    },
    "View Session History": {
        "en": "View Session History",
        "de": "Sitzungsverlauf anzeigen",
        "fr": "Afficher l'historique des sessions",
        "es": "Ver historial de sesiones",
        "ar-SA": "عرض سجل الجلسات"
    },
    "See the full remote-session history.": {
        "en": "See the full remote-session history.",
        "de": "Den vollständigen Verlauf der Remote-Sitzungen anzeigen.",
        "fr": "Voir l'historique complet des sessions à distance.",
        "es": "Consulta el historial completo de sesiones remotas.",
        "ar-SA": "عرض السجل الكامل للجلسات عن بُعد."
    },
    "View Recordings": {
        "en": "View Recordings",
        "de": "Aufzeichnungen anzeigen",
        "fr": "Afficher les enregistrements",
        "es": "Ver grabaciones",
        "ar-SA": "عرض التسجيلات"
    },
    "Watch recorded remote sessions.": {
        "en": "Watch recorded remote sessions.",
        "de": "Aufgezeichnete Remote-Sitzungen ansehen.",
        "fr": "Regarder les sessions à distance enregistrées.",
        "es": "Mira sesiones remotas grabadas.",
        "ar-SA": "مشاهدة الجلسات عن بُعد المسجلة."
    },
    "Managing organization members.": {
        "en": "Managing organization members.",
        "de": "Verwaltung der Organisationsmitglieder.",
        "fr": "Gestion des membres de l'organisation.",
        "es": "Gestión de los miembros de la organización.",
        "ar-SA": "إدارة أعضاء المؤسسة."
    },
    "View Members": {
        "en": "View Members",
        "de": "Mitglieder anzeigen",
        "fr": "Afficher les membres",
        "es": "Ver miembros",
        "ar-SA": "عرض الأعضاء"
    },
    "See the list of organization members.": {
        "en": "See the list of organization members.",
        "de": "Die Liste der Organisationsmitglieder anzeigen.",
        "fr": "Voir la liste des membres de l'organisation.",
        "es": "Consulta la lista de miembros de la organización.",
        "ar-SA": "عرض قائمة أعضاء المؤسسة."
    },
    "Invite Members": {
        "en": "Invite Members",
        "de": "Mitglieder einladen",
        "fr": "Inviter des membres",
        "es": "Invitar miembros",
        "ar-SA": "دعوة الأعضاء"
    },
    "Send invitations to new members.": {
        "en": "Send invitations to new members.",
        "de": "Einladungen an neue Mitglieder senden.",
        "fr": "Envoyer des invitations aux nouveaux membres.",
        "es": "Envía invitaciones a nuevos miembros.",
        "ar-SA": "إرسال دعوات إلى أعضاء جدد."
    },
    "Edit Members": {
        "en": "Edit Members",
        "de": "Mitglieder bearbeiten",
        "fr": "Modifier les membres",
        "es": "Editar miembros",
        "ar-SA": "تعديل الأعضاء"
    },
    "Change a member’s access and permissions.": {
        "en": "Change a member’s access and permissions.",
        "de": "Zugriff und Berechtigungen eines Mitglieds ändern.",
        "fr": "Modifier l'accès et les autorisations d'un membre.",
        "es": "Cambia el acceso y los permisos de un miembro.",
        "ar-SA": "تغيير وصول العضو وأذوناته."
    },
    "Remove Members": {
        "en": "Remove Members",
        "de": "Mitglieder entfernen",
        "fr": "Retirer des membres",
        "es": "Quitar miembros",
        "ar-SA": "إزالة الأعضاء"
    },
    "Remove members from the organization.": {
        "en": "Remove members from the organization.",
        "de": "Mitglieder aus der Organisation entfernen.",
        "fr": "Retirer des membres de l'organisation.",
        "es": "Quita miembros de la organización.",
        "ar-SA": "إزالة الأعضاء من المؤسسة."
    },
    "Assign Roles": {
        "en": "Assign Roles",
        "de": "Rollen zuweisen",
        "fr": "Attribuer des rôles",
        "es": "Asignar roles",
        "ar-SA": "تعيين الأدوار"
    },
    "Change a member’s role (Admin / Viewer).": {
        "en": "Change a member’s role (Admin / Viewer).",
        "de": "Die Rolle eines Mitglieds ändern (Administrator / Betrachter).",
        "fr": "Modifier le rôle d'un membre (Administrateur / Lecteur).",
        "es": "Cambia el rol de un miembro (Administrador / Lector).",
        "ar-SA": "تغيير دور العضو (مسؤول / مشاهد)."
    },
    "Plan and billing visibility.": {
        "en": "Plan and billing visibility.",
        "de": "Einsicht in Tarif und Abrechnung.",
        "fr": "Visibilité sur l'abonnement et la facturation.",
        "es": "Visibilidad del plan y la facturación.",
        "ar-SA": "الاطلاع على الخطة والفوترة."
    },
    "View Billing & Plan": {
        "en": "View Billing & Plan",
        "de": "Abrechnung & Tarif anzeigen",
        "fr": "Afficher la facturation et l'abonnement",
        "es": "Ver facturación y plan",
        "ar-SA": "عرض الفوترة والخطة"
    },
    "See the plan, invoices, and license usage.": {
        "en": "See the plan, invoices, and license usage.",
        "de": "Tarif, Rechnungen und Lizenznutzung anzeigen.",
        "fr": "Voir l'abonnement, les factures et l'utilisation des licences.",
        "es": "Consulta el plan, las facturas y el uso de licencias.",
        "ar-SA": "عرض الخطة والفواتير واستخدام التراخيص."
    },
    "Manage Billing": {
        "en": "Manage Billing",
        "de": "Abrechnung verwalten",
        "fr": "Gérer la facturation",
        "es": "Gestionar facturación",
        "ar-SA": "إدارة الفوترة"
    },
    "Change the plan and payment details.": {
        "en": "Change the plan and payment details.",
        "de": "Tarif und Zahlungsdetails ändern.",
        "fr": "Modifier l'abonnement et les informations de paiement.",
        "es": "Cambia el plan y los datos de pago.",
        "ar-SA": "تغيير الخطة وتفاصيل الدفع."
    },
    "Organization-level settings.": {
        "en": "Organization-level settings.",
        "de": "Einstellungen auf Organisationsebene.",
        "fr": "Paramètres au niveau de l'organisation.",
        "es": "Ajustes a nivel de organización.",
        "ar-SA": "إعدادات على مستوى المؤسسة."
    },
    "Organization Settings": {
        "en": "Organization Settings",
        "de": "Organisationseinstellungen",
        "fr": "Paramètres de l'organisation",
        "es": "Ajustes de la organización",
        "ar-SA": "إعدادات المؤسسة"
    },
    "Edit organization name, security, and policies.": {
        "en": "Edit organization name, security, and policies.",
        "de": "Organisationsname, Sicherheit und Richtlinien bearbeiten.",
        "fr": "Modifier le nom, la sécurité et les stratégies de l'organisation.",
        "es": "Edita el nombre, la seguridad y las políticas de la organización.",
        "ar-SA": "تعديل اسم المؤسسة وأمانها وسياساتها."
    },
    "Back To Members": {
        "en": "Back To Members",
        "de": "Zurück zu Mitgliedern",
        "fr": "Retour aux membres",
        "es": "Volver a miembros",
        "ar-SA": "العودة إلى الأعضاء"
    },
    "Copyright 2026 © Remote365. All Rights Reserved.": {
        "en": "Copyright 2026 © Remote365. All Rights Reserved.",
        "de": "Copyright 2026 © Remote365. Alle Rechte vorbehalten.",
        "fr": "Copyright 2026 © Remote365. Tous droits réservés.",
        "es": "Copyright 2026 © Remote365. Todos los derechos reservados.",
        "ar-SA": "حقوق النشر 2026 © Remote365. جميع الحقوق محفوظة."
    },
    "Please enter a password.": {
        "en": "Please enter a password.",
        "de": "Bitte geben Sie ein Passwort ein.",
        "fr": "Veuillez saisir un mot de passe.",
        "es": "Introduce una contraseña.",
        "ar-SA": "يرجى إدخال كلمة مرور."
    },
    "Password must be at least 4 characters.": {
        "en": "Password must be at least 4 characters.",
        "de": "Das Passwort muss mindestens 4 Zeichen lang sein.",
        "fr": "Le mot de passe doit comporter au moins 4 caractères.",
        "es": "La contraseña debe tener al menos 4 caracteres.",
        "ar-SA": "يجب أن تتكون كلمة المرور من 4 أحرف على الأقل."
    },
    "Passwords do not match.": {
        "en": "Passwords do not match.",
        "de": "Die Passwörter stimmen nicht überein.",
        "fr": "Les mots de passe ne correspondent pas.",
        "es": "Las contraseñas no coinciden.",
        "ar-SA": "كلمتا المرور غير متطابقتين."
    },
    "Overview of all archived devices that were migrated with their previous state.": {
        "en": "Overview of all archived devices that were migrated with their previous state.",
        "de": "Übersicht aller archivierten Geräte, die mit ihrem vorherigen Zustand migriert wurden.",
        "fr": "Aperçu de tous les appareils archivés migrés avec leur état précédent.",
        "es": "Resumen de todos los dispositivos archivados que se migraron con su estado anterior.",
        "ar-SA": "نظرة عامة على جميع الأجهزة المؤرشفة التي تم ترحيلها بحالتها السابقة."
    },
    "Search Archived Devices": {
        "en": "Search Archived Devices",
        "de": "Archivierte Geräte durchsuchen",
        "fr": "Rechercher des appareils archivés",
        "es": "Buscar dispositivos archivados",
        "ar-SA": "البحث في الأجهزة المؤرشفة"
    },
    "Control Request": {
        "en": "Control Request",
        "de": "Steuerungsanfrage",
        "fr": "Demande de contrôle",
        "es": "Solicitud de control",
        "ar-SA": "طلب التحكم"
    },
    "Copyright": {
        "en": "Copyright",
        "de": "Urheberrecht",
        "fr": "Droits d'auteur",
        "es": "Derechos de autor",
        "ar-SA": "حقوق النشر"
    },
    "Got It": {
        "en": "Got It",
        "de": "Verstanden",
        "fr": "Compris",
        "es": "Entendido",
        "ar-SA": "حسنًا"
    },
    "Privacy Policy Of Remote365": {
        "en": "Privacy Policy Of Remote365",
        "de": "Datenschutzrichtlinie von Remote365",
        "fr": "Politique de confidentialité de Remote365",
        "es": "Política de privacidad de Remote365",
        "ar-SA": "سياسة الخصوصية لـ Remote365"
    },
    "1. Introduction": {
        "en": "1. Introduction",
        "de": "1. Einleitung",
        "fr": "1. Introduction",
        "es": "1. Introducción",
        "ar-SA": "1. مقدمة"
    },
    "2. Information We Collect": {
        "en": "2. Information We Collect",
        "de": "2. Von uns erfasste Informationen",
        "fr": "2. Informations que nous collectons",
        "es": "2. Información que recopilamos",
        "ar-SA": "2. المعلومات التي نجمعها"
    },
    "3. Remote Sessions & Privacy": {
        "en": "3. Remote Sessions & Privacy",
        "de": "3. Remote-Sitzungen & Datenschutz",
        "fr": "3. Sessions à distance et confidentialité",
        "es": "3. Sesiones remotas y privacidad",
        "ar-SA": "3. الجلسات عن بُعد والخصوصية"
    },
    "4. Cookies & Tracking Technologies": {
        "en": "4. Cookies & Tracking Technologies",
        "de": "4. Cookies & Tracking-Technologien",
        "fr": "4. Cookies et technologies de suivi",
        "es": "4. Cookies y tecnologías de seguimiento",
        "ar-SA": "4. ملفات تعريف الارتباط وتقنيات التتبع"
    },
    "5. Your Privacy Rights": {
        "en": "5. Your Privacy Rights",
        "de": "5. Ihre Datenschutzrechte",
        "fr": "5. Vos droits en matière de confidentialité",
        "es": "5. Tus derechos de privacidad",
        "ar-SA": "5. حقوق الخصوصية الخاصة بك"
    },
    "6. Third-Party Services": {
        "en": "6. Third-Party Services",
        "de": "6. Dienste von Drittanbietern",
        "fr": "6. Services tiers",
        "es": "6. Servicios de terceros",
        "ar-SA": "6. خدمات الجهات الخارجية"
    },
    "7. Contact Us": {
        "en": "7. Contact Us",
        "de": "7. Kontakt",
        "fr": "7. Nous contacter",
        "es": "7. Contáctanos",
        "ar-SA": "7. اتصل بنا"
    },
    "Support Identifier": {
        "en": "Support Identifier",
        "de": "Support-Kennung",
        "fr": "Identifiant d'assistance",
        "es": "Identificador de soporte",
        "ar-SA": "معرّف الدعم"
    },
    "Remote365 Versions": {
        "en": "Remote365 Versions",
        "de": "Remote365-Versionen",
        "fr": "Versions de Remote365",
        "es": "Versiones de Remote365",
        "ar-SA": "إصدارات Remote365"
    },
    "Remote365 Update": {
        "en": "Remote365 Update",
        "de": "Remote365-Update",
        "fr": "Mise à jour de Remote365",
        "es": "Actualización de Remote365",
        "ar-SA": "تحديث Remote365"
    },
    "Don't Ask Again For This Device": {
        "en": "Don't Ask Again For This Device",
        "de": "Für dieses Gerät nicht mehr fragen",
        "fr": "Ne plus demander pour cet appareil",
        "es": "No volver a preguntar para este dispositivo",
        "ar-SA": "عدم السؤال مرة أخرى لهذا الجهاز"
    },
    "Page Tour": {
        "en": "Page Tour",
        "de": "Seitenrundgang",
        "fr": "Visite de la page",
        "es": "Recorrido por la página",
        "ar-SA": "جولة في الصفحة"
    },
    "Skip Tour": {
        "en": "Skip Tour",
        "de": "Rundgang überspringen",
        "fr": "Passer la visite",
        "es": "Omitir recorrido",
        "ar-SA": "تخطي الجولة"
    },
    "End User Home": {
        "en": "End User Home",
        "de": "Endbenutzer-Startseite",
        "fr": "Accueil utilisateur final",
        "es": "Inicio del usuario final",
        "ar-SA": "الصفحة الرئيسية للمستخدم النهائي"
    },
    "Request help, review privacy controls, and end support any time.": {
        "en": "Request help, review privacy controls, and end support any time.",
        "de": "Hilfe anfordern, Datenschutzeinstellungen prüfen und den Support jederzeit beenden.",
        "fr": "Demandez de l'aide, consultez les contrôles de confidentialité et mettez fin à l'assistance à tout moment.",
        "es": "Solicita ayuda, revisa los controles de privacidad y finaliza el soporte en cualquier momento.",
        "ar-SA": "اطلب المساعدة، وراجع عناصر التحكم في الخصوصية، وأنهِ الدعم في أي وقت."
    },
    "Before A Session": {
        "en": "Before A Session",
        "de": "Vor einer Sitzung",
        "fr": "Avant une session",
        "es": "Antes de una sesión",
        "ar-SA": "قبل الجلسة"
    },
    "The technician can see your screen, control your computer, and transfer files after you approve the support request.": {
        "en": "The technician can see your screen, control your computer, and transfer files after you approve the support request.",
        "de": "Nachdem Sie die Supportanfrage genehmigt haben, kann der Techniker Ihren Bildschirm sehen, Ihren Computer steuern und Dateien übertragen.",
        "fr": "Une fois la demande d'assistance approuvée, le technicien peut voir votre écran, contrôler votre ordinateur et transférer des fichiers.",
        "es": "Cuando apruebes la solicitud de soporte, el técnico podrá ver tu pantalla, controlar tu equipo y transferir archivos.",
        "ar-SA": "بعد موافقتك على طلب الدعم، يمكن للفني رؤية شاشتك والتحكم في جهاز الكمبيوتر ونقل الملفات."
    },
    "You can end the session at any time. Recording must be visible while active.": {
        "en": "You can end the session at any time. Recording must be visible while active.",
        "de": "Sie können die Sitzung jederzeit beenden. Eine aktive Aufzeichnung muss sichtbar sein.",
        "fr": "Vous pouvez mettre fin à la session à tout moment. L'enregistrement doit être visible lorsqu'il est actif.",
        "es": "Puedes finalizar la sesión en cualquier momento. La grabación debe ser visible mientras esté activa.",
        "ar-SA": "يمكنك إنهاء الجلسة في أي وقت. يجب أن يكون التسجيل مرئيًا أثناء تشغيله."
    },
    "Support Request Active": {
        "en": "Support Request Active",
        "de": "Supportanfrage aktiv",
        "fr": "Demande d'assistance active",
        "es": "Solicitud de soporte activa",
        "ar-SA": "طلب الدعم نشط"
    },
    "Pause Sharing": {
        "en": "Pause Sharing",
        "de": "Freigabe pausieren",
        "fr": "Suspendre le partage",
        "es": "Pausar uso compartido",
        "ar-SA": "إيقاف المشاركة مؤقتًا"
    },
    "End Session": {
        "en": "End Session",
        "de": "Sitzung beenden",
        "fr": "Terminer la session",
        "es": "Finalizar sesión",
        "ar-SA": "إنهاء الجلسة"
    },
    "Recent Help Sessions": {
        "en": "Recent Help Sessions",
        "de": "Letzte Hilfesitzungen",
        "fr": "Sessions d'aide récentes",
        "es": "Sesiones de ayuda recientes",
        "ar-SA": "جلسات المساعدة الأخيرة"
    },
    "No completed support sessions yet.": {
        "en": "No completed support sessions yet.",
        "de": "Noch keine abgeschlossenen Supportsitzungen.",
        "fr": "Aucune session d'assistance terminée pour l'instant.",
        "es": "Aún no hay sesiones de soporte completadas.",
        "ar-SA": "لا توجد جلسات دعم مكتملة بعد."
    },
    "Support Request Resolved": {
        "en": "Support Request Resolved",
        "de": "Supportanfrage gelöst",
        "fr": "Demande d'assistance résolue",
        "es": "Solicitud de soporte resuelta",
        "ar-SA": "تم حل طلب الدعم"
    },
    "Your support request has been resolved by a technician. Please review and confirm that the issue has been fixed.": {
        "en": "Your support request has been resolved by a technician. Please review and confirm that the issue has been fixed.",
        "de": "Ihre Supportanfrage wurde von einem Techniker gelöst. Bitte prüfen und bestätigen Sie, dass das Problem behoben wurde.",
        "fr": "Votre demande d'assistance a été résolue par un technicien. Veuillez vérifier et confirmer que le problème est corrigé.",
        "es": "Un técnico ha resuelto tu solicitud de soporte. Revisa y confirma que el problema se ha solucionado.",
        "ar-SA": "تم حل طلب الدعم الخاص بك بواسطة فني. يرجى المراجعة والتأكيد على إصلاح المشكلة."
    },
    "Show in folder": {
        "en": "Show in folder",
        "de": "Im Ordner anzeigen",
        "fr": "Afficher dans le dossier",
        "es": "Mostrar en la carpeta",
        "ar-SA": "إظهار في المجلد"
    },
    "Need IT Help?": {
        "en": "Need IT Help?",
        "de": "Benötigen Sie IT-Hilfe?",
        "fr": "Besoin d'aide informatique ?",
        "es": "¿Necesitas ayuda de TI?",
        "ar-SA": "هل تحتاج إلى مساعدة تقنية؟"
    },
    "Generate a temporary support code for a technician.": {
        "en": "Generate a temporary support code for a technician.",
        "de": "Einen temporären Supportcode für einen Techniker erstellen.",
        "fr": "Générer un code d'assistance temporaire pour un technicien.",
        "es": "Genera un código de soporte temporal para un técnico.",
        "ar-SA": "إنشاء رمز دعم مؤقت للفني."
    },
    "9-Digit Code": {
        "en": "9-Digit Code",
        "de": "9-stelliger Code",
        "fr": "Code à 9 chiffres",
        "es": "Código de 9 dígitos",
        "ar-SA": "رمز من 9 أرقام"
    },
    "PIN": {
        "en": "PIN",
        "de": "PIN",
        "fr": "PIN",
        "es": "PIN",
        "ar-SA": "رمز PIN"
    },
    "Copy Code": {
        "en": "Copy Code",
        "de": "Code kopieren",
        "fr": "Copier le code",
        "es": "Copiar código",
        "ar-SA": "نسخ الرمز"
    },
    "Cancel Request": {
        "en": "Cancel Request",
        "de": "Anfrage abbrechen",
        "fr": "Annuler la demande",
        "es": "Cancelar solicitud",
        "ar-SA": "إلغاء الطلب"
    },
    "Select Device": {
        "en": "Select Device",
        "de": "Gerät auswählen",
        "fr": "Sélectionner un appareil",
        "es": "Seleccionar dispositivo",
        "ar-SA": "تحديد الجهاز"
    },
    "Select Technician": {
        "en": "Select Technician",
        "de": "Techniker auswählen",
        "fr": "Sélectionner un technicien",
        "es": "Seleccionar técnico",
        "ar-SA": "تحديد الفني"
    },
    "Device Issue": {
        "en": "Device Issue",
        "de": "Geräteproblem",
        "fr": "Problème d'appareil",
        "es": "Problema del dispositivo",
        "ar-SA": "مشكلة في الجهاز"
    },
    "Remote Access Issue": {
        "en": "Remote Access Issue",
        "de": "Problem mit dem Fernzugriff",
        "fr": "Problème d'accès à distance",
        "es": "Problema de acceso remoto",
        "ar-SA": "مشكلة في الوصول عن بُعد"
    },
    "Performance Issue": {
        "en": "Performance Issue",
        "de": "Leistungsproblem",
        "fr": "Problème de performances",
        "es": "Problema de rendimiento",
        "ar-SA": "مشكلة في الأداء"
    },
    "Software Issue": {
        "en": "Software Issue",
        "de": "Softwareproblem",
        "fr": "Problème logiciel",
        "es": "Problema de software",
        "ar-SA": "مشكلة في البرامج"
    },
    "Tell the technician what is wrong with this device...": {
        "en": "Tell the technician what is wrong with this device...",
        "de": "Beschreiben Sie dem Techniker, was mit diesem Gerät nicht stimmt...",
        "fr": "Indiquez au technicien le problème de cet appareil...",
        "es": "Cuéntale al técnico qué le pasa a este dispositivo...",
        "ar-SA": "أخبر الفني بما يعانيه هذا الجهاز..."
    },
    "Waiting For Someone To Join": {
        "en": "Waiting For Someone To Join",
        "de": "Warten auf Teilnehmer",
        "fr": "En attente d'un participant",
        "es": "Esperando a que alguien se una",
        "ar-SA": "في انتظار انضمام أحد"
    },
    "Copy Session ID": {
        "en": "Copy Session ID",
        "de": "Sitzungs-ID kopieren",
        "fr": "Copier l'ID de session",
        "es": "Copiar ID de sesión",
        "ar-SA": "نسخ ID الجلسة"
    },
    "Rate Support Session": {
        "en": "Rate Support Session",
        "de": "Supportsitzung bewerten",
        "fr": "Évaluer la session d'assistance",
        "es": "Valorar sesión de soporte",
        "ar-SA": "تقييم جلسة الدعم"
    },
    "Submit Rating": {
        "en": "Submit Rating",
        "de": "Bewertung senden",
        "fr": "Envoyer l'évaluation",
        "es": "Enviar valoración",
        "ar-SA": "إرسال التقييم"
    },
    "Optional Comment...": {
        "en": "Optional Comment...",
        "de": "Optionaler Kommentar...",
        "fr": "Commentaire facultatif...",
        "es": "Comentario opcional...",
        "ar-SA": "تعليق اختياري..."
    },
    "Exit Full Screen": {
        "en": "Exit Full Screen",
        "de": "Vollbild beenden",
        "fr": "Quitter le plein écran",
        "es": "Salir de pantalla completa",
        "ar-SA": "الخروج من ملء الشاشة"
    },
    "Disconnect": {
        "en": "Disconnect",
        "de": "Trennen",
        "fr": "Déconnecter",
        "es": "Desconectar",
        "ar-SA": "قطع الاتصال"
    },
    "Recording Ready": {
        "en": "Recording Ready",
        "de": "Aufzeichnung bereit",
        "fr": "Enregistrement prêt",
        "es": "Grabación lista",
        "ar-SA": "التسجيل جاهز"
    },
    "Save Recording": {
        "en": "Save Recording",
        "de": "Aufzeichnung speichern",
        "fr": "Enregistrer l'enregistrement",
        "es": "Guardar grabación",
        "ar-SA": "حفظ التسجيل"
    },
    "Refreshing Screen…": {
        "en": "Refreshing Screen…",
        "de": "Bildschirm wird aktualisiert…",
        "fr": "Actualisation de l'écran…",
        "es": "Actualizando pantalla…",
        "ar-SA": "جارٍ تحديث الشاشة…"
    },
    "Participants": {
        "en": "Participants",
        "de": "Teilnehmer",
        "fr": "Participants",
        "es": "Participantes",
        "ar-SA": "المشاركون"
    },
    "Host - Sharing Screen": {
        "en": "Host - Sharing Screen",
        "de": "Host - teilt Bildschirm",
        "fr": "Hôte - partage l'écran",
        "es": "Anfitrión - compartiendo pantalla",
        "ar-SA": "المضيف - يشارك الشاشة"
    },
    "Session Notes": {
        "en": "Session Notes",
        "de": "Sitzungsnotizen",
        "fr": "Notes de session",
        "es": "Notas de la sesión",
        "ar-SA": "ملاحظات الجلسة"
    },
    "Saved Automatically": {
        "en": "Saved Automatically",
        "de": "Automatisch gespeichert",
        "fr": "Enregistré automatiquement",
        "es": "Guardado automáticamente",
        "ar-SA": "يُحفظ تلقائيًا"
    },
    "Connection Info": {
        "en": "Connection Info",
        "de": "Verbindungsinfo",
        "fr": "Infos de connexion",
        "es": "Información de conexión",
        "ar-SA": "معلومات الاتصال"
    },
    "Round-Trip Time": {
        "en": "Round-Trip Time",
        "de": "Round-Trip-Zeit",
        "fr": "Temps aller-retour",
        "es": "Tiempo de ida y vuelta",
        "ar-SA": "زمن الذهاب والإياب"
    },
    "Packet Loss": {
        "en": "Packet Loss",
        "de": "Paketverlust",
        "fr": "Perte de paquets",
        "es": "Pérdida de paquetes",
        "ar-SA": "فقدان الحزم"
    },
    "Decoded FPS": {
        "en": "Decoded FPS",
        "de": "Decodierte FPS",
        "fr": "FPS décodés",
        "es": "FPS decodificados",
        "ar-SA": "FPS المفكوكة"
    },
    "Quality Mode": {
        "en": "Quality Mode",
        "de": "Qualitätsmodus",
        "fr": "Mode de qualité",
        "es": "Modo de calidad",
        "ar-SA": "وضع الجودة"
    },
    "Display Mode": {
        "en": "Display Mode",
        "de": "Anzeigemodus",
        "fr": "Mode d'affichage",
        "es": "Modo de visualización",
        "ar-SA": "وضع العرض"
    },
    "Waiting for the first stats sample…": {
        "en": "Waiting for the first stats sample…",
        "de": "Warten auf die ersten Statistikdaten…",
        "fr": "En attente du premier échantillon de statistiques…",
        "es": "Esperando la primera muestra de estadísticas…",
        "ar-SA": "في انتظار أول عينة من الإحصائيات…"
    },
    "Boost Connection": {
        "en": "Boost Connection",
        "de": "Verbindung verbessern",
        "fr": "Optimiser la connexion",
        "es": "Mejorar conexión",
        "ar-SA": "تعزيز الاتصال"
    },
    "Session Recap": {
        "en": "Session Recap",
        "de": "Sitzungsübersicht",
        "fr": "Récapitulatif de la session",
        "es": "Resumen de la sesión",
        "ar-SA": "ملخص الجلسة"
    },
    "A running log of what happened this session — share it with a teammate.": {
        "en": "A running log of what happened this session — share it with a teammate.",
        "de": "Ein fortlaufendes Protokoll dieser Sitzung — teilen Sie es mit einem Teammitglied.",
        "fr": "Un journal en continu de cette session — partagez-le avec un coéquipier.",
        "es": "Un registro continuo de lo ocurrido en esta sesión — compártelo con un compañero.",
        "ar-SA": "سجل مستمر لما حدث في هذه الجلسة — شاركه مع أحد زملائك."
    },
    "Nothing logged yet — actions like screenshots, recordings, and macros will show up here.": {
        "en": "Nothing logged yet — actions like screenshots, recordings, and macros will show up here.",
        "de": "Noch nichts protokolliert — Aktionen wie Screenshots, Aufzeichnungen und Makros werden hier angezeigt.",
        "fr": "Rien d'enregistré pour l'instant — les actions comme les captures d'écran, les enregistrements et les macros apparaîtront ici.",
        "es": "Aún no hay nada registrado — aquí aparecerán acciones como capturas de pantalla, grabaciones y macros.",
        "ar-SA": "لم يُسجَّل شيء بعد — ستظهر هنا إجراءات مثل لقطات الشاشة والتسجيلات ووحدات الماكرو."
    },
    "Local To This Device Only": {
        "en": "Local To This Device Only",
        "de": "Nur lokal auf diesem Gerät",
        "fr": "Local à cet appareil uniquement",
        "es": "Solo local en este dispositivo",
        "ar-SA": "محلي على هذا الجهاز فقط"
    },
    "Disconnect Session?": {
        "en": "Disconnect Session?",
        "de": "Sitzung trennen?",
        "fr": "Déconnecter la session ?",
        "es": "¿Desconectar sesión?",
        "ar-SA": "قطع اتصال الجلسة؟"
    },
    "Safe Reboot": {
        "en": "Safe Reboot",
        "de": "Sicherer Neustart",
        "fr": "Redémarrage sécurisé",
        "es": "Reinicio seguro",
        "ar-SA": "إعادة تشغيل آمنة"
    },
    "The remote computer is going to reboot after a short grace period. If you want to prevent the computer from rebooting click Cancel.": {
        "en": "The remote computer is going to reboot after a short grace period. If you want to prevent the computer from rebooting click Cancel.",
        "de": "Der Remote-Computer wird nach einer kurzen Wartezeit neu gestartet. Klicken Sie auf Abbrechen, um den Neustart zu verhindern.",
        "fr": "L'ordinateur distant va redémarrer après un court délai. Pour empêcher le redémarrage, cliquez sur Annuler.",
        "es": "El equipo remoto se reiniciará tras un breve periodo de espera. Si quieres evitar el reinicio, haz clic en Cancelar.",
        "ar-SA": "ستتم إعادة تشغيل الكمبيوتر البعيد بعد مهلة قصيرة. إذا أردت منع إعادة التشغيل، فانقر على إلغاء."
    },
    "Restarts the remote computer after 15 seconds so apps can react first.": {
        "en": "Restarts the remote computer after 15 seconds so apps can react first.",
        "de": "Startet den Remote-Computer nach 15 Sekunden neu, damit Apps zuerst reagieren können.",
        "fr": "Redémarre l'ordinateur distant après 15 secondes pour laisser les applications réagir.",
        "es": "Reinicia el equipo remoto tras 15 segundos para que las aplicaciones puedan reaccionar antes.",
        "ar-SA": "يعيد تشغيل الكمبيوتر البعيد بعد 15 ثانية حتى تتمكن التطبيقات من الاستجابة أولاً."
    },
    "Sign Out Remote Computer": {
        "en": "Sign Out Remote Computer",
        "de": "Remote-Computer abmelden",
        "fr": "Déconnecter l'ordinateur distant",
        "es": "Cerrar sesión en el equipo remoto",
        "ar-SA": "تسجيل الخروج من الكمبيوتر البعيد"
    },
    "The current Windows user on the remote computer is going to be signed out. If you want to prevent this action click Cancel.": {
        "en": "The current Windows user on the remote computer is going to be signed out. If you want to prevent this action click Cancel.",
        "de": "Der aktuelle Windows-Benutzer auf dem Remote-Computer wird abgemeldet. Klicken Sie auf Abbrechen, um dies zu verhindern.",
        "fr": "L'utilisateur Windows actuel de l'ordinateur distant va être déconnecté. Pour empêcher cette action, cliquez sur Annuler.",
        "es": "Se cerrará la sesión del usuario actual de Windows en el equipo remoto. Si quieres evitarlo, haz clic en Cancelar.",
        "ar-SA": "سيتم تسجيل خروج مستخدم Windows الحالي على الكمبيوتر البعيد. إذا أردت منع هذا الإجراء، فانقر على إلغاء."
    },
    "Signs out the remote Windows user and ends their desktop session.": {
        "en": "Signs out the remote Windows user and ends their desktop session.",
        "de": "Meldet den Windows-Benutzer auf dem Remote-Computer ab und beendet dessen Desktopsitzung.",
        "fr": "Déconnecte l'utilisateur Windows distant et met fin à sa session de bureau.",
        "es": "Cierra la sesión del usuario remoto de Windows y finaliza su sesión de escritorio.",
        "ar-SA": "يسجّل خروج مستخدم Windows البعيد وينهي جلسة سطح المكتب الخاصة به."
    },
    "Paste Clipboard As Key Strokes": {
        "en": "Paste Clipboard As Key Strokes",
        "de": "Zwischenablage als Tastenanschläge einfügen",
        "fr": "Coller le presse-papiers sous forme de frappes",
        "es": "Pegar portapapeles como pulsaciones de teclas",
        "ar-SA": "لصق الحافظة كضغطات مفاتيح"
    },
    "Sync Clipboard Automatically": {
        "en": "Sync Clipboard Automatically",
        "de": "Zwischenablage automatisch synchronisieren",
        "fr": "Synchroniser automatiquement le presse-papiers",
        "es": "Sincronizar portapapeles automáticamente",
        "ar-SA": "مزامنة الحافظة تلقائيًا"
    },
    "Best Fit": {
        "en": "Best Fit",
        "de": "Optimale Anpassung",
        "fr": "Ajustement optimal",
        "es": "Mejor ajuste",
        "ar-SA": "أفضل ملاءمة"
    },
    "Original": {
        "en": "Original",
        "de": "Original",
        "fr": "Original",
        "es": "Original",
        "ar-SA": "الأصلي"
    },
    "Scaled": {
        "en": "Scaled",
        "de": "Skaliert",
        "fr": "Mis à l'échelle",
        "es": "Escalado",
        "ar-SA": "مُحجَّم"
    },
    "Auto Select": {
        "en": "Auto Select",
        "de": "Automatisch wählen",
        "fr": "Sélection automatique",
        "es": "Selección automática",
        "ar-SA": "تحديد تلقائي"
    },
    "Optimal Speed": {
        "en": "Optimal Speed",
        "de": "Optimale Geschwindigkeit",
        "fr": "Vitesse optimale",
        "es": "Velocidad óptima",
        "ar-SA": "السرعة المثلى"
    },
    "Optimal Quality": {
        "en": "Optimal Quality",
        "de": "Optimale Qualität",
        "fr": "Qualité optimale",
        "es": "Calidad óptima",
        "ar-SA": "الجودة المثلى"
    },
    "Refresh Screen": {
        "en": "Refresh Screen",
        "de": "Bildschirm aktualisieren",
        "fr": "Actualiser l'écran",
        "es": "Actualizar pantalla",
        "ar-SA": "تحديث الشاشة"
    },
    "Rotate Screen": {
        "en": "Rotate Screen",
        "de": "Bildschirm drehen",
        "fr": "Faire pivoter l'écran",
        "es": "Girar pantalla",
        "ar-SA": "تدوير الشاشة"
    },
    "Rotate Left": {
        "en": "Rotate Left",
        "de": "Nach links drehen",
        "fr": "Pivoter à gauche",
        "es": "Girar a la izquierda",
        "ar-SA": "تدوير لليسار"
    },
    "Rotate Right": {
        "en": "Rotate Right",
        "de": "Nach rechts drehen",
        "fr": "Pivoter à droite",
        "es": "Girar a la derecha",
        "ar-SA": "تدوير لليمين"
    },
    "Portrait": {
        "en": "Portrait",
        "de": "Hochformat",
        "fr": "Portrait",
        "es": "Vertical",
        "ar-SA": "عمودي"
    },
    "Landscape": {
        "en": "Landscape",
        "de": "Querformat",
        "fr": "Paysage",
        "es": "Horizontal",
        "ar-SA": "أفقي"
    },
    "Auto-Rotate": {
        "en": "Auto-Rotate",
        "de": "Automatisch drehen",
        "fr": "Rotation automatique",
        "es": "Girar automáticamente",
        "ar-SA": "تدوير تلقائي"
    },
    "Connectivity": {
        "en": "Connectivity",
        "de": "Konnektivität",
        "fr": "Connectivité",
        "es": "Conectividad",
        "ar-SA": "الاتصال"
    },
    "Wi-Fi": {
        "en": "Wi-Fi",
        "de": "WLAN",
        "fr": "Wi-Fi",
        "es": "Wi-Fi",
        "ar-SA": "Wi-Fi"
    },
    "Mobile Data": {
        "en": "Mobile Data",
        "de": "Mobile Daten",
        "fr": "Données mobiles",
        "es": "Datos móviles",
        "ar-SA": "بيانات الجوال"
    },
    "Wi-Fi Calling": {
        "en": "Wi-Fi Calling",
        "de": "WLAN-Anrufe",
        "fr": "Appels Wi-Fi",
        "es": "Llamadas por Wi-Fi",
        "ar-SA": "الاتصال عبر Wi-Fi"
    },
    "Airplane Mode": {
        "en": "Airplane Mode",
        "de": "Flugmodus",
        "fr": "Mode avion",
        "es": "Modo avión",
        "ar-SA": "وضع الطيران"
    },
    "Minimize Remote365 Window": {
        "en": "Minimize Remote365 Window",
        "de": "Remote365-Fenster minimieren",
        "fr": "Réduire la fenêtre Remote365",
        "es": "Minimizar ventana de Remote365",
        "ar-SA": "تصغير نافذة Remote365"
    },
    "Lock Now": {
        "en": "Lock Now",
        "de": "Jetzt sperren",
        "fr": "Verrouiller maintenant",
        "es": "Bloquear ahora",
        "ar-SA": "القفل الآن"
    },
    "Lock On Session End": {
        "en": "Lock On Session End",
        "de": "Bei Sitzungsende sperren",
        "fr": "Verrouiller à la fin de la session",
        "es": "Bloquear al finalizar la sesión",
        "ar-SA": "القفل عند انتهاء الجلسة"
    },
    "Sign Out On Remote Computer": {
        "en": "Sign Out On Remote Computer",
        "de": "Auf Remote-Computer abmelden",
        "fr": "Se déconnecter de l'ordinateur distant",
        "es": "Cerrar sesión en el equipo remoto",
        "ar-SA": "تسجيل الخروج على الكمبيوتر البعيد"
    },
    "Restart Device": {
        "en": "Restart Device",
        "de": "Gerät neu starten",
        "fr": "Redémarrer l'appareil",
        "es": "Reiniciar dispositivo",
        "ar-SA": "إعادة تشغيل الجهاز"
    },
    "15s grace": {
        "en": "15s grace",
        "de": "15 s Wartezeit",
        "fr": "délai de 15 s",
        "es": "15 s de espera",
        "ar-SA": "مهلة 15 ث"
    },
    "Send Ctrl + Alt + Del": {
        "en": "Send Ctrl + Alt + Del",
        "de": "Strg + Alt + Entf senden",
        "fr": "Envoyer Ctrl + Alt + Suppr",
        "es": "Enviar Ctrl + Alt + Supr",
        "ar-SA": "إرسال Ctrl + Alt + Del"
    },
    "Direct Keyboard Mode": {
        "en": "Direct Keyboard Mode",
        "de": "Direkter Tastaturmodus",
        "fr": "Mode clavier direct",
        "es": "Modo de teclado directo",
        "ar-SA": "وضع لوحة المفاتيح المباشر"
    },
    "Send System Keys To Remote": {
        "en": "Send System Keys To Remote",
        "de": "Systemtasten an Remote senden",
        "fr": "Envoyer les touches système à l'ordinateur distant",
        "es": "Enviar teclas del sistema al equipo remoto",
        "ar-SA": "إرسال مفاتيح النظام إلى الجهاز البعيد"
    },
    "Collaboration": {
        "en": "Collaboration",
        "de": "Zusammenarbeit",
        "fr": "Collaboration",
        "es": "Colaboración",
        "ar-SA": "التعاون"
    },
    "Show Participants": {
        "en": "Show Participants",
        "de": "Teilnehmer anzeigen",
        "fr": "Afficher les participants",
        "es": "Mostrar participantes",
        "ar-SA": "إظهار المشاركين"
    },
    "Show your face on the remote machine": {
        "en": "Show your face on the remote machine",
        "de": "Ihr Gesicht auf dem Remote-Computer anzeigen",
        "fr": "Afficher votre visage sur la machine distante",
        "es": "Mostrar tu cara en el equipo remoto",
        "ar-SA": "إظهار وجهك على الجهاز البعيد"
    },
    "Tools": {
        "en": "Tools",
        "de": "Werkzeuge",
        "fr": "Outils",
        "es": "Herramientas",
        "ar-SA": "الأدوات"
    },
    "Leave Notes": {
        "en": "Leave Notes",
        "de": "Notizen hinterlassen",
        "fr": "Laisser des notes",
        "es": "Dejar notas",
        "ar-SA": "ترك ملاحظات"
    },
    "Clipboard": {
        "en": "Clipboard",
        "de": "Zwischenablage",
        "fr": "Presse-papiers",
        "es": "Portapapeles",
        "ar-SA": "الحافظة"
    },
    "Send files": {
        "en": "Send files",
        "de": "Dateien senden",
        "fr": "Envoyer des fichiers",
        "es": "Enviar archivos",
        "ar-SA": "إرسال الملفات"
    },
    "Get files": {
        "en": "Get files",
        "de": "Dateien abrufen",
        "fr": "Récupérer des fichiers",
        "es": "Obtener archivos",
        "ar-SA": "جلب الملفات"
    },
    "Whiteboard": {
        "en": "Whiteboard",
        "de": "Whiteboard",
        "fr": "Tableau blanc",
        "es": "Pizarra",
        "ar-SA": "السبورة البيضاء"
    },
    "Take Screenshot": {
        "en": "Take Screenshot",
        "de": "Screenshot erstellen",
        "fr": "Prendre une capture d'écran",
        "es": "Hacer captura de pantalla",
        "ar-SA": "التقاط لقطة شاشة"
    },
    "Command Deck": {
        "en": "Command Deck",
        "de": "Befehlszentrale",
        "fr": "Centre de commandes",
        "es": "Panel de comandos",
        "ar-SA": "لوحة الأوامر"
    },
    "Web Browser": {
        "en": "Web Browser",
        "de": "Webbrowser",
        "fr": "Navigateur web",
        "es": "Navegador web",
        "ar-SA": "متصفح الويب"
    },
    "Home Screen": {
        "en": "Home Screen",
        "de": "Startbildschirm",
        "fr": "Écran d'accueil",
        "es": "Pantalla de inicio",
        "ar-SA": "الشاشة الرئيسية"
    },
    "Scaling": {
        "en": "Scaling",
        "de": "Skalierung",
        "fr": "Mise à l'échelle",
        "es": "Escalado",
        "ar-SA": "التحجيم"
    },
    "Fit To Screen": {
        "en": "Fit To Screen",
        "de": "An Bildschirm anpassen",
        "fr": "Ajuster à l'écran",
        "es": "Ajustar a la pantalla",
        "ar-SA": "ملاءمة للشاشة"
    },
    "Fill Screen": {
        "en": "Fill Screen",
        "de": "Bildschirm füllen",
        "fr": "Remplir l'écran",
        "es": "Llenar pantalla",
        "ar-SA": "ملء الشاشة"
    },
    "Actual Size": {
        "en": "Actual Size",
        "de": "Originalgröße",
        "fr": "Taille réelle",
        "es": "Tamaño real",
        "ar-SA": "الحجم الفعلي"
    },
    "Ctrl+Shift+Esc": {
        "en": "Ctrl+Shift+Esc",
        "de": "Strg+Umschalt+Esc",
        "fr": "Ctrl+Maj+Échap",
        "es": "Ctrl+Mayús+Esc",
        "ar-SA": "Ctrl+Shift+Esc"
    },
    "Switch Window": {
        "en": "Switch Window",
        "de": "Fenster wechseln",
        "fr": "Changer de fenêtre",
        "es": "Cambiar de ventana",
        "ar-SA": "تبديل النافذة"
    },
    "Ask the person at the remote PC to allow keyboard and mouse": {
        "en": "Ask the person at the remote PC to allow keyboard and mouse",
        "de": "Bitten Sie die Person am Remote-PC, Tastatur und Maus zuzulassen",
        "fr": "Demandez à la personne sur le PC distant d'autoriser le clavier et la souris",
        "es": "Pide a la persona del PC remoto que permita el teclado y el ratón",
        "ar-SA": "اطلب من الشخص على الكمبيوتر البعيد السماح بلوحة المفاتيح والماوس"
    },
    "Discard Recording": {
        "en": "Discard Recording",
        "de": "Aufzeichnung verwerfen",
        "fr": "Supprimer l'enregistrement",
        "es": "Descartar grabación",
        "ar-SA": "تجاهل التسجيل"
    },
    "Type Text…": {
        "en": "Type Text…",
        "de": "Text eingeben…",
        "fr": "Saisir du texte…",
        "es": "Escribe texto…",
        "ar-SA": "اكتب نصًا…"
    },
    "Pen": {
        "en": "Pen",
        "de": "Stift",
        "fr": "Stylo",
        "es": "Lápiz",
        "ar-SA": "قلم"
    },
    "Marker": {
        "en": "Marker",
        "de": "Marker",
        "fr": "Surligneur",
        "es": "Marcador",
        "ar-SA": "قلم تحديد"
    },
    "Eraser": {
        "en": "Eraser",
        "de": "Radierer",
        "fr": "Gomme",
        "es": "Borrador",
        "ar-SA": "ممحاة"
    },
    "Rectangle": {
        "en": "Rectangle",
        "de": "Rechteck",
        "fr": "Rectangle",
        "es": "Rectángulo",
        "ar-SA": "مستطيل"
    },
    "Circle": {
        "en": "Circle",
        "de": "Kreis",
        "fr": "Cercle",
        "es": "Círculo",
        "ar-SA": "دائرة"
    },
    "Share Your Camera": {
        "en": "Share Your Camera",
        "de": "Kamera freigeben",
        "fr": "Partager votre caméra",
        "es": "Compartir tu cámara",
        "ar-SA": "مشاركة الكاميرا"
    },
    "Type Your Notes…": {
        "en": "Type Your Notes…",
        "de": "Notizen eingeben…",
        "fr": "Saisissez vos notes…",
        "es": "Escribe tus notas…",
        "ar-SA": "اكتب ملاحظاتك…"
    },
    "Type A Message…": {
        "en": "Type A Message…",
        "de": "Nachricht eingeben…",
        "fr": "Saisissez un message…",
        "es": "Escribe un mensaje…",
        "ar-SA": "اكتب رسالة…"
    },
    "Hide Toolbar": {
        "en": "Hide Toolbar",
        "de": "Symbolleiste ausblenden",
        "fr": "Masquer la barre d'outils",
        "es": "Ocultar barra de herramientas",
        "ar-SA": "إخفاء شريط الأدوات"
    },
    "Show Toolbar": {
        "en": "Show Toolbar",
        "de": "Symbolleiste einblenden",
        "fr": "Afficher la barre d'outils",
        "es": "Mostrar barra de herramientas",
        "ar-SA": "إظهار شريط الأدوات"
    },
    "Close Disconnect Confirmation": {
        "en": "Close Disconnect Confirmation",
        "de": "Trennbestätigung schließen",
        "fr": "Fermer la confirmation de déconnexion",
        "es": "Cerrar confirmación de desconexión",
        "ar-SA": "إغلاق تأكيد قطع الاتصال"
    },
    "Screen Recording Started": {
        "en": "Screen Recording Started",
        "de": "Bildschirmaufzeichnung gestartet",
        "fr": "Enregistrement de l'écran démarré",
        "es": "Grabación de pantalla iniciada",
        "ar-SA": "بدأ تسجيل الشاشة"
    },
    "Scripts": {
        "en": "Scripts",
        "de": "Skripte",
        "fr": "Scripts",
        "es": "Scripts",
        "ar-SA": "البرامج النصية"
    },
    "Run": {
        "en": "Run",
        "de": "Ausführen",
        "fr": "Exécuter",
        "es": "Ejecutar",
        "ar-SA": "تشغيل"
    },
    "Technician Tools": {
        "en": "Technician Tools",
        "de": "Techniker-Tools",
        "fr": "Outils du technicien",
        "es": "Herramientas del técnico",
        "ar-SA": "أدوات الفني"
    },
    "Recording Visible To Customer": {
        "en": "Recording Visible To Customer",
        "de": "Aufzeichnung für Kunden sichtbar",
        "fr": "Enregistrement visible par le client",
        "es": "Grabación visible para el cliente",
        "ar-SA": "التسجيل مرئي للعميل"
    },
    "Send File": {
        "en": "Send File",
        "de": "Datei senden",
        "fr": "Envoyer un fichier",
        "es": "Enviar archivo",
        "ar-SA": "إرسال ملف"
    },
    "Lock Screen": {
        "en": "Lock Screen",
        "de": "Bildschirm sperren",
        "fr": "Verrouiller l'écran",
        "es": "Bloquear pantalla",
        "ar-SA": "قفل الشاشة"
    },
    "Ctrl+Alt+Del": {
        "en": "Ctrl+Alt+Del",
        "de": "Strg+Alt+Entf",
        "fr": "Ctrl+Alt+Suppr",
        "es": "Ctrl+Alt+Supr",
        "ar-SA": "Ctrl+Alt+Del"
    },
    "Invite Tech": {
        "en": "Invite Tech",
        "de": "Techniker einladen",
        "fr": "Inviter un technicien",
        "es": "Invitar técnico",
        "ar-SA": "دعوة فني"
    },
    "Select A Session From The Queue": {
        "en": "Select A Session From The Queue",
        "de": "Wählen Sie eine Sitzung aus der Warteschlange",
        "fr": "Sélectionnez une session dans la file d'attente",
        "es": "Selecciona una sesión de la cola",
        "ar-SA": "حدد جلسة من قائمة الانتظار"
    },
    "Customer profile, notes, chat, system information, and history will appear here.": {
        "en": "Customer profile, notes, chat, system information, and history will appear here.",
        "de": "Kundenprofil, Notizen, Chat, Systeminformationen und Verlauf werden hier angezeigt.",
        "fr": "Le profil du client, les notes, le chat, les informations système et l'historique apparaîtront ici.",
        "es": "Aquí aparecerán el perfil del cliente, las notas, el chat, la información del sistema y el historial.",
        "ar-SA": "سيظهر هنا ملف العميل والملاحظات والدردشة ومعلومات النظام والسجل."
    },
    "Mark As Done": {
        "en": "Mark As Done",
        "de": "Als erledigt markieren",
        "fr": "Marquer comme terminé",
        "es": "Marcar como hecho",
        "ar-SA": "وضع علامة كمنجز"
    },
    "Issue Type": {
        "en": "Issue Type",
        "de": "Problemtyp",
        "fr": "Type de problème",
        "es": "Tipo de problema",
        "ar-SA": "نوع المشكلة"
    },
    "Customer Issue": {
        "en": "Customer Issue",
        "de": "Kundenproblem",
        "fr": "Problème du client",
        "es": "Problema del cliente",
        "ar-SA": "مشكلة العميل"
    },
    "Session Status": {
        "en": "Session Status",
        "de": "Sitzungsstatus",
        "fr": "Statut de la session",
        "es": "Estado de la sesión",
        "ar-SA": "حالة الجلسة"
    },
    "Issue, Actions Taken, Next Steps...": {
        "en": "Issue, Actions Taken, Next Steps...",
        "de": "Problem, ergriffene Maßnahmen, nächste Schritte...",
        "fr": "Problème, actions effectuées, prochaines étapes...",
        "es": "Problema, acciones realizadas, próximos pasos...",
        "ar-SA": "المشكلة، الإجراءات المتخذة، الخطوات التالية..."
    },
    "Session Queue": {
        "en": "Session Queue",
        "de": "Sitzungswarteschlange",
        "fr": "File d'attente des sessions",
        "es": "Cola de sesiones",
        "ar-SA": "قائمة انتظار الجلسات"
    },
    "Customer help requests will appear here.": {
        "en": "Customer help requests will appear here.",
        "de": "Hilfeanfragen von Kunden werden hier angezeigt.",
        "fr": "Les demandes d'aide des clients apparaîtront ici.",
        "es": "Aquí aparecerán las solicitudes de ayuda de los clientes.",
        "ar-SA": "ستظهر طلبات المساعدة من العملاء هنا."
    },
    "Support Requests": {
        "en": "Support Requests",
        "de": "Supportanfragen",
        "fr": "Demandes d'assistance",
        "es": "Solicitudes de soporte",
        "ar-SA": "طلبات الدعم"
    },
    "Track requests, assign technicians, and monitor progress.": {
        "en": "Track requests, assign technicians, and monitor progress.",
        "de": "Anfragen verfolgen, Techniker zuweisen und Fortschritt überwachen.",
        "fr": "Suivez les demandes, attribuez des techniciens et surveillez l'avancement.",
        "es": "Haz seguimiento de solicitudes, asigna técnicos y supervisa el progreso.",
        "ar-SA": "تتبّع الطلبات وتعيين الفنيين ومراقبة التقدم."
    },
    "Request ID": {
        "en": "Request ID",
        "de": "Anfrage-ID",
        "fr": "ID de la demande",
        "es": "ID de solicitud",
        "ar-SA": "ID الطلب"
    },
    "Issue Title": {
        "en": "Issue Title",
        "de": "Problemtitel",
        "fr": "Titre du problème",
        "es": "Título del problema",
        "ar-SA": "عنوان المشكلة"
    },
    "Created Date": {
        "en": "Created Date",
        "de": "Erstellungsdatum",
        "fr": "Date de création",
        "es": "Fecha de creación",
        "ar-SA": "تاريخ الإنشاء"
    },
    "Completed Date": {
        "en": "Completed Date",
        "de": "Abschlussdatum",
        "fr": "Date d'achèvement",
        "es": "Fecha de finalización",
        "ar-SA": "تاريخ الإكمال"
    },
    "No support requests found.": {
        "en": "No support requests found.",
        "de": "Keine Supportanfragen gefunden.",
        "fr": "Aucune demande d'assistance trouvée.",
        "es": "No se encontraron solicitudes de soporte.",
        "ar-SA": "لم يتم العثور على طلبات دعم."
    },
    "Technician Sessions": {
        "en": "Technician Sessions",
        "de": "Techniker-Sitzungen",
        "fr": "Sessions du technicien",
        "es": "Sesiones del técnico",
        "ar-SA": "جلسات الفني"
    },
    "Assigned requests, remote connection controls, and resolution notes.": {
        "en": "Assigned requests, remote connection controls, and resolution notes.",
        "de": "Zugewiesene Anfragen, Steuerelemente für Remote-Verbindungen und Lösungsnotizen.",
        "fr": "Demandes attribuées, contrôles de connexion à distance et notes de résolution.",
        "es": "Solicitudes asignadas, controles de conexión remota y notas de resolución.",
        "ar-SA": "الطلبات المعيّنة وعناصر التحكم في الاتصال عن بُعد وملاحظات الحل."
    },
    "Search by user, issue, device, or request ID": {
        "en": "Search by user, issue, device, or request ID",
        "de": "Nach Benutzer, Problem, Gerät oder Anfrage-ID suchen",
        "fr": "Rechercher par utilisateur, problème, appareil ou ID de demande",
        "es": "Buscar por usuario, problema, dispositivo o ID de solicitud",
        "ar-SA": "البحث حسب المستخدم أو المشكلة أو الجهاز أو ID الطلب"
    },
    "Camera Unavailable": {
        "en": "Camera Unavailable",
        "de": "Kamera nicht verfügbar",
        "fr": "Caméra indisponible",
        "es": "Cámara no disponible",
        "ar-SA": "الكاميرا غير متاحة"
    },
    "Turn Camera Off": {
        "en": "Turn Camera Off",
        "de": "Kamera ausschalten",
        "fr": "Désactiver la caméra",
        "es": "Desactivar cámara",
        "ar-SA": "إيقاف الكاميرا"
    },
    "Your subscription, capacity, and billing.": {
        "en": "Your subscription, capacity, and billing.",
        "de": "Ihr Abonnement, Ihre Kapazität und Abrechnung.",
        "fr": "Votre abonnement, votre capacité et votre facturation.",
        "es": "Tu suscripción, capacidad y facturación.",
        "ar-SA": "اشتراكك وسعتك والفوترة."
    },
    "Your free trial has ended — upgrade to keep using Remote365.": {
        "en": "Your free trial has ended — upgrade to keep using Remote365.",
        "de": "Ihre kostenlose Testphase ist abgelaufen — führen Sie ein Upgrade durch, um Remote365 weiter zu nutzen.",
        "fr": "Votre essai gratuit est terminé — passez à une offre supérieure pour continuer à utiliser Remote365.",
        "es": "Tu prueba gratuita ha terminado — mejora tu plan para seguir usando Remote365.",
        "ar-SA": "انتهت فترتك التجريبية المجانية — قم بالترقية لمواصلة استخدام Remote365."
    },
    "Left In Your Free Trial": {
        "en": "Left In Your Free Trial",
        "de": "verbleibend in Ihrer kostenlosen Testphase",
        "fr": "restants dans votre essai gratuit",
        "es": "restantes de tu prueba gratuita",
        "ar-SA": "متبقية في فترتك التجريبية المجانية"
    },
    "Manage Subscription": {
        "en": "Manage Subscription",
        "de": "Abonnement verwalten",
        "fr": "Gérer l'abonnement",
        "es": "Gestionar suscripción",
        "ar-SA": "إدارة الاشتراك"
    },
    "Billing Email": {
        "en": "Billing Email",
        "de": "Rechnungs-E-Mail",
        "fr": "E-mail de facturation",
        "es": "Correo de facturación",
        "ar-SA": "البريد الإلكتروني للفوترة"
    },
    "Invoices and receipts are sent here.": {
        "en": "Invoices and receipts are sent here.",
        "de": "Rechnungen und Belege werden hierhin gesendet.",
        "fr": "Les factures et reçus sont envoyés ici.",
        "es": "Las facturas y los recibos se envían aquí.",
        "ar-SA": "تُرسل الفواتير والإيصالات إلى هنا."
    },
    "Stripe Test Mode": {
        "en": "Stripe Test Mode",
        "de": "Stripe-Testmodus",
        "fr": "Mode test Stripe",
        "es": "Modo de prueba de Stripe",
        "ar-SA": "وضع اختبار Stripe"
    },
    "Choose Your Plan": {
        "en": "Choose Your Plan",
        "de": "Tarif auswählen",
        "fr": "Choisissez votre abonnement",
        "es": "Elige tu plan",
        "ar-SA": "اختر خطتك"
    },
    "Change plans without leaving Remote365.": {
        "en": "Change plans without leaving Remote365.",
        "de": "Tarif wechseln, ohne Remote365 zu verlassen.",
        "fr": "Changez d'abonnement sans quitter Remote365.",
        "es": "Cambia de plan sin salir de Remote365.",
        "ar-SA": "غيّر خطتك دون مغادرة Remote365."
    },
    "CURRENT": {
        "en": "CURRENT",
        "de": "AKTUELL",
        "fr": "ACTUEL",
        "es": "ACTUAL",
        "ar-SA": "الحالية"
    },
    "Select": {
        "en": "Select",
        "de": "Auswählen",
        "fr": "Sélectionner",
        "es": "Seleccionar",
        "ar-SA": "تحديد"
    },
    "Notifications older than 30 days are automatically deleted": {
        "en": "Notifications older than 30 days are automatically deleted",
        "de": "Benachrichtigungen, die älter als 30 Tage sind, werden automatisch gelöscht",
        "fr": "Les notifications de plus de 30 jours sont automatiquement supprimées",
        "es": "Las notificaciones con más de 30 días se eliminan automáticamente",
        "ar-SA": "يتم حذف الإشعارات التي مضى عليها أكثر من 30 يومًا تلقائيًا"
    },
    "Session details are loaded. Please connect when ready": {
        "en": "Session details are loaded. Please connect when ready",
        "de": "Sitzungsdetails sind geladen. Bitte verbinden Sie sich, wenn Sie bereit sind",
        "fr": "Les détails de la session sont chargés. Connectez-vous lorsque vous êtes prêt",
        "es": "Los detalles de la sesión están cargados. Conéctate cuando estés listo",
        "ar-SA": "تم تحميل تفاصيل الجلسة. يرجى الاتصال عندما تكون جاهزًا"
    },
    "A new device was registered to your platform": {
        "en": "A new device was registered to your platform",
        "de": "Ein neues Gerät wurde auf Ihrer Plattform registriert",
        "fr": "Un nouvel appareil a été enregistré sur votre plateforme",
        "es": "Se ha registrado un nuevo dispositivo en tu plataforma",
        "ar-SA": "تم تسجيل جهاز جديد في منصتك"
    },
    "Weekly platform report is ready to review": {
        "en": "Weekly platform report is ready to review",
        "de": "Der wöchentliche Plattformbericht steht zur Prüfung bereit",
        "fr": "Le rapport hebdomadaire de la plateforme est prêt à être consulté",
        "es": "El informe semanal de la plataforma está listo para revisar",
        "ar-SA": "تقرير المنصة الأسبوعي جاهز للمراجعة"
    },
    "Clear Older Than 24H": {
        "en": "Clear Older Than 24H",
        "de": "Älter als 24 Std. löschen",
        "fr": "Effacer ceux de plus de 24 h",
        "es": "Borrar anteriores a 24 h",
        "ar-SA": "مسح الأقدم من 24 ساعة"
    },
    "Log Out": {
        "en": "Log Out",
        "de": "Abmelden",
        "fr": "Se déconnecter",
        "es": "Cerrar sesión",
        "ar-SA": "تسجيل الخروج"
    },
    "User Management": {
        "en": "User Management",
        "de": "Benutzerverwaltung",
        "fr": "Gestion des utilisateurs",
        "es": "Gestión de usuarios",
        "ar-SA": "إدارة المستخدمين"
    },
    "Subscription Plans": {
        "en": "Subscription Plans",
        "de": "Abonnementpläne",
        "fr": "Formules d'abonnement",
        "es": "Planes de suscripción",
        "ar-SA": "خطط الاشتراك"
    },
    "Billing & Revenue": {
        "en": "Billing & Revenue",
        "de": "Abrechnung & Umsatz",
        "fr": "Facturation et revenus",
        "es": "Facturación e ingresos",
        "ar-SA": "الفوترة والإيرادات"
    },
    "Searching…": {
        "en": "Searching…",
        "de": "Suche läuft…",
        "fr": "Recherche…",
        "es": "Buscando…",
        "ar-SA": "جارٍ البحث…"
    },
    "Search Across Your Platform": {
        "en": "Search Across Your Platform",
        "de": "Plattformweit suchen",
        "fr": "Rechercher dans toute votre plateforme",
        "es": "Buscar en toda tu plataforma",
        "ar-SA": "البحث عبر منصتك"
    },
    "Find organizations, users, devices and sessions. Start typing to see matches.": {
        "en": "Find organizations, users, devices and sessions. Start typing to see matches.",
        "de": "Organisationen, Benutzer, Geräte und Sitzungen finden. Beginnen Sie mit der Eingabe, um Treffer zu sehen.",
        "fr": "Trouvez des organisations, utilisateurs, appareils et sessions. Commencez à saisir pour voir les résultats.",
        "es": "Encuentra organizaciones, usuarios, dispositivos y sesiones. Empieza a escribir para ver coincidencias.",
        "ar-SA": "ابحث عن المؤسسات والمستخدمين والأجهزة والجلسات. ابدأ الكتابة لرؤية النتائج."
    },
    "Try a different name, email, or device.": {
        "en": "Try a different name, email, or device.",
        "de": "Versuchen Sie einen anderen Namen, eine andere E-Mail oder ein anderes Gerät.",
        "fr": "Essayez un autre nom, e-mail ou appareil.",
        "es": "Prueba con otro nombre, correo o dispositivo.",
        "ar-SA": "جرّب اسمًا أو بريدًا إلكترونيًا أو جهازًا آخر."
    },
    "Search Organizations, Users, Devices...": {
        "en": "Search Organizations, Users, Devices...",
        "de": "Organisationen, Benutzer, Geräte suchen...",
        "fr": "Rechercher des organisations, utilisateurs, appareils...",
        "es": "Buscar organizaciones, usuarios, dispositivos...",
        "ar-SA": "البحث عن المؤسسات والمستخدمين والأجهزة..."
    },
    "To confirm, type \"Delete\" below.": {
        "en": "To confirm, type \"Delete\" below.",
        "de": "Geben Sie zur Bestätigung unten \"Delete\" ein.",
        "fr": "Pour confirmer, saisissez \"Delete\" ci-dessous.",
        "es": "Para confirmar, escribe \"Delete\" abajo.",
        "ar-SA": "للتأكيد، اكتب \"Delete\" أدناه."
    }
};
