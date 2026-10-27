# RE-BOUND ⚡

> **Đấu Trường Bóng Nảy Chiến Thuật Thời Gian Thực (Fast-Paced Tactical Bouncing Arena)**  
> Được xây dựng hoàn toàn bằng **TypeScript**, **Vite** và **HTML5 Canvas 2D**.

---

## 🎮 Giới Thiệu Trò Chơi

**Re-Bound** là tựa game đối kháng vật lý tốc độ cao nơi các quả bóng chiến binh sở hữu những kỹ năng độc đáo chiến đấu bên trong một sàn đấu hình vuông xoay liên tục:
- **🌐 Đấu Online 1v1 (3vs3 Lôi Đài P2P):** Kết nối trực tiếp 2 người chơi qua WebRTC (PeerJS). Chọn 3 tướng qua Draft Pick luân phiên công khai, ngắm bắn bí mật (Blind Aim) và đối đầu 1v1 kế tiếp (King of the Hill) – bóng thắng giữ nguyên HP để đánh tiếp, ai hết 3 bóng trước sẽ thua!
- **⚔️ Đấu Trường Sandbox (1v1 Trên Cùng Máy):** Tùy chỉnh tự do 2 bên, điều chỉnh góc và lực nhắm.
- **🔮 Đấu Sinh Tồn (Battle Royale):** 4 bóng hỗn chiến trong sàn đấu nảy xoay.

---

## 🚀 Hướng Dẫn Triển Khai Lên Web (Deploy Vercel)

Dự án được tối ưu 100% Client-side WebRTC Serverless, có thể deploy hoàn toàn miễn phí lên **Vercel** chỉ trong 1 phút:

### Cách 1: Deploy bằng Vercel CLI (Nhanh nhất)
```bash
# Cài đặt Vercel CLI nếu chưa có
npm i -g vercel

# Đăng nhập và deploy production
vercel --prod
```

### Cách 2: Deploy qua GitHub & Vercel Dashboard
1. Khởi tạo Git và đẩy mã nguồn lên GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: Add online 1v1 multiplayer and vercel config"
   git remote add origin https://github.com/<your-username>/re-bound.git
   git push -u origin main
   ```
2. Truy cập [vercel.com](https://vercel.com), bấm **Add New Project** và nhập repository GitHub của bạn.
3. Framework Preset: **Vite**, Output Directory: **dist**.
4. Bấm **Deploy** – trang web sẽ online tại đường link dạng `https://re-bound.vercel.app`!

---

## 🚀 Khởi Động Nhanh (Quick Start)

Yêu cầu môi trường: **Node.js 18+**

```bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Khởi chạy máy chủ phát triển (Dev Server)
npm run dev
# Mở trình duyệt tại: http://localhost:5173/

# 3. Kiểm tra TypeScript & Đóng gói sản phẩm
npm run build
```

---

## 🛡️ Danh Sách Tướng & Kỹ Năng

1. **🔥 Hỏa Long (Blaze Dragon):** Tăng tốc x3.0 trong 4s, đâm phát nổ cực mạnh tỷ lệ thuận theo vận tốc.
2. **❄️ Băng Ngân (Frost Crystal):** Tạo vùng bão tuyết 30s; đối thủ trúng chiêu bị đóng băng cứng không thể gây sát thương.
3. **🧪 Độc Mãng (Toxic Serpent):** Phun 6 vũng độc ăn mòn rút máu liên tục.
4. **⚡ Lôi Thần (Volt Striker):** Cứ mỗi lần nảy tường tăng **+10% tốc chạy**; tạo vệt sét làm giảm 30% sát thương đâm và tăng 30% sát thương nhận vào của kẻ địch.
5. **🛡️ Cự Thần (Titan Colossus):** Giảm 60% sát thương nhận vào, tăng 40% thể tích và đẩy văng mọi đối thủ khi va chạm.
6. **🩸 Huyết Dạ (Vampire Night):** Sở hữu 2 răng nanh; khi đâm trúng mặt trước sẽ **đâm dính (Latch) 1.0s** và rút máu liên tục. Khi có Nộ có thể **Overheal vượt 100% máu gốc** (tối đa 150%).

---

## 🤖 Dành Cho Nhà Phát Triển & AI Agents (Agent Onboarding)

Để nhiều lập trình viên hoặc AI Agent có thể cùng phát triển dự án mà không cần phân tích toàn bộ hàng ngàn dòng code, dự án đã được trang bị tài liệu chuẩn hóa:

- 📖 **[`AGENTS.md`](./AGENTS.md):** Bản đồ file, quy tắc bất biến, công thức thêm tướng mới và cách sửa logic trong 2 phút.
- 📐 **[`ARCHITECTURE.md`](./ARCHITECTURE.md):** Biểu đồ kiến trúc hệ thống, máy trạng thái FSM của Sandbox, quy trình con 8 sub-steps/frame và chu kỳ Ghim hút máu.

---

## 📜 Giấy Phép & Tác Quyền

Dự án phát triển nội bộ cho Re-Bound. Mọi quyền được bảo lưu.
