INSERT INTO plans (name, slug, description, monthly_credits, price_monthly, is_free, sort_order)
VALUES 
('Free', 'free', 'باقة تجريبية للمستخدمين الجدد', 10, 0, true, 1),
('Pro', 'pro', 'باقة للمحترفين مع ميزات إضافية', 100, 49, false, 2),
('Premium', 'premium', 'الباقة الكاملة لجميع الخدمات', 500, 99, false, 3)
ON CONFLICT (slug) DO NOTHING;
