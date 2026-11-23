-- Allow super admins to insert in-app notifications for ANY user. Needed by
-- notification flows that send on behalf of an admin to other users:
--   notifyCompanyVerified / notifyCompanyRejected (owners) and
--   notifyAdminsVerificationRequested (other admins).
-- Without this, the existing "users_can_insert_own_notifications" policy
-- (user_id = auth.uid()) silently rejects those inserts.
CREATE POLICY admins_can_insert_notifications
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Super admins must be able to resolve a company's owners (company_members)
-- for notification/email flows such as notifyCompanyVerified /
-- notifyCompanyRejected / notifyAdminsVerificationRequested. The existing
-- "users_can_read_own_company_memberships" policy (user_id = auth.uid())
-- hides those rows from admins, which silently disables those notifications.
CREATE POLICY admins_can_read_company_members
  ON public.company_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );