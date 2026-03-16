-- Rename label 'under_5' to 'under_10' (category threshold changed from 5% to 10%)
UPDATE screener_events SET label = 'under_10' WHERE label = 'under_5';
