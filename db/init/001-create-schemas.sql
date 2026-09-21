-- Chạy tự động 1 LẦN DUY NHẤT khi volume dữ liệu Postgres còn trống (lần đầu
-- container postgres khởi tạo). Tạo sẵn 2 schema theo quyết định "1 database,
-- 2 schema riêng" — xem docs/SRS_HLD_Kho_bai_Container_v3.drawio.
CREATE SCHEMA IF NOT EXISTS management;
CREATE SCHEMA IF NOT EXISTS optimize;
