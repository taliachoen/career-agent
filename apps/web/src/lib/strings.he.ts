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
      "בקרוב המשרות שלך ידורגו לפי קורות החיים וההעדפות שתכתבי כאן. ככל שהפרופיל מדויק יותר, הדירוג יהיה מדויק יותר.",
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

  notFound: {
    title: "העמוד לא נמצא",
    back: "חזרה לרשימת המשרות",
  },

  crash: {
    title: "משהו השתבש",
    body: "אירעה שגיאה בלתי צפויה בעמוד.",
  },
} as const;
