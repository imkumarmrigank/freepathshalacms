"use client";
import { useActionState } from "react";
import { setExamStatus } from "../actions";

export default function PublishToggle({ examId, status }: { examId: number; status: string }) {
  const [state, action] = useActionState(setExamStatus, null);
  const publishing = status !== "published";
  return (
    <form action={action}>
      <input type="hidden" name="exam_id" value={examId} />
      <input type="hidden" name="status" value={publishing ? "published" : "open"} />
      <button className={`btn btn-sm ${publishing ? "btn-primary" : "btn-ghost"}`} type="submit"
        title={state?.error ?? ""}>
        {publishing ? "Publish results" : "Reopen for editing"}
      </button>
    </form>
  );
}
