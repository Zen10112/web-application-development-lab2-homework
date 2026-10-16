# HW1 – Enterprise Employee Data-Grid (Giai đoạn 1)

React + TypeScript + Vite, bảng HTML semantic có 30 nhân viên mẫu.

## Yêu cầu

- Node.js bản tương thích với Vite 7 (Node.js 20.19+ hoặc 22.12+).
- npm.

## Cách chạy

Mở terminal tại thư mục `hw1-data-grid` và chạy:

```bash
npm install
npm run dev
```

Mở URL Vite hiển thị (thường là http://localhost:5173/).

## Kiểm tra build

```bash
npm run build
```

## Cấu trúc

- `src/types/data-grid-contract.ts`: hai interface đúng đề.
- `src/components/DataGrid.tsx`: component generic, dùng native HTML table.
- `src/components/DataGrid.css`: CSS của bảng.
- `src/data/employees.ts`: 30 nhân viên mẫu.
- `src/App.tsx`: cấu hình cột và sử dụng DataGrid.
- `src/App.css`: bố cục giao diện.
- `src/index.css`: CSS toàn cục.
- `src/main.tsx`: điểm vào của React.

## Phạm vi

Đã làm: khởi tạo, hiển thị bảng, CSS cơ bản.

Chưa làm: sorting, filtering, pagination, row selection, keyboard navigation, ARIA grid tương tác, đánh giá WCAG 2.2 AA và xác minh Lighthouse 100/100.

Lưu ý: `sortable` mới là thuộc tính cấu hình; `onRowSelect` chưa có tương tác. React row key theo index chỉ phù hợp tạm thời với bảng dữ liệu cố định này.
