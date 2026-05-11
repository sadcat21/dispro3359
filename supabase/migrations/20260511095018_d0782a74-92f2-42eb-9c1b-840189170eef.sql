-- Revert the recent buggy "Replace Damaged" run for branch 9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6
UPDATE warehouse_stock SET quantity = 458.05, damaged_quantity = 0 WHERE id = '1a7d06e2-0bd7-41f8-9f4b-9d59bcb4b38a';
UPDATE warehouse_stock SET quantity = 158.01, damaged_quantity = 0 WHERE id = '0c2b7017-fb93-40cd-9c1d-f87db4db7950';
UPDATE warehouse_stock SET quantity = 185.07, damaged_quantity = 0 WHERE id = '11021384-3fbf-4319-806f-e02fd1e653c9';
UPDATE warehouse_stock SET quantity = 347.17, damaged_quantity = 0 WHERE id = '774428e4-5126-4eb9-a203-cc0f95080cc1';
UPDATE warehouse_stock SET quantity = 64.05, damaged_quantity = 0 WHERE id = 'f5530ec4-d045-4156-8fb2-de0b6af193f4';

-- Remove the corresponding stock movements
DELETE FROM stock_movements WHERE id IN (
  'cdb12edd-e276-4f1f-b85f-86277f7376a0',
  '0a7df988-4302-4198-8c96-2c75e56f296e',
  '559355f7-53f1-46da-bf6f-9e60ae5f014e',
  'eda749ae-528b-4b49-b4da-92fce8aa5523',
  '372b13dc-45eb-47b1-a3e0-eac777abd16a'
);