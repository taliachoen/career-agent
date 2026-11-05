// Invented alert emails for tests and for local runs with GMAIL_PROVIDER=fake. The senders,
// subjects and layouts imitate real job-alert mail (tables with a linked title, the company and
// the place under it; tracking parameters on every link; a plain-text version in one case), but
// every name, company and id here is made up.

export interface FakeMessage {
  id: string;
  // Raw From header.
  from: string;
  subject: string;
  // Raw Authentication-Results header values.
  authResults: string[];
  text?: string | null;
  html?: string | null;
  // Default true: only unread mail is returned by a search with is:unread.
  unread?: boolean;
  // Default 1: how old the message is, for newer_than:Nd.
  ageDays?: number;
  // A message that cannot be fetched, like a network error on that one message.
  failFetch?: boolean;
}

export interface SampleJob {
  title: string;
  company: string;
  location: string;
  url: string;
}

const dkimPass = (domain: string) =>
  `mx.google.com; dkim=pass header.i=@${domain} header.s=selector1 header.b=AbCdEfGh; spf=pass (google.com: domain of bounce@${domain} designates 192.0.2.10 as permitted sender) smtp.mailfrom=bounce@${domain}; dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=${domain}`;

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The usual alert layout: a table per job, a linked title, then the company, then the place.
function jobCardsHtml(jobs: SampleJob[], heading: string): string {
  const cards = jobs
    .map(
      (job) =>
        `<table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #eee"><tr><td style="padding:12px 0 2px"><a href="${escapeHtml(job.url)}" style="color:#0a66c2;font-weight:bold;text-decoration:none">${escapeHtml(job.title)}</a></td></tr><tr><td style="color:#444">${escapeHtml(job.company)}</td></tr><tr><td style="color:#777;padding-bottom:12px">${escapeHtml(job.location)}</td></tr></table>`,
    )
    .join("\n");
  return `<html><head><title>${escapeHtml(heading)}</title><style>td{font-family:Arial}</style></head><body><div style="display:none">${escapeHtml(heading)} &#8199;&#847;&zwnj;</div><h2>${escapeHtml(heading)}</h2>${cards}<p style="font-size:11px"><a href="https://www.example-alerts.invalid/unsubscribe?token=abc123">Unsubscribe</a> &middot; <a href="https://www.example-alerts.invalid/settings?token=abc123">Email settings</a></p></body></html>`;
}

export const SAMPLE_JOBS = {
  linkedinAcme: {
    title: "Full Stack Developer",
    company: "Acme Software",
    location: "Tel Aviv-Yafo, Tel Aviv District, Israel",
    url: "https://www.linkedin.com/comm/jobs/view/3912345678?trackingId=aB3x%2FqZ9&refId=9f1c0d2e&midToken=AQHxyz&trk=eml-email_job_alert_digest_01-job_card-0-jobcard_body",
  },
  linkedinGlobex: {
    title: "Backend Engineer",
    company: "Globex",
    location: "Haifa, Haifa District, Israel",
    url: "https://www.linkedin.com/comm/jobs/view/3912345999?trackingId=Zk2m%2Fw8Q&refId=9f1c0d2e&midToken=AQHxyz&trk=eml-email_job_alert_digest_01-job_card-1-jobcard_body",
  },
  alljobInitech: {
    title: "מפתח/ת Full Stack",
    company: 'Initech בע"מ',
    location: "תל אביב",
    url: "https://www.alljobs.co.il/Search/UploadSingle.aspx?JobID=7771001&utm_source=jobalert&utm_medium=email&utm_campaign=daily",
  },
  alljobUmbrella: {
    title: "מפתח/ת Backend",
    company: "Umbrella",
    location: "באר שבע",
    url: "https://www.alljobs.co.il/Search/UploadSingle.aspx?JobID=7771002&utm_source=jobalert&utm_medium=email&utm_campaign=daily",
  },
  drushimInitech: {
    title: "מפתח/ת Full Stack",
    company: "Initech",
    location: "תל אביב",
    url: "https://www.drushim.co.il/job/55501/vsdrdrb/?utm_campaign=daily&utm_source=email&utm_medium=alert",
  },
  drushimHooli: {
    title: "אנליסט/ית נתונים",
    company: "Hooli",
    location: "רמת גן",
    url: "https://www.drushim.co.il/job/55777/xkqzlmn/?utm_campaign=daily&utm_source=email&utm_medium=alert",
  },
  glassdoorAcmeTlv: {
    title: "Full Stack Developer",
    company: "Acme Software Ltd",
    location: "Tel Aviv",
    url: "https://www.glassdoor.com/partner/jobListing.htm?pos=101&ao=1136043&s=58&guid=0000018c&src=GD_JOB_AD&t=JA&vt=w&cs=1_abc&cb=1700000000&jobListingId=1009123456&jl=1009123456&utm_source=email&utm_medium=jobalert",
  },
  glassdoorAcmeHaifa: {
    title: "Full Stack Developer",
    company: "Acme Software Ltd",
    location: "Haifa",
    url: "https://www.glassdoor.com/partner/jobListing.htm?pos=102&ao=1136043&s=58&guid=0000018c&src=GD_JOB_AD&t=JA&vt=w&cs=1_def&cb=1700000001&jobListingId=1009123457&jl=1009123457&utm_source=email&utm_medium=jobalert",
  },
} satisfies Record<string, SampleJob>;

