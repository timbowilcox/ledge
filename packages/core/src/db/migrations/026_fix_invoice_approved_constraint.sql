-- Migration 026: Fix invoice approved status constraint
--
-- Migration 025 was supposed to add 'approved' to the invoices CHECK constraint,
-- but its probe incorrectly detected the constraint as already present (because
-- the constraint NAME existed from migration 021, just without 'approved').
-- This migration re-applies the fix for databases where 025 was skipped.

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN (
    'draft', 'approved', 'sent', 'viewed', 'paid',
    'partially_paid', 'overdue', 'void'
  ));
