export const he = {
  appName: "CareerAgent",

  nav: {
    logout: "התנתקות",
    jobs: "משרות",
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
