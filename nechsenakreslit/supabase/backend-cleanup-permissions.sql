-- Approved by Jakub and applied on 2026-10-23. Server-only cleanup permissions.
-- Anonymous visitors and customer accounts receive no additional access.
grant delete on private.gallery_contacts,private.portrait_generation_submissions to service_role;
