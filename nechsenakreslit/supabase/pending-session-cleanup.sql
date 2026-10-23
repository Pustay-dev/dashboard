-- PENDING EXPLICIT APPROVAL: backend cleanup of contact rows and generation usage rows.
-- No access for anonymous visitors or customer accounts.
grant delete on private.gallery_contacts,private.portrait_generation_submissions to service_role;
