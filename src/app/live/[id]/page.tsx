import { redirect } from "next/navigation";

export default function LiveRoomRemoved() {
  redirect("/messages");
}
