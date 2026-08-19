import { redirect } from "next/navigation";

export default function ArticleGone() {
  redirect("/messages");
}
