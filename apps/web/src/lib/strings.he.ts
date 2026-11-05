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
    senders: {
      title: "שולחים",
      intro:
        "המערכת קוראת רק מיילים שלא נקראו מהשולחים האלה, ורק מהם שולחת טקסט לחילוץ משרות. מיילים אישיים לא נקראים.",
      loadFailed: "לא הצלחנו לטעון את רשימת השולחים.",
      knownTitle: "שולחים מוכרים",
      knownHint: "ברירת מחדל, לקריאה בלבד. דומיין כולל גם את תתי־הדומיינים שלו.",
      mineTitle: "השולחים שלי",
      mineEmpty: "עוד לא הוספת שולחים.",
      addLabel: "הוספת שולח",
      addHint:
        "כתובת מייל או דומיין, למשל jobs2web.com. ספק מייל כללי (כמו gmail.com) אפשרי רק ככתובת מלאה.",
      add: "הוספה",
      adding: "מוסיפה...",
      remove: (value: string) => `מחיקת השולח ${value}`,
      removeButton: "מחיקה",
      invalid:
        "הערך אינו תקין: יש להזין כתובת מייל מלאה או דומיין. ספק מייל כללי (כמו gmail.com) אפשרי רק ככתובת מלאה.",
      duplicate: "השולח הזה כבר ברשימה.",
      tooMany: "אי אפשר להוסיף יותר מ־50 שולחים.",
      failed: "לא הצלחנו לשמור את השינוי. נסי שוב בעוד רגע.",
    },
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
    snippetScore: "הדירוג מבוסס על תקציר מהמייל, לא על תיאור המשרה המלא.",
    opensInNewTab: "נפתח בלשונית חדשה",
  },

  sync: {
    button: "סנכרני מיילים",
    running: "מסנכרנת...",
    needsConnection: "כדי לקלוט משרות מהמייל צריך לחבר את Gmail.",
    needsReconnection: "החיבור ל-Gmail כבר לא תקף, ויש לחבר אותו מחדש.",
    toProfile: "לחיבור Gmail",
    nothingNew: "אין מיילים חדשים מהשולחים המוכרים.",
    summary: (checked: number, added: number, attached: number, scored: number) =>
      `נבדקו ${checked} מיילים · משרות חדשות: ${added} · צורפו למשרה קיימת: ${attached} · דורגו: ${scored}`,
    duplicates: (count: number) => `${count} משרות כבר היו שמורות אצלך.`,
    rejected: (count: number) => `${count} משרות נדחו כי הקישור שלהן לא מופיע במייל.`,
    unauthenticated: (count: number) =>
      `${count} מיילים לא נקראו כי Gmail לא אימתה שהם נשלחו בפועל מהשולח.`,
    failedEmails: (count: number) => `${count} מיילים נכשלו, והמערכת תנסה אותם שוב בסנכרון הבא.`,
    moreAvailable: "יש עוד מיילים שלא נקראו: אפשר לסנכרן שוב.",
    scoreFailed: (count: number) => `${count} משרות לא דורגו.`,
    scoringRemaining: (count: number) =>
      `${count} משרות עדיין ממתינות לדירוג: אפשר ללחוץ על "דרגי משרות".`,
    scoringSkippedNoProfile: "המשרות נשמרו. כדי לדרג אותן צריך קודם למלא את קורות החיים בפרופיל.",
    scoringSkippedBusy: "המשרות נשמרו, אבל דירוג אחר כבר מתבצע. אפשר לדרג אותן בעוד רגע.",
    scoringSkippedUnavailable: "המשרות נשמרו, אבל שירות הדירוג אינו מוגדר בשרת.",
    scoringFailed: 'המשרות נשמרו, אבל הדירוג נכשל. אפשר לנסות שוב בכפתור "דרגי משרות".',
    allFailed: "לא הצלחנו לקרוא אף מייל. נסי שוב בעוד רגע.",
    notConnected: "Gmail אינו מחובר. אפשר לחבר אותו בעמוד הפרופיל.",
    alreadyRunning: "סנכרון כבר מתבצע. נסי שוב בעוד רגע.",
    notConfigured: "חילוץ המשרות אינו מוגדר בשרת.",
    googleFailed: "לא הצלחנו לקרוא את Gmail. נסי שוב בעוד רגע.",
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
