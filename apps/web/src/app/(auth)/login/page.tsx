import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const notice = reason === "expired" || reason === "registered" ? reason : undefined;
  return <LoginForm notice={notice} />;
}
