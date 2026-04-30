-- Fix plans permissions and limits
UPDATE plans 
SET has_blog_automation = true, max_sites = 50 
WHERE slug = 'agency' OR name = 'Business Plan';

UPDATE plans 
SET has_blog_automation = true, max_sites = 10 
WHERE slug = 'starter';

UPDATE plans 
SET has_blog_automation = true, max_sites = 25 
WHERE slug = 'pro';

-- Ensure admin has the right plan
UPDATE users SET plan = 'agency' WHERE is_admin = true;
