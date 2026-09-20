import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseExperience,
  parseSelfState,
  serializeSelfState,
  type Experience,
  type SelfState,
} from "@/lib/ai/self-model";
import {
  parseExploration,
  type ExplorationQuest,
} from "@/lib/ai/today-exploration";

export async function loadSelfSnapshot(personaId: string): Promise<{
  state: SelfState | null;
  experiences: Experience[];
}> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_resident_memories")
      .select("memory_type, content, created_at")
      .eq("persona_id", personaId)
      .in("memory_type", ["self_state", "experience", "reflection", "decision"])
      .order("created_at", { ascending: false })
      .limit(24);
    if (error || !data) return { state: null, experiences: [] };

    const stateRow = data.find((row) => row.memory_type === "self_state");
    const experiences = data
      .filter((row) => row.memory_type === "experience")
      .map((row) => parseExperience(String(row.content ?? "")))
      .filter((item): item is Experience => Boolean(item));

    return {
      state: parseSelfState(stateRow ? String(stateRow.content ?? "") : null),
      experiences,
    };
  } catch {
    return { state: null, experiences: [] };
  }
}

export async function persistSelfSnapshot(input: {
  personaId: string;
  state: SelfState;
  experience?: Experience | null;
  reflection?: string | null;
  decision?: string | null;
}) {
  try {
    const admin = createAdminClient();
    const rows: Array<{
      persona_id: string;
      memory_type: string;
      subject_type: string;
      subject_id: string | null;
      content: string;
      importance: number;
    }> = [
      {
        persona_id: input.personaId,
        memory_type: "self_state",
        subject_type: "snapshot",
        subject_id: input.personaId,
        content: serializeSelfState(input.state),
        importance: 3,
      },
    ];
    if (input.experience) {
      rows.push({
        persona_id: input.personaId,
        memory_type: "experience",
        subject_type: "entity",
        subject_id: input.experience.entityKey ?? null,
        content: JSON.stringify(input.experience),
        importance: 2,
      });
    }
    if (input.decision) {
      rows.push({
        persona_id: input.personaId,
        memory_type: "decision",
        subject_type: "decision",
        subject_id: null,
        content: input.decision.slice(0, 500),
        importance: 2,
      });
    }
    if (input.reflection) {
      rows.push({
        persona_id: input.personaId,
        memory_type: "reflection",
        subject_type: "reflection",
        subject_id: null,
        content: input.reflection.slice(0, 500),
        importance: 2,
      });
    }
    const { error } = await admin.from("ai_resident_memories").insert(rows);
    if (error) {
      console.warn("self snapshot persist failed", error.message);
    }
  } catch (error) {
    console.warn("self snapshot unavailable", error);
  }
}

export async function loadRecentExplorations(
  personaId: string,
): Promise<ExplorationQuest[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_resident_memories")
      .select("content, created_at")
      .eq("persona_id", personaId)
      .eq("subject_type", "exploration")
      .order("created_at", { ascending: false })
      .limit(8);
    if (error || !data) return [];
    return data
      .map((row) => parseExploration(String(row.content ?? "")))
      .filter((item): item is ExplorationQuest => Boolean(item));
  } catch {
    return [];
  }
}
