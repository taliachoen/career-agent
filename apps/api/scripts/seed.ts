// Development data: a demo user and ~10 Full Stack jobs.
// Safe to run repeatedly: it only deletes and recreates the demo user's jobs.
// The urls use real job-site domains with made-up ids, so most will open a 404.
import { JobSource, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { siteFromUrl } from "../src/jobs/site.js";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demo-password-123";
// Same cost as AuthService, so a demo login takes as long as a real one.
const BCRYPT_COST = 12;

interface SeedJob {
  title: string;
  company: string;
  description: string;
  /** How long ago the job was added. */
  hoursAgo: number;
  urls: string[];
}

const JOBS: SeedJob[] = [
  {
    title: "Full Stack Developer",
    company: "Nimbus Labs",
    description: "Build customer-facing features end to end with React, Node.js and PostgreSQL.",
    hoursAgo: 3,
    urls: [
      "https://www.linkedin.com/jobs/view/3912004481",
      "https://www.alljobs.co.il/Search/UploadSingle.aspx?JobID=8123401",
      "https://careers.nimbuslabs.example/jobs/full-stack-developer",
    ],
  },
  {
    title: "Senior Full Stack Engineer (TypeScript)",
    company: "Paylane",
    description: "Own services and UI for a payments dashboard. NestJS, Next.js, PostgreSQL.",
    hoursAgo: 20,
    urls: [
      "https://www.linkedin.com/jobs/view/3911177302",
      "https://www.drushim.co.il/job/27741903/paylane",
    ],
  },
  {
    title: "Full Stack Developer – Growth Team",
    company: "Brightcart",
    description: "Experiment-driven product work across a React front end and a Node.js API.",
    hoursAgo: 30,
    urls: ["https://www.alljobs.co.il/Search/UploadSingle.aspx?JobID=8119872"],
  },
  {
    title: "Backend-leaning Full Stack Developer",
    company: "Stackwell",
    description: "NestJS and PostgreSQL services, with some React work on internal tools.",
    hoursAgo: 52,
    urls: [
      "https://www.linkedin.com/jobs/view/3909985617",
      "https://www.drushim.co.il/job/27730118/stackwell",
      "https://stackwell.example/careers/backend-full-stack",
    ],
  },
  {
    title: "Full Stack Engineer, Healthcare Platform",
    company: "Medilink",
    description: "Secure patient-facing web app. React, TypeScript, Node.js, AWS.",
    hoursAgo: 75,
    urls: ["https://www.linkedin.com/jobs/view/3907741120"],
  },
  {
    title: "Junior Full Stack Developer",
    company: "Orbit Software",
    description:
      "Join a mentoring-friendly team building a SaaS scheduling product with React and Node.js.",
    hoursAgo: 98,
    urls: [
      "https://www.drushim.co.il/job/27712004/orbit-software",
      "https://www.alljobs.co.il/Search/UploadSingle.aspx?JobID=8101166",
    ],
  },
  {
    title: "Full Stack Developer (Next.js)",
    company: "Greenfield Analytics",
    description: "Data-heavy dashboards with Next.js, a NestJS API and PostgreSQL.",
    hoursAgo: 130,
    urls: ["https://www.linkedin.com/jobs/view/3904412893"],
  },
  {
    title: "Software Engineer, Full Stack",
    company: "Tandem Mobility",
    description: "Features for a fleet-management web app. React, Node.js, event-driven backend.",
    hoursAgo: 170,
    urls: ["https://www.alljobs.co.il/Search/UploadSingle.aspx?JobID=8088231"],
  },
  {
    title: "Lead Full Stack Developer",
    company: "Cedar & Pine",
    description: "Lead a team of four on an e-commerce platform. TypeScript across the stack.",
    hoursAgo: 215,
    urls: [
      "https://www.linkedin.com/jobs/view/3899021554",
      "https://www.drushim.co.il/job/27688540/cedar-pine",
    ],
  },
  {
    title: "Full Stack Developer – Remote (Israel)",
    company: "Northwind Digital",
    description: "Remote-first product team. React, Node.js, PostgreSQL, CI/CD.",
    hoursAgo: 290,
    urls: ["https://www.linkedin.com/jobs/view/3895530071"],
  },
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo data when NODE_ENV=production");
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);
    const user = await prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      update: { passwordHash },
      create: { email: DEMO_EMAIL, passwordHash },
      select: { id: true },
    });

    // Postings go with their job (cascade). Only this user's rows are touched.
    const removed = await prisma.job.deleteMany({ where: { userId: user.id } });

    const now = Date.now();
    for (const job of JOBS) {
      const createdAt = new Date(now - job.hoursAgo * 60 * 60 * 1000);
      await prisma.job.create({
        data: {
          title: job.title,
          company: job.company,
          description: job.description,
          userId: user.id,
          createdAt,
          postings: {
            // The posting's jobId and userId come from the parent job.
            create: job.urls.map((url) => ({
              url,
              site: siteFromUrl(url),
              source: JobSource.EMAIL,
              createdAt,
            })),
          },
        },
      });
    }

    console.log(`Seeded ${JOBS.length} jobs for ${DEMO_EMAIL} (replaced ${removed.count}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
