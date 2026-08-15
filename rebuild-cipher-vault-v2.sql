-- One-time rebuild for the Gal Einai cipher vault.
-- Run as the Supabase admin after deploying the new ciphers/ folder.

delete from public.admin_content
where type = 'example';

insert into public.admin_content (id, type, title, url, status, description, created_at, updated_at)
values
('static-ketamuz-1407', 'example', 'כתמוז 1407', 'ciphers/ketamuz-1407.png', 'active', '[vault:v2]
[topic:dates]
[image:ciphers/ketamuz-1407.png]
צופן מתוך גל עיני.', '2026-07-04T00:00:00.000Z', now()),
('static-ketamuz-hatashpu', 'example', 'כתמוז תשפו', 'ciphers/ketamuz-hatashpu.png', 'active', '[vault:v2]
[topic:dates]
[image:ciphers/ketamuz-hatashpu.png]
צופן מתוך גל עיני.', '2026-07-04T00:00:00.000Z', now()),
('static-rav-amos-hatashpu-milchama', 'example', 'הרב עמוס התשפו מלחמה', 'ciphers/rav-amos-hatashpu-milchama.png', 'active', '[vault:v2]
[topic:events]
[image:ciphers/rav-amos-hatashpu-milchama.png]
צופן מתוך גל עיני.', '2026-07-03T00:00:00.000Z', now()),
('static-atom-petzatza-iran', 'example', 'אטום פצצה אירן', 'ciphers/atom-petzatza-iran.gal_einai.json', 'active', '[vault:v2]
[topic:events]
[image:ciphers/atom-petzatza-iran.png]
[project:ciphers/atom-petzatza-iran.gal_einai.json]
צופן מתוך גל עיני.', '2026-06-21T00:00:00.000Z', now()),
('static-vetamuz-hatashpu-yenatzchu', 'example', 'ותמוז התשפו ינצחו', 'ciphers/vetamuz-yenatzchu-israel-iran-hatashpu.gal_einai.json', 'active', '[vault:v2]
[topic:events]
[image:ciphers/vetamuz-hatashpu-yenatzchu.png]
[project:ciphers/vetamuz-yenatzchu-israel-iran-hatashpu.gal_einai.json]
צופן מתוך גל עיני.', '2026-06-21T00:00:00.000Z', now()),
('static-tamuz-hatashpu-podeh-melech-71', 'example', 'תמוז התשפו פודה מלך 71', 'ciphers/tamuz3.gal_einai.json', 'active', '[vault:v2]
[topic:geula]
[image:ciphers/tamuz-hatashpu-podeh-melech-71.png]
[project:ciphers/tamuz3.gal_einai.json]
צופן מתוך גל עיני.', '2026-06-21T00:00:00.000Z', now()),
('static-geula-m-hapeh-bigevura', 'example', 'גאולה מ ה-פה בגבורה', 'ciphers/geula-m-hapeh-bigevura.png', 'active', '[vault:v2]
[topic:geula]
[image:ciphers/geula-m-hapeh-bigevura.png]
צופן מתוך גל עיני.', '2026-07-02T00:00:00.000Z', now()),
('static-hey-july', 'example', 'ה יולי', 'ciphers/hey-july.png', 'active', '[vault:v2]
[topic:dates]
[image:ciphers/hey-july.png]
צופן מתוך גל עיני.', '2026-07-02T00:00:00.000Z', now()),
('static-yom-mashiach-ba-583-ketamuz', 'example', 'יום משיח בא 583 כתמוז', 'ciphers/yom-mashiach-ba-583-ketamuz.png', 'active', '[vault:v2]
[topic:geula]
[image:ciphers/yom-mashiach-ba-583-ketamuz.png]
צופן מתוך גל עיני.', '2026-07-02T00:00:00.000Z', now()),
('static-leshiul-shemen-zayit-lechem-boker', 'example', 'לשיעול שמן זית ולחם בקר', 'ciphers/leshiul-shemen-zayit-lechem-boker.png', 'active', '[vault:v2]
[topic:healing]
[image:ciphers/leshiul-shemen-zayit-lechem-boker.png]
צופן מתוך גל עיני.', '2026-07-02T00:00:00.000Z', now()),
('static-heymanot-kesau', 'example', 'הימנוט קסאו', 'ciphers/heymanot-kesau.png', 'active', '[vault:v2]
[topic:events]
[image:ciphers/heymanot-kesau.png]
צופן מתוך גל עיני.', '2026-07-02T00:00:00.000Z', now());
