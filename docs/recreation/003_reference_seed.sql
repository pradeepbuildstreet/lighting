BEGIN;
INSERT INTO fixture_types(code,name) VALUES ('pendant','Pendant'),('wall_sconce','Wall Sconce'),('chandelier','Chandelier'),('table_lamp','Table Lamp'),('floor_lamp','Floor Lamp');
INSERT INTO light_types(code,name,base_type,technology) VALUES ('E27_LED','E27 LED','E27','LED'),('E14_LED','E14 LED','E14','LED'),('GU10_LED','GU10 LED','GU10','LED'),('G9_LED','G9 LED','G9','LED');
INSERT INTO categories(slug,name) VALUES ('decorative-lighting','Decorative Lighting'),('shop-by-room','Shop by Room');
INSERT INTO categories(slug,name,parent_id) SELECT 'pendant','Pendant Lights',id FROM categories WHERE slug='decorative-lighting';
INSERT INTO categories(slug,name,parent_id) SELECT 'dining-room-lighting','Dining Room Lighting',id FROM categories WHERE slug='shop-by-room';
COMMIT;
