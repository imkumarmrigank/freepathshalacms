"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, canTouchCenter } from "@/lib/auth";
import { centreRoom, directWith, isMember, markRead, send } from "@/lib/chat";

export async function sendMessage(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const conversationId = Number(form.get("conversation_id"));
  const body = String(form.get("body") ?? "");

  if (!body.trim()) return { error: "Type something first." };
  if (!(await isMember(conversationId, user.uid)))
    return { error: "You are not in that conversation." };

  await send(conversationId, user.uid, body);
  revalidatePath("/messages");
  return { ok: "" };
}

export async function openDirect(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const otherId = Number(form.get("user_id"));
  if (!otherId || otherId === user.uid) return { error: "Pick somebody else." };

  const id = await directWith(user.uid, otherId);
  redirect(`/messages?c=${id}`);
}

export async function openCentreRoom(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const centerId = Number(form.get("center_id"));
  if (!canTouchCenter(user, centerId))
    return { error: "That centre is not one of yours." };

  const id = await centreRoom(centerId);
  redirect(`/messages?c=${id}`);
}

export async function readConversation(conversationId: number) {
  const user = await requireUser();
  if (!(await isMember(conversationId, user.uid))) return;
  await markRead(conversationId, user.uid);
  revalidatePath("/messages");
}
