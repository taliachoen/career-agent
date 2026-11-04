export const he = {
  appName: "CareerAgent",

  nav: {
    logout: "התנתקות",
    jobs: "משרות",
    profile: "פרופיל",
  },

  common: {
    loading: "טוען...",
    retry: "נסו שוב",
    email: "אימייל",
    password: "סיסמה",
    sending: "שולח...",
  },

  errors: {
    generic: "השרת אינו זמין או שאירעה שגיאה לא צפויה. נסו שוב בעוד רגע.",
    emailInvalid: "יש להזין כתובת אימייל תקינה",
    passwordRequired: "יש להזין סיסמה",
    passwordTooShort: "הסיסמה חייבת להכיל לפחות 8 תווים",
    passwordTooLong: "הסיסמה ארוכה מדי (עד 72 בתים)",
    emailTaken: "כתובת האימייל הזו כבר רשומה",
    badCredentials: "האימייל או הסיסמה שגויים",
    sessionExpired: "פג תוקף ההתחברות, יש להתחבר שוב",
    registeredLoginFailed: "ההרשמה הצליחה, יש להתחבר",
    cvRequired: "יש להדביק את קורות החיים",
    cvTooShort: "קורות החיים קצרים מדי (לפחות 200 תווים)",
    cvTooLong: "קורות החיים ארוכים מדי (עד 20,000 תווים)",
    lookingForTooLong: "הטקסט ארוך מדי (עד 2,000 תווים)",
  },

  profile: {
    title: "פרופיל",
    loadFailed: "לא הצלחנו לטעון את הפרופיל.",
    introTitle: "למה הפרופיל חשוב?",
    introBody:
      "המשרות שלך מדורגות לפי קורות החיים וההעדפות שתכתבי כאן. ככל שהפרופיל מדויק יותר, הדירוג יהיה מדויק יותר.",
    cvLabel: "קורות חיים",
    cvHint: "הדביקי כאן את קורות החיים שלך כטקסט: ניסיון, השכלה וכישורים. לפחות 200 תווים.",
    lookingForLabel: "מה את מחפשת",
    lookingForHint:
      "אופציונלי. תפקיד, אזור, היקף משרה ושיטת עבודה, למשל: Full Stack ג'וניור, מרכז, היברידי.",
    remaining: (count: number) => `נותרו ${count.toLocaleString("he-IL")} תווים`,
    over: (count: number) => `חריגה של ${count.toLocaleString("he-IL")} תווים`,
    submit: "שמירה",
    saved: "הפרופיל נשמר",
    updatedAt: "עודכן לאחרונה:",
  },

  gmail: {
    title: "חיבור Gmail",
    intro:
      "חיברי את תיבת הדואר כדי שנוכל למצוא בה התראות על משרות. ההרשאה היא לקריאה בלבד: האפליקציה לא שולחת מיילים ולא משנה דבר בתיבה.",
    loadFailed: "לא הצלחנו לבדוק את מצב החיבור.",
    notConnected: "Gmail לא מחובר.",
    connected: "מחובר:",
    connect: "חברי Gmail",
    connecting: "מעבירה ל-Google...",
    disconnect: "נתקי",
    disconnecting: "מנתקת...",
    needsReconnectTitle: "צריך לחבר את Gmail מחדש",
    needsReconnectBody:
      "ההרשאה ל-Gmail כבר לא תקפה (בגרסת הבדיקה של Google היא פגה אחרי 7 ימים). יש לחבר מחדש.",
    reconnect: "חברי מחדש",
    notAvailable: "חיבור Gmail אינו מוגדר בשרת.",
    connectFailed: "לא הצלחנו להתחיל את החיבור. נסי שוב בעוד רגע.",
    disconnectFailed: "לא הצלחנו לנתק. נסי שוב בעוד רגע.",
    disconnected: "Gmail נותק והגישה בוטלה.",
    disconnectedNotRevoked:
      "Gmail נותק מהאפליקציה, אבל לא הצלחנו לבטל את ההרשאה אצל Google. אפשר להסיר אותה ידנית בהגדרות חשבון Google, בסעיף אבטחה ← אפליקציות של צד שלישי.",
    result: {
      connected: "Gmail חובר בהצלחה.",
      denied: "החיבור בוטל ולא ניתנה הרשאה. אפשר לנסות שוב מתי שתרצי.",
      scope_error:
        "Google אישרה הרשאות שונות מהנדרש (קריאה בלבד), ולכן החיבור לא נשמר. נסי שוב ואשרי רק את ההרשאה המבוקשת.",
      error: "החיבור נכשל. נסי שוב.",
    },
  },

  login: {
    title: "התחברות",
    submit: "התחברות",
    noAccount: "אין לך חשבון?",
    toRegister: "להרשמה",
  },

  register: {
    title: "הרשמה",
    submit: "הרשמה",
    hasAccount: "כבר רשומה?",
    toLogin: "להתחברות",
    passwordHint: "לפחות 8 תווים",
  },

  jobs: {
    title: "משרות",
    loadFailed: "לא הצלחנו לטעון את המשרות.",
    emptyTitle: "עדיין אין משרות",
    emptyBody: "משרות יופיעו כאן כשיגיעו מהמיילים שלך.",
    publishedOn: "פורסם ב:",
    addedOn: "נוספה",
    opensInNewTab: "נפתח בלשונית חדשה",
  },

  scoring: {
    button: "דרגי משרות",
    running: "מדרגת...",
    needProfile: "כדי לדרג משרות צריך קודם למלא את קורות החיים בפרופיל.",
    toProfile: "לעמוד הפרופיל",
    result: (scored: number, failed: number, remaining: number) =>
      `דורגו: ${scored} · נכשלו: ${failed} · נשארו: ${remaining}`,
    pressAgain: "אפשר ללחוץ שוב כדי להמשיך.",
    allFailed: "הדירוג לא הצליח. נסי שוב בעוד רגע.",
    notConfigured: "שירות הדירוג אינו מוגדר בשרת.",
    alreadyRunning: "דירוג כבר מתבצע. נסי שוב בעוד רגע.",
    scoreLabel: "ציון",
    details: "פרטים",
    matches: "התאמות",
    gaps: "פערים",
    none: "אין",
    stale: "דירוג ישן: הפרופיל עודכן מאז",
  },

  notFound: {
    title: "העמוד לא נמצא",
    back: "חזרה לרשימת המשרות",
  },

  crash: {
    title: "משהו השתבש",
    body: "אירעה שגיאה בלתי צפויה בעמוד.",
  },
} as const;
