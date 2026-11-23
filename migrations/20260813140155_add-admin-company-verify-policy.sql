-- Allow admins (super_admin / government_officer) to update any company,
-- e.g. to verify businesses from the Verify Companies admin page.
-- Complements the existing owner-only update policy.
CREATE POLICY admin_can_update_companies ON public.companies
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('super_admin', 'government_officer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('super_admin', 'government_officer')
    )
  );
