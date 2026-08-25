import { redirect } from "next/navigation";

export default function ManageOperatorsRedirect() {
  redirect("/admin/profile");
}
