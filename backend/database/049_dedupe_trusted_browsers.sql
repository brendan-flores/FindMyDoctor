-- Collapse duplicate active trusted-browser rows for the same user and device.
--
-- registerTrustedBrowser used to insert a new row every time a browser was
-- trusted, so repeated trust/OTP cycles produced several active rows with the
-- same device_info. Keep the most recently created active row per
-- (user_id, device_info) — it corresponds to the latest issued cookie — and
-- revoke the older duplicates. Idempotent: re-running is a no-op.

UPDATE trusted_browsers tb
SET revoked_at = CURRENT_TIMESTAMP
WHERE tb.revoked_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM trusted_browsers newer
    WHERE newer.user_id = tb.user_id
      AND newer.device_info IS NOT DISTINCT FROM tb.device_info
      AND newer.revoked_at IS NULL
      AND (
        newer.created_at > tb.created_at
        OR (newer.created_at = tb.created_at AND newer.id > tb.id)
      )
  );
