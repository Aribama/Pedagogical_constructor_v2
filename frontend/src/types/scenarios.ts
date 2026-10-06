

export type DayTime = "begin" | "middle" | "end";
export type AiMode = "strict" | "balanced" | "free";

export type ScenarioItemRead = {
  id: number;
  technique_card: number;
  title?: string | null;
  technique_card_title?: string | null;

  position: number;

  custom_duration_min?: number | null;

  created_at?: string;

  card_id?: number;
  order?: number;
  duration_minutes?: number | null;

  // длительность приёма: своя для сценария или из карточки
  duration_min?: number | null;
  card_kind?: string | null;
  stage_label?: string | null;
};

export type ScenarioRead = {
  id: number;
  owner?: number;
  created_at?: string;
  updated_at?: string;

  name: string | null;
  note: string;

  grade: number | null;
  subject: string | null;
  goal: string | null;

  emotionality: string;
  day_time: DayTime;
  group_size: number;
  duration_min: number;

  teacher_notes: string;
  subject_content: string;
  plan_text: string;
  ai_mode: AiMode;

  items: ScenarioItemRead[];

  title?: string | null;
  description?: string | null;
  duration_minutes?: number | null;
};

export type ScenarioPatch = Partial<Pick<
  ScenarioRead,
  | "name"
  | "note"
  | "grade"
  | "subject"
  | "goal"
  | "emotionality"
  | "day_time"
  | "group_size"
  | "duration_min"
  | "teacher_notes"
  | "subject_content"
  | "plan_text"
  | "ai_mode"
>>;

export type ScenarioItemPatch = {
  technique_card: number;
  position: number;
  custom_duration_min?: number | null;
};
