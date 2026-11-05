// The built-in allowed senders: only mail from these (and the user's own list) is read, and
// only that mail is ever sent to the model.
//
// An entry without "@" is a domain and also matches its subdomains. An entry with "@" is one
// exact address. Sites that send more than job alerts (LinkedIn also sends personal messages)
// are listed by address, so those messages never leave the mailbox.
export const DEFAULT_SENDERS: readonly string[] = [
  "alljob.co.il",
  "alljobs.co.il",
  "jobnet.co.il",
  "jobmaster.co.il",
  "drushim.co.il",
  "jobkarov.com",
  "glassdoor.com",
  "wellfound.com",
  "ziprecruiter.com",
  "jobalerts-noreply@linkedin.com",
  "jobs-noreply@linkedin.com",
];

// General mail providers. A whole domain of these would allow anyone's mail, so only a full
// address on them can be added.
export const GENERIC_MAIL_DOMAINS: readonly string[] = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "mail.com",
  "walla.co.il",
  "walla.com",
  "netvision.net.il",
  "zahav.net.il",
];
