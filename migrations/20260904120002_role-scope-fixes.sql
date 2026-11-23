-- Role-scope fixes: government_officer is treated as an admin everywhere in
-- the app (route guards, sidebar, verification UI) but two RLS policies only
-- allowed super_admin, so officer actions silently no-op'd. Also harden
-- messages INSERT so only room members can post (all app send-paths join
-- membership first via ensureMembership / room creation).

-- government_officer may notify users (verify / reject flows call
-- createNotification as the acting officer).
DROP POLICY IF EXISTS admins_can_insert_notifications ON public.notifications;
CREATE POLICY admins_can_insert_notifications
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'government_officer')
  )
);

-- government_officer verifiers read company memberships (getCompanyOwners).
DROP POLICY IF EXISTS admins_can_read_company_members ON public.company_members;
CREATE POLICY admins_can_read_company_members
ON public.company_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'government_officer')
  )
);

-- Only room members may post (previously any authenticated user could insert
-- into any room; the UI was the only restraint).
DROP POLICY IF EXISTS users_can_insert_own_messages ON public.messages;
CREATE POLICY users_can_insert_own_messages
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_room_member(chat_room_id)
);
