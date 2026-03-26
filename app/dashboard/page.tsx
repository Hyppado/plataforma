import { redirect } from "next/navigation";

/**
 * /dashboard route redirects to /dashboard/videos
 * Dashboard page removed — each section has its own page
 */
export default function DashboardPage() {
  redirect("/dashboard/videos");
}
