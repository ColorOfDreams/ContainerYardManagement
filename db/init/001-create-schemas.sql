-- Chạy tự động 1 LẦN DUY NHẤT khi volume dữ liệu Postgres còn trống (lần đầu
-- container postgres khởi tạo). Tạo schema "management" — hệ thống chỉ còn 1
-- service, 1 schema duy nhất (đã bỏ "optimize" — xem docs/SRS_HLD_Kho_bai_Container_v3.drawio).
CREATE SCHEMA IF NOT EXISTS management;
