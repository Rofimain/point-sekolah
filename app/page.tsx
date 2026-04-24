import { redirect } from "next/navigation";
import { getSafeServerSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSafeServerSession();
  if (!session) redirect("/login");
  if (session.user.role === "STUDENT") redirect("/form");
  redirect("/dashboard");
}
