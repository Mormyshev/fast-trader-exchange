import { redirect } from "next/navigation";

export default function OperatorVerificationRedirectPage() {
  redirect("/admin/verification");
}
