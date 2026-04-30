-- Fix Free Plan consistency
UPDATE plans 
SET max_sites = 0, 
    has_blog_automation = false 
WHERE slug = 'free' OR name = 'Free Plan';
