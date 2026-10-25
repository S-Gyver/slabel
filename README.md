# 📱 S-Gyver Mobile Scanner & Label Printer (PWA)

เว็บแอปพลิเคชันสำหรับ **มือถือ (iPhone/Android)** และ **iPad/Tablet** ออกแบบมาสำหรับ:
1. 📷 **สแกนบาร์โค้ด / QR Code ด้วยกล้องมือถือ** (รองรับเปิดไฟฉาย Flash / สลับกล้องหน้า-หลัง / เสียง Beep / ระบบสั่น)
2. 📦 **เช็คสต็อกสินค้าแบบเรียลไทม์** ดึงข้อมูลตรงจากฐานข้อมูล **Supabase** เดียวกับระบบ Desktop
3. ⚡ **อัปเดตสต็อกด่วน (+1 / -1 / ปรับจำนวน / ย้ายชั้นวาง)** ทำได้ทันทีผ่านมือถือ
4. 🖨️ **สั่งพิมพ์ฉลากสินค้า (PeriPage 57mm)** ได้โดยตรงจากมือถือหรือ iPad รองรับป้ายไซส์ตัวใหญ่ (Big Size) และบาร์โค้ดคมชัด

---

## 🚀 วิธีนำขึ้น GitHub Repository ใหม่

```bash
cd sgyver-mobile
git init
git add .
git commit -m "feat: initial commit for mobile scanner and label printer app"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git
git push -u origin main
```

## 🌐 วิธีนำขึ้นเว็บฟรี (Deploy Free)
สามารถเชื่อมต่อกับ:
- **Vercel**: Import repository แล้วกด Deploy ได้ทันที (Static Site ไม่ต้อง Build)
- **Cloudflare Pages**: เชื่อมต่อ repo แล้วเลือก Root directory
- **GitHub Pages**: ไปที่ Settings > Pages > Source: `main` / `root`

---

## 📲 ติดตั้งเป็นแอปบนมือถือ (Add to Home Screen)
- **iOS (Safari)**: กดปุ่ม **แชร์ (Share)** ด้านล่าง แล้วเลือก **"เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)**
- **Android (Chrome)**: กดจุด 3 จุดมุมบนขวา แล้วเลือก **"ติดตั้งแอป" (Install App)** หรือ **"เพิ่มไปยังหน้าจอหลัก"**
