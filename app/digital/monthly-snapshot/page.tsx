import { redirect } from "next/navigation";

export default function DigitalMonthlySnapshotPage() {
  // Canonical snapshots live under /projects/[projectId]/digital.
  redirect("/projects");
}
