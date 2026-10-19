import { BackendStatus } from "../components/BackendStatus";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1>CareerAgent</h1>
      <p>
        CareerAgent will become an AI-powered career and job matching platform.
      </p>
      <BackendStatus />
    </main>
  );
}
