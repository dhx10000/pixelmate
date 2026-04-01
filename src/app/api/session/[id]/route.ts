import { supabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "Invalid session ID" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, current_state, conversation_history, agent_outputs, file_summaries"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  return Response.json(data);
}
