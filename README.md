# VVK Spring Fair Manager

Ứng dụng quản lý Hội Trại Xuân VVK 2026 - Trường THPT Võ Văn Kiệt.

## Yêu cầu

- Node.js 18+
- Docker (để chạy PostgreSQL)

## Cài đặt

```bash
npm install
```

## Khởi động PostgreSQL với Docker

```bash
docker run --name vvk-postgres -e POSTGRES_USER=vvk -e POSTGRES_PASSWORD=vvk2026 -e POSTGRES_DB=vvk_spring_fair -p 5432:5432 -d postgres:16-alpine
```

## Khởi tạo dữ liệu

```bash
npm run seed
```

## Chạy ứng dụng

```bash
npm start
```

Truy cập: http://localhost:3000

## Tài khoản đăng nhập

| Loại | Tài khoản | Mật khẩu |
|------|-----------|----------|
| Admin | ADMIN | admin_vvk_secret |
| Lớp học | 12A1, 12A2, ... | vvk2026 |

## Tính năng

- **Lớp trưởng:** Đăng ký thông tin ngân hàng, đăng ký sinh viên + CCCD
- **Admin:** Xem danh sách tài chính, danh sách sinh viên, tìm kiếm/lọc dữ liệu

## Công nghệ

- Node.js + Express
- PostgreSQL + Sequelize
- EJS + Bootstrap 5
- bcrypt + express-session
- multer (upload ảnh)

## Docker Commands

```bash
# Check PostgreSQL status
docker ps --filter name=vvk-postgres

# Stop container
docker stop vvk-postgres

# Start container
docker start vvk-postgres

# View logs
docker logs vvk-postgres

# Connect via psql
docker exec -it vvk-postgres psql -U vvk -d vvk_spring_fair
```
