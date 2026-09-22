export type Role = 'admin' | 'member' | 'guest';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom_days';
export type CompletionMode = 'manual' | 'auto_from_subtasks';
export type TemplateVisibility = 'personal' | 'container' | 'public';
export type ModerationStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_color: string;
          theme_gradient: string[];
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_color?: string;
          theme_gradient?: string[];
          created_at?: string;
        };
        Update: Partial<{ display_name: string | null; avatar_color: string; theme_gradient: string[] }>;
      };
      ical_subscriptions: {
        Row: { id: string; user_id: string; label: string; url: string; color: string; visible: boolean; sort_order: number; created_at: string };
        Insert: {
          id?: string;
          user_id: string;
          label: string;
          url: string;
          color?: string;
          visible?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<{ label: string; url: string; color: string; visible: boolean; sort_order: number }>;
      };
      google_oauth_accounts: {
        Row: {
          user_id: string;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          scope: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          scope: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{ access_token: string; refresh_token: string; expires_at: string; scope: string; updated_at: string }>;
      };
      google_calendars: {
        Row: {
          id: string;
          user_id: string;
          google_calendar_id: string;
          label: string;
          color: string;
          visible: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          google_calendar_id: string;
          label: string;
          color?: string;
          visible?: boolean;
          created_at?: string;
        };
        Update: Partial<{ label: string; color: string; visible: boolean }>;
      };
      container_google_sync: {
        Row: {
          container_id: string;
          synced_by: string;
          google_calendar_id: string;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          container_id: string;
          synced_by: string;
          google_calendar_id: string;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{ synced_by: string; google_calendar_id: string; enabled: boolean; updated_at: string }>;
      };
      task_google_events: {
        Row: { task_id: string; container_id: string; google_event_id: string; created_at: string; updated_at: string };
        Insert: {
          task_id: string;
          container_id: string;
          google_event_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{ google_event_id: string; updated_at: string }>;
      };
      households: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string; created_at?: string };
        Update: Partial<{ name: string }>;
      };
      household_members: {
        Row: { id: string; household_id: string; user_id: string; created_at: string };
        Insert: { id?: string; household_id: string; user_id: string; created_at?: string };
        Update: Record<string, never>;
      };
      containers: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          icon: string;
          color: string;
          paused_until: string | null;
          pause_reason: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          icon?: string;
          color?: string;
          paused_until?: string | null;
          pause_reason?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<{
          name: string;
          icon: string;
          color: string;
          paused_until: string | null;
          pause_reason: string | null;
        }>;
      };
      container_members: {
        Row: { id: string; container_id: string; user_id: string; role: Role; created_at: string };
        Insert: { id?: string; container_id: string; user_id: string; role?: Role; created_at?: string };
        Update: Partial<{ role: Role }>;
      };
      container_invitations: {
        Row: {
          id: string;
          container_id: string;
          token: string;
          role: Role;
          email: string | null;
          created_by: string;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          container_id: string;
          token?: string;
          role?: Role;
          email?: string | null;
          created_by: string;
          expires_at?: string;
          created_at?: string;
        };
        Update: Partial<{ expires_at: string }>;
      };
      rooms: {
        Row: {
          id: string;
          container_id: string;
          name: string;
          icon: string;
          color: string | null;
          freshness_days: number;
          sort_order: number;
          paused_until: string | null;
          pause_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          container_id: string;
          name: string;
          icon?: string;
          color?: string | null;
          freshness_days?: number;
          sort_order?: number;
          paused_until?: string | null;
          pause_reason?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          name: string;
          icon: string;
          color: string | null;
          freshness_days: number;
          sort_order: number;
          paused_until: string | null;
          pause_reason: string | null;
        }>;
      };
      room_templates: {
        Row: {
          id: string;
          owner_container_id: string | null;
          created_by: string | null;
          name: string;
          icon: string;
          is_system: boolean;
          visibility: TemplateVisibility;
          moderation_status: ModerationStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_container_id?: string | null;
          created_by?: string | null;
          name: string;
          icon?: string;
          is_system?: boolean;
          visibility?: TemplateVisibility;
          moderation_status?: ModerationStatus;
          created_at?: string;
        };
        Update: Partial<{
          name: string;
          icon: string;
          visibility: TemplateVisibility;
          moderation_status: ModerationStatus;
        }>;
      };
      room_template_items: {
        Row: {
          id: string;
          template_id: string;
          parent_item_id: string | null;
          title: string;
          description: string | null;
          recurrence_type: RecurrenceType;
          recurrence_interval: number;
          recurrence_weekdays: string | null;
          priority: Priority;
          freshness_days: number | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          template_id: string;
          parent_item_id?: string | null;
          title: string;
          description?: string | null;
          recurrence_type?: RecurrenceType;
          recurrence_interval?: number;
          recurrence_weekdays?: string | null;
          priority?: Priority;
          freshness_days?: number | null;
          sort_order?: number;
        };
        Update: Partial<{
          title: string;
          description: string | null;
          recurrence_type: RecurrenceType;
          recurrence_interval: number;
          recurrence_weekdays: string | null;
          priority: Priority;
          freshness_days: number | null;
          sort_order: number;
        }>;
      };
      event_templates: {
        Row: {
          id: string;
          owner_container_id: string | null;
          created_by: string | null;
          name: string;
          icon: string;
          is_system: boolean;
          visibility: TemplateVisibility;
          moderation_status: ModerationStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_container_id?: string | null;
          created_by?: string | null;
          name: string;
          icon?: string;
          is_system?: boolean;
          visibility?: TemplateVisibility;
          moderation_status?: ModerationStatus;
          created_at?: string;
        };
        Update: Partial<{
          name: string;
          icon: string;
          visibility: TemplateVisibility;
          moderation_status: ModerationStatus;
        }>;
      };
      event_template_items: {
        Row: {
          id: string;
          event_template_id: string;
          title: string;
          description: string | null;
          offset_days: number;
          priority: Priority;
          recurrence_type: RecurrenceType;
          sort_order: number;
        };
        Insert: {
          id?: string;
          event_template_id: string;
          title: string;
          description?: string | null;
          offset_days?: number;
          priority?: Priority;
          recurrence_type?: RecurrenceType;
          sort_order?: number;
        };
        Update: Partial<{
          title: string;
          description: string | null;
          offset_days: number;
          priority: Priority;
          recurrence_type: RecurrenceType;
          sort_order: number;
        }>;
      };
      events: {
        Row: {
          id: string;
          container_id: string;
          name: string;
          event_date: string;
          template_id: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          container_id: string;
          name: string;
          event_date: string;
          template_id?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<{ name: string; event_date: string; notes: string | null }>;
      };
      tasks: {
        Row: {
          id: string;
          container_id: string;
          room_id: string | null;
          parent_task_id: string | null;
          title: string;
          description: string | null;
          status: TaskStatus;
          priority: Priority;
          recurrence_type: RecurrenceType;
          recurrence_interval: number;
          recurrence_weekdays: string | null;
          due_date: string | null;
          start_at: string | null;
          duration_minutes: number | null;
          on_calendar: boolean;
          freshness_days: number | null;
          last_completed_at: string | null;
          completion_mode: CompletionMode;
          seasonal_start_month: number | null;
          seasonal_end_month: number | null;
          paused_until: string | null;
          pause_reason: string | null;
          source_template_item_id: string | null;
          source_event_id: string | null;
          sort_order: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          container_id: string;
          room_id?: string | null;
          parent_task_id?: string | null;
          title: string;
          description?: string | null;
          status?: TaskStatus;
          priority?: Priority;
          recurrence_type?: RecurrenceType;
          recurrence_interval?: number;
          recurrence_weekdays?: string | null;
          due_date?: string | null;
          start_at?: string | null;
          duration_minutes?: number | null;
          on_calendar?: boolean;
          freshness_days?: number | null;
          completion_mode?: CompletionMode;
          seasonal_start_month?: number | null;
          seasonal_end_month?: number | null;
          paused_until?: string | null;
          pause_reason?: string | null;
          source_template_item_id?: string | null;
          source_event_id?: string | null;
          sort_order?: number;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<{
          room_id: string | null;
          parent_task_id: string | null;
          title: string;
          description: string | null;
          status: TaskStatus;
          priority: Priority;
          recurrence_type: RecurrenceType;
          recurrence_interval: number;
          recurrence_weekdays: string | null;
          due_date: string | null;
          start_at: string | null;
          duration_minutes: number | null;
          on_calendar: boolean;
          freshness_days: number | null;
          completion_mode: CompletionMode;
          seasonal_start_month: number | null;
          seasonal_end_month: number | null;
          paused_until: string | null;
          pause_reason: string | null;
          sort_order: number;
        }>;
      };
      task_assignees: {
        Row: { task_id: string; user_id: string };
        Insert: { task_id: string; user_id: string };
        Update: Record<string, never>;
      };
      task_completions: {
        Row: {
          id: string;
          task_id: string;
          completed_by: string;
          completed_at: string;
          comment: string | null;
          photo_url: string | null;
          was_late: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          completed_by: string;
          completed_at?: string;
          comment?: string | null;
          photo_url?: string | null;
          was_late?: boolean | null;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_household_with_container: {
        Args: {
          p_household_name: string;
          p_container_name: string;
          p_container_icon?: string;
          p_container_color?: string;
        };
        Returns: { household_id: string; container_id: string }[];
      };
      create_container: {
        Args: { p_household_id: string; p_name: string; p_icon?: string; p_color?: string };
        Returns: string;
      };
      accept_container_invitation: { Args: { p_token: string }; Returns: string };
      apply_room_template: { Args: { p_template_id: string; p_room_id: string }; Returns: number };
      apply_event_template: {
        Args: { p_template_id: string; p_container_id: string; p_name: string; p_event_date: string };
        Returns: string;
      };
    };
  };
}
