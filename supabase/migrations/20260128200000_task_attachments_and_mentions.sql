-- Task attachments + comment mentions

-- 1) Extend notification types for mentions
DO $$
BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'comment_mention';
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- 2) Ticket attachments table
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  uploader_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_path),
  CONSTRAINT task_attachments_size_check CHECK (size_bytes <= 52428800)
);

CREATE INDEX IF NOT EXISTS task_attachments_task_idx ON public.task_attachments(task_id);
CREATE INDEX IF NOT EXISTS task_attachments_uploader_idx ON public.task_attachments(uploader_id);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_attachments_select ON public.task_attachments;
CREATE POLICY task_attachments_select ON public.task_attachments
FOR SELECT TO authenticated
USING (public.is_marketing_team());

DROP POLICY IF EXISTS task_attachments_insert ON public.task_attachments;
CREATE POLICY task_attachments_insert ON public.task_attachments
FOR INSERT TO authenticated
WITH CHECK (public.is_marketing_team() AND uploader_id = auth.uid());

DROP POLICY IF EXISTS task_attachments_delete ON public.task_attachments;
CREATE POLICY task_attachments_delete ON public.task_attachments
FOR DELETE TO authenticated
USING (public.is_marketing_team() AND (uploader_id = auth.uid() OR public.current_user_role() = 'cmo'));

-- 3) Comment mentions table
CREATE TABLE IF NOT EXISTS public.task_comment_mentions (
  comment_id uuid NOT NULL REFERENCES public.task_comments (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE public.task_comment_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_comment_mentions_select ON public.task_comment_mentions;
CREATE POLICY task_comment_mentions_select ON public.task_comment_mentions
FOR SELECT TO authenticated
USING (public.is_marketing_team());

DROP POLICY IF EXISTS task_comment_mentions_insert ON public.task_comment_mentions;
CREATE POLICY task_comment_mentions_insert ON public.task_comment_mentions
FOR INSERT TO authenticated
WITH CHECK (public.is_marketing_team());

-- 4) Comment attachments join table
CREATE TABLE IF NOT EXISTS public.task_comment_attachments (
  comment_id uuid NOT NULL REFERENCES public.task_comments (id) ON DELETE CASCADE,
  attachment_id uuid NOT NULL REFERENCES public.task_attachments (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, attachment_id)
);

ALTER TABLE public.task_comment_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_comment_attachments_select ON public.task_comment_attachments;
CREATE POLICY task_comment_attachments_select ON public.task_comment_attachments
FOR SELECT TO authenticated
USING (public.is_marketing_team());

DROP POLICY IF EXISTS task_comment_attachments_insert ON public.task_comment_attachments;
CREATE POLICY task_comment_attachments_insert ON public.task_comment_attachments
FOR INSERT TO authenticated
WITH CHECK (public.is_marketing_team());

-- 5) Notify mentioned users
CREATE OR REPLACE FUNCTION public.notify_task_comment_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  comment_body text;
  comment_author uuid;
  task_id uuid;
  task_title text;
BEGIN
  SELECT c.body, c.author_id, c.task_id INTO comment_body, comment_author, task_id
  FROM public.task_comments c
  WHERE c.id = NEW.comment_id;

  IF task_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF comment_author IS NOT NULL AND NEW.user_id = comment_author THEN
    RETURN NEW;
  END IF;

  SELECT t.title INTO task_title
  FROM public.tasks t
  WHERE t.id = task_id;

  PERFORM public.insert_notification(
    NEW.user_id,
    'comment_mention',
    'Mentioned in a comment',
    COALESCE(task_title, 'Ticket') || ': ' || COALESCE(left(comment_body, 140), ''),
    task_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_comment_mentions_notify ON public.task_comment_mentions;
CREATE TRIGGER trg_task_comment_mentions_notify
AFTER INSERT ON public.task_comment_mentions
FOR EACH ROW EXECUTE FUNCTION public.notify_task_comment_mention();

-- 6) Storage bucket + policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS task_attachments_storage_select ON storage.objects;
CREATE POLICY task_attachments_storage_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND public.is_marketing_team()
  AND EXISTS (
    SELECT 1 FROM public.task_attachments a
    WHERE a.storage_path = name
  )
);

DROP POLICY IF EXISTS task_attachments_storage_insert ON storage.objects;
CREATE POLICY task_attachments_storage_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-attachments' AND public.is_marketing_team());

DROP POLICY IF EXISTS task_attachments_storage_delete ON storage.objects;
CREATE POLICY task_attachments_storage_delete ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'task-attachments' AND public.is_marketing_team());
