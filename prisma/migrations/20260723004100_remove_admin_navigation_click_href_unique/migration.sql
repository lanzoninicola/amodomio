-- Drop the unique index so repeated href values are allowed
DROP INDEX IF EXISTS "admin_navigation_clicks_href_key";
