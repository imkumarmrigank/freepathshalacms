"use client";
import { useActionState, useState } from "react";
import { Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { replyToSuggestion } from "../../actions";

/**
 * The centre's answer.
 *
 * Saying what you did and marking it done are the same act, so they are one
 * form — a separate "mark as done" button invites a centre to tick things off
 * without ever saying what they actually did, which is exactly what the auditor
 * needs to read on the next visit.
 */
export default function Answer({ suggestionId, status, mayAnswer }: {
  suggestionId: number; status: string; mayAnswer: boolean;
}) {
  const [state, action] = useActionState(replyToSuggestion, null);
  const [move, setMove] = useState(status === "open" ? "in_progress" : "done");

  return (
    <div className="card card-pad mt-4">
      <h2 className="mb-3 text-[14px] font-semibold">
        {mayAnswer ? "Answer this" : "Add a note"}
      </h2>
      <form action={action}>
        <FormMessage state={state} />
        <input type="hidden" name="suggestion_id" value={suggestionId} />

        <Field label={mayAnswer ? "What have you done about it? *" : "Note *"}>
          <textarea className="textarea" name="body" rows={3} required
            placeholder={mayAnswer
              ? "Carpenter came on Tuesday and rehung the door; photo sent to the mentor."
              : "Anything worth recording against this."} />
        </Field>

        <div className="flex flex-wrap items-end justify-between gap-3">
          {mayAnswer ? (
            <label className="min-w-[200px]">
              <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">
                Where does this stand?
              </span>
              <select className="select w-auto" name="set_status" value={move}
                onChange={(e) => setMove(e.target.value)}>
                <option value="in_progress">We have started on it</option>
                <option value="done">It is done</option>
                <option value="">Just a note — no change</option>
              </select>
            </label>
          ) : <span />}
          <div className="mb-[1px]"><Submit>Send</Submit></div>
        </div>

        {mayAnswer && move === "done" && (
          <p className="mt-2 text-[12.5px] text-[var(--muted)]">
            The auditor confirms this at their next visit. It counts towards your
            centre&rsquo;s monthly score once they have.
          </p>
        )}
      </form>
    </div>
  );
}
