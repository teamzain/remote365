// Strings of the sign-in / sign-up / password / 2FA screen in the five
// languages the language picker offers. The picker changes these instantly;
// the signed-in console keeps using lib/translations via the account language.
export type AuthLang = 'en' | 'de' | 'fr' | 'es' | 'ar-SA';

const STRINGS: Record<string, Record<AuthLang, string>> = {
  back: { en: 'Back', de: 'Zurück', fr: 'Retour', es: 'Atrás', 'ar-SA': 'رجوع' },
  noAccount: { en: "Don't have an account?", de: 'Noch kein Konto?', fr: 'Pas encore de compte ?', es: '¿No tienes una cuenta?', 'ar-SA': 'ليس لديك حساب؟' },
  hasAccount: { en: 'Already have an account?', de: 'Bereits ein Konto?', fr: 'Vous avez déjà un compte ?', es: '¿Ya tienes una cuenta?', 'ar-SA': 'لديك حساب بالفعل؟' },
  createAccount: { en: 'Create Account', de: 'Konto erstellen', fr: 'Créer un compte', es: 'Crear cuenta', 'ar-SA': 'إنشاء حساب' },
  signIn: { en: 'Sign in', de: 'Anmelden', fr: 'Se connecter', es: 'Iniciar sesión', 'ar-SA': 'تسجيل الدخول' },
  signUp: { en: 'Sign up', de: 'Registrieren', fr: "S'inscrire", es: 'Registrarse', 'ar-SA': 'إنشاء حساب' },
  recoverAccount: { en: 'Recover Account', de: 'Konto wiederherstellen', fr: 'Récupérer le compte', es: 'Recuperar cuenta', 'ar-SA': 'استعادة الحساب' },
  updatePassword: { en: 'Update Password', de: 'Passwort aktualisieren', fr: 'Mettre à jour le mot de passe', es: 'Actualizar contraseña', 'ar-SA': 'تحديث كلمة المرور' },
  backToSignIn: { en: 'Back to sign in', de: 'Zurück zur Anmeldung', fr: 'Retour à la connexion', es: 'Volver a iniciar sesión', 'ar-SA': 'العودة إلى تسجيل الدخول' },
  accountEmail: { en: 'Account Email', de: 'Konto-E-Mail', fr: 'E-mail du compte', es: 'Correo de la cuenta', 'ar-SA': 'البريد الإلكتروني للحساب' },
  sendResetCode: { en: 'Send reset code', de: 'Code senden', fr: 'Envoyer le code', es: 'Enviar código', 'ar-SA': 'إرسال رمز إعادة التعيين' },
  resetCode: { en: 'Reset Code', de: 'Zurücksetzungscode', fr: 'Code de réinitialisation', es: 'Código de restablecimiento', 'ar-SA': 'رمز إعادة التعيين' },
  newPassword: { en: 'New Password', de: 'Neues Passwort', fr: 'Nouveau mot de passe', es: 'Nueva contraseña', 'ar-SA': 'كلمة المرور الجديدة' },
  atLeast8: { en: 'At least 8 characters', de: 'Mindestens 8 Zeichen', fr: 'Au moins 8 caractères', es: 'Al menos 8 caracteres', 'ar-SA': '8 أحرف على الأقل' },
  verificationCode: { en: 'Verification Code', de: 'Bestätigungscode', fr: 'Code de vérification', es: 'Código de verificación', 'ar-SA': 'رمز التحقق' },
  codeSent: { en: 'We sent a 6-digit code to {email}. Not in your inbox? Check your spam or junk folder.', de: 'Wir haben einen 6-stelligen Code an {email} gesendet. Nicht im Posteingang? Prüfen Sie den Spam-Ordner.', fr: 'Nous avons envoyé un code à 6 chiffres à {email}. Pas dans votre boîte de réception ? Vérifiez vos courriers indésirables.', es: 'Enviamos un código de 6 dígitos a {email}. ¿No está en tu bandeja de entrada? Revisa la carpeta de spam.', 'ar-SA': 'أرسلنا رمزًا من 6 أرقام إلى {email}. لم يصلك؟ تحقق من مجلد الرسائل غير المرغوب فيها.' },
  email: { en: 'Email', de: 'E-Mail', fr: 'E-mail', es: 'Correo electrónico', 'ar-SA': 'البريد الإلكتروني' },
  password: { en: 'Password', de: 'Passwort', fr: 'Mot de passe', es: 'Contraseña', 'ar-SA': 'كلمة المرور' },
  enterPassword: { en: 'Enter your password', de: 'Passwort eingeben', fr: 'Saisissez votre mot de passe', es: 'Introduce tu contraseña', 'ar-SA': 'أدخل كلمة المرور' },
  rememberMe: { en: 'Remember Me', de: 'Angemeldet bleiben', fr: 'Se souvenir de moi', es: 'Recordarme', 'ar-SA': 'تذكرني' },
  forgotPassword: { en: 'Forgot Password?', de: 'Passwort vergessen?', fr: 'Mot de passe oublié ?', es: '¿Olvidaste tu contraseña?', 'ar-SA': 'هل نسيت كلمة المرور؟' },
  loading: { en: 'Loading...', de: 'Wird geladen...', fr: 'Chargement...', es: 'Cargando...', 'ar-SA': 'جارٍ التحميل...' },
  verifyAndSignIn: { en: 'Verify and sign in', de: 'Bestätigen und anmelden', fr: 'Vérifier et se connecter', es: 'Verificar e iniciar sesión', 'ar-SA': 'تحقق وسجّل الدخول' },
  or: { en: 'or', de: 'oder', fr: 'ou', es: 'o', 'ar-SA': 'أو' },
  signInWithGoogle: { en: 'Sign in with Google', de: 'Mit Google anmelden', fr: 'Se connecter avec Google', es: 'Iniciar sesión con Google', 'ar-SA': 'تسجيل الدخول عبر Google' },
  signUpWithGoogle: { en: 'Sign up with Google', de: 'Mit Google registrieren', fr: "S'inscrire avec Google", es: 'Registrarse con Google', 'ar-SA': 'إنشاء حساب عبر Google' },
  signInWithMicrosoft: { en: 'Sign in with Microsoft', de: 'Mit Microsoft anmelden', fr: 'Se connecter avec Microsoft', es: 'Iniciar sesión con Microsoft', 'ar-SA': 'تسجيل الدخول عبر Microsoft' },
  signUpWithMicrosoft: { en: 'Sign up with Microsoft', de: 'Mit Microsoft registrieren', fr: "S'inscrire avec Microsoft", es: 'Registrarse con Microsoft', 'ar-SA': 'إنشاء حساب عبر Microsoft' },
  disclaimer: { en: 'By signing in, you acknowledge that your data may be processed in accordance with our terms.', de: 'Mit der Anmeldung bestätigen Sie, dass Ihre Daten gemäß unseren Bedingungen verarbeitet werden dürfen.', fr: 'En vous connectant, vous acceptez que vos données soient traitées conformément à nos conditions.', es: 'Al iniciar sesión, aceptas que tus datos se procesen de acuerdo con nuestros términos.', 'ar-SA': 'بتسجيل الدخول، فإنك تقر بأنه قد تتم معالجة بياناتك وفقًا لشروطنا.' },
  resetCaption: { en: 'Reset your password.', de: 'Passwort zurücksetzen.', fr: 'Réinitialisez votre mot de passe.', es: 'Restablece tu contraseña.', 'ar-SA': 'أعد تعيين كلمة المرور.' },
  newPasswordCaption: { en: 'Enter your new password.', de: 'Neues Passwort eingeben.', fr: 'Saisissez votre nouveau mot de passe.', es: 'Introduce tu nueva contraseña.', 'ar-SA': 'أدخل كلمة المرور الجديدة.' },
  twoFactorTag: { en: 'Verification Required', de: 'Bestätigung erforderlich', fr: 'Vérification requise', es: 'Verificación requerida', 'ar-SA': 'التحقق مطلوب' },
  twoFactorTitle: { en: 'Two-Factor Auth', de: 'Zwei-Faktor-Authentifizierung', fr: 'Authentification à deux facteurs', es: 'Autenticación de dos factores', 'ar-SA': 'المصادقة الثنائية' },
  twoFactorHint: { en: 'Open your authenticator app and enter the 6-digit verification code.', de: 'Öffnen Sie Ihre Authenticator-App und geben Sie den 6-stelligen Code ein.', fr: "Ouvrez votre application d'authentification et saisissez le code à 6 chiffres.", es: 'Abre tu aplicación de autenticación e introduce el código de 6 dígitos.', 'ar-SA': 'افتح تطبيق المصادقة وأدخل رمز التحقق المكوّن من 6 أرقام.' },
  twoFactorSetupTag: { en: 'Setup Required', de: 'Einrichtung erforderlich', fr: 'Configuration requise', es: 'Configuración requerida', 'ar-SA': 'الإعداد مطلوب' },
  twoFactorSetupTitle: { en: 'Set Up Two-Factor', de: 'Zwei-Faktor einrichten', fr: 'Configurer la double authentification', es: 'Configurar dos factores', 'ar-SA': 'إعداد المصادقة الثنائية' },
  twoFactorSetupHint: { en: 'Your organization requires two-factor authentication. Scan this QR code with an authenticator app, then enter the 6-digit code it shows.', de: 'Ihre Organisation verlangt die Zwei-Faktor-Authentifizierung. Scannen Sie diesen QR-Code mit einer Authenticator-App und geben Sie dann den angezeigten 6-stelligen Code ein.', fr: "Votre organisation exige l'authentification à deux facteurs. Scannez ce code QR avec une application d'authentification, puis saisissez le code à 6 chiffres affiché.", es: 'Tu organización exige la autenticación de dos factores. Escanea este código QR con una aplicación de autenticación y luego introduce el código de 6 dígitos que muestra.', 'ar-SA': 'تشترط مؤسستك المصادقة الثنائية. امسح رمز QR هذا بتطبيق مصادقة، ثم أدخل الرمز المكوّن من 6 أرقام الذي يعرضه.' },
  personalAccount: { en: 'Sign up personal account', de: 'Privates Konto erstellen', fr: 'Créer un compte personnel', es: 'Crear cuenta personal', 'ar-SA': 'إنشاء حساب شخصي' },
  businessAccount: { en: 'Sign up business account', de: 'Geschäftskonto erstellen', fr: 'Créer un compte professionnel', es: 'Crear cuenta de empresa', 'ar-SA': 'إنشاء حساب شركة' },
  stepCompany: { en: 'Company', de: 'Firma', fr: 'Entreprise', es: 'Empresa', 'ar-SA': 'الشركة' },
  stepAddress: { en: 'Address', de: 'Adresse', fr: 'Adresse', es: 'Dirección', 'ar-SA': 'العنوان' },
  stepAccount: { en: 'Account', de: 'Konto', fr: 'Compte', es: 'Cuenta', 'ar-SA': 'الحساب' },
  next: { en: 'Next', de: 'Weiter', fr: 'Suivant', es: 'Siguiente', 'ar-SA': 'التالي' },
  state: { en: 'State', de: 'Bundesstaat', fr: 'État', es: 'Estado', 'ar-SA': 'الولاية' },
  province: { en: 'Province', de: 'Provinz', fr: 'Province', es: 'Provincia', 'ar-SA': 'المقاطعة' },
  completeSteps: { en: 'Please complete the company and address steps.', de: 'Bitte die Schritte Firma und Adresse ausfüllen.', fr: "Veuillez compléter les étapes Entreprise et Adresse.", es: 'Completa los pasos de empresa y dirección.', 'ar-SA': 'يرجى إكمال خطوتي الشركة والعنوان.' },
  companyEmail: { en: 'Company Email', de: 'Firmen-E-Mail', fr: "E-mail de l'entreprise", es: 'Correo de empresa', 'ar-SA': 'البريد الإلكتروني للشركة' },
  companyName: { en: 'Company Name', de: 'Firmenname', fr: "Nom de l'entreprise", es: 'Nombre de la empresa', 'ar-SA': 'اسم الشركة' },
  businessNumber: { en: 'Business No.', de: 'Handelsregister-Nr.', fr: 'Numéro d\'entreprise', es: 'Número de empresa', 'ar-SA': 'رقم السجل التجاري' },
  companyWebsite: { en: 'Company Website', de: 'Website', fr: 'Site web', es: 'Sitio web', 'ar-SA': 'موقع الشركة' },
  country: { en: 'Country', de: 'Land', fr: 'Pays', es: 'País', 'ar-SA': 'الدولة' },
  city: { en: 'City', de: 'Stadt', fr: 'Ville', es: 'Ciudad', 'ar-SA': 'المدينة' },
  address: { en: 'Address', de: 'Adresse', fr: 'Adresse', es: 'Dirección', 'ar-SA': 'العنوان' },
  zipCode: { en: 'Zip Code', de: 'Postleitzahl', fr: 'Code postal', es: 'Código postal', 'ar-SA': 'الرمز البريدي' },
  businessMissing: { en: 'Please fill in the company name, business number and address.', de: 'Bitte Firmenname, Handelsregister-Nr. und Adresse ausfüllen.', fr: "Veuillez renseigner le nom de l'entreprise, le numéro et l'adresse.", es: 'Completa el nombre de la empresa, el número y la dirección.', 'ar-SA': 'يرجى إدخال اسم الشركة ورقم السجل والعنوان.' },
  helpSupport: { en: 'Help & Support', de: 'Hilfe & Support', fr: 'Aide et support', es: 'Ayuda y soporte', 'ar-SA': 'المساعدة والدعم' },
  copyright: { en: 'Copyright 2026 © TechVision365 Inc. All Rights Reserved.', de: 'Copyright 2026 © TechVision365 Inc. Alle Rechte vorbehalten.', fr: 'Copyright 2026 © TechVision365 Inc. Tous droits réservés.', es: 'Copyright 2026 © TechVision365 Inc. Todos los derechos reservados.', 'ar-SA': 'حقوق النشر 2026 © TechVision365 Inc. جميع الحقوق محفوظة.' },
};

export const isAuthLang = (value: string): value is AuthLang => ['en', 'de', 'fr', 'es', 'ar-SA'].includes(value);

export const ta = (key: keyof typeof STRINGS | string, lang: string, vars?: Record<string, string>): string => {
  const entry = STRINGS[key];
  let text = entry ? entry[isAuthLang(lang) ? lang : 'en'] || entry.en : String(key);
  if (vars) for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(value);
  return text;
};
