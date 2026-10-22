import Link from "next/link";
import { he } from "../lib/strings.he";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-xl font-semibold">{he.notFound.title}</h1>
      <Link href="/jobs" className="mt-4 inline-block font-medium text-accent-700 underline">
        {he.notFound.back}
      </Link>
    </main>
  );
}
