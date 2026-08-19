import { redirect } from "next/navigation";

export default function WatchPostRemoved() {
  redirect("/messages");
}
