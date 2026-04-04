import type { PoolClient } from "pg";

export type Categoria = "programacao" | "informatica";

export type Queryable = Pick<PoolClient, "query">;

export type DbClassRow = {
  id: number;
  current_module_id: number;
  course_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
};

export type DbCourseRow = {
  id: number;
  name: string | null;
  description: string | null;
  is_paid: boolean;
  duration_hours: number | null;
  level: string | null;
  focus: string | null;
  price: number | null;
};

export type CourseColumnConfig = {
  hasCourseTable: boolean;
  durationColumn: "duration_hours" | null;
  levelColumn: "level_difficulty" | "level" | null;
  focusColumn: "paid_focus" | "focus" | null;
  priceColumn: "price" | null;
  selectList: string;
};

export type ProgressStudentPhaseConfig = {
  hasTable: boolean;
  hasUserIdColumn: boolean;
  hasPhaseIdColumn: boolean;
  hasProgressColumn: boolean;
  hasStatusColumn: boolean;
  hasUnlockedAtColumn: boolean;
  hasCompletedAtColumn: boolean;
  hasCreatedAtColumn: boolean;
};

export type DbModuleRow = {
  id: number;
  course_id: number;
  name: string | null;
  description: string | null;
  index_order: number;
};

export type DbPhaseRow = {
  id: number;
  module_id: number;
  name: string | null;
  week_number: number;
  index_order: number;
  admin_authorize: boolean;
  created_at: string;
  updated_at: string;
};

export type DbStudentPhaseProgressRow = {
  user_id: number;
  status: number | null;
  progress: number | null;
  unlocked_at: string | null;
};