export function jobCardsEmail(
  id: string,
  from: string,
  subject: string,
  signingDomain: string | null,
  jobs: SampleJob[],
): FakeMessage {
  return {
    id,
    from,
    subject,
    authResults: signingDomain ? [dkimPass(signingDomain)] : [],
    text: null,
    html: jobCardsHtml(jobs, subject),
  };
}

// The same job, listed once more by another site: the cross-site duplicate case.
// Newest first, like Gmail's search results.
export function sampleMailbox(): FakeMessage[] {
  const jobs = SAMPLE_JOBS;
  return [
    jobCardsEmail(
      "msg-linkedin-1",
      "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
      "Full Stack Developer: Acme Software and 1 more job in Israel",
      "linkedin.com",
      [jobs.linkedinAcme, jobs.linkedinGlobex],
    ),
    jobCardsEmail(
      "msg-alljob-1",
      "AllJobs <noreply@alljob.co.il>",
      "משרות חדשות בשבילך: מפתח/ת Full Stack",
      "alljob.co.il",
      [jobs.alljobInitech, jobs.alljobUmbrella],
    ),
    {
      // A plain-text version that is a real body, as Drushim sends: the link is on its own line.
      id: "msg-drushim-1",
      from: "דרושים <alerts@mail.drushim.co.il>",
      subject: "2 משרות חדשות שמתאימות לחיפוש שלך",
      authResults: [dkimPass("mail.drushim.co.il")],
      text: `משרות חדשות שמתאימות לחיפוש השמור שלך\n\n${[jobs.drushimInitech, jobs.drushimHooli]
        .map((job) => `${job.title}\n${job.company} - ${job.location}\n${job.url}`)
        .join("\n\n")}\n\nלהסרה מהרשימה: https://www.drushim.co.il/unsubscribe/?id=991`,
      html: "<p>HTML version</p>",
    },
    jobCardsEmail(
      "msg-glassdoor-1",
      "Glassdoor Jobs <noreply@glassdoor.com>",
      "Full Stack Developer jobs near you",
      "glassdoor.com",
      [jobs.glassdoorAcmeTlv, jobs.glassdoorAcmeHaifa],
    ),
    // Looks like a LinkedIn alert, but Gmail could not verify a signature by linkedin.com.
    {
      ...jobCardsEmail(
        "msg-spoofed-1",
        "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
        "Urgent: your account job alert",
        null,
        [
          {
            title: "Account Verification Specialist",
            company: "Totally Real Company",
            location: "Remote",
            url: "https://www.linkedin.com/comm/jobs/view/1111111111?trk=x",
          },
        ],
      ),
      authResults: [
        "mx.google.com; dkim=fail header.i=@linkedin.com header.s=selector1 header.b=Zzzz; spf=softfail smtp.mailfrom=bounce@spam.example",
      ],
    },
    // Already read: a search for unread mail does not return it.
    {
      ...jobCardsEmail(
        "msg-read-1",
        "AllJobs <noreply@alljob.co.il>",
        "משרות מאתמול",
        "alljob.co.il",
        [jobs.alljobUmbrella],
      ),
      unread: false,
    },
    // A personal LinkedIn message: not from an allowed address, so never returned.
    {
      id: "msg-linkedin-personal",
      from: "LinkedIn <messages-noreply@linkedin.com>",
      subject: "Dana sent you a message",
      authResults: [dkimPass("linkedin.com")],
      text: "Dana sent you a message: 'Hi, are you free for a coffee next week?'",
      html: null,
    },
  ];
}
