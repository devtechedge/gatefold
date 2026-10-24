"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { HttpError } from "@/lib/errors";
import { acceptInvitation } from "@/services/auth";

export async function acceptInviteAction(token: string) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  try {
    await acceptInvitation(token, user.id);
  } catch (error) {
    if (error instanceof HttpError) {
      redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  redirect("/organizer");
}
