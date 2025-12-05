const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// ایجاد پوشه public اگر وجود ندارد
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

// ایجاد پوشه captures اگر وجود ندارد
const capturesDir = path.join(__dirname, 'captures');
if (!fs.existsSync(capturesDir)) {
    fs.mkdirSync(capturesDir);
}

// میزبانی فایل‌های استاتیک
app.use(express.static(publicDir));

// مسیرهای اصلی
app.get('/', (req, res) => {
    res.send(`
        <html>
        <body style="font-family: Tahoma; text-align: center; padding: 50px;">
            <h1>📹 سیستم کنترل دوربین</h1>
            <p><a href="/admin" style="font-size: 20px;">🎮 پنل کنترل (برای کامپیوتر)</a></p>
            <p><a href="/client" style="font-size: 20px;">📱 صفحه دوربین (برای گوشی)</a></p>
            <p>پورت سرور: ${PORT}</p>
        </body>
        </html>
    `);
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin.html'));
});

app.get('/client', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/client.html'));
});

// برای دانلود تصاویر
app.get('/captures/:filename', (req, res) => {
    res.sendFile(path.join(__dirname, 'captures', req.params.filename));
});

// مدیریت اتصالات
let adminSocket = null;
let clientSocket = null;

io.on('connection', (socket) => {
    console.log('اتصال جدید:', socket.id);
    
    socket.on('identify', (role) => {
        if (role === 'admin') {
            adminSocket = socket;
            console.log('✅ ادمین متصل شد');
        } else if (role === 'client') {
            clientSocket = socket;
            console.log('📱 کلاینت متصل شد');
        }
    });
    
    // ارسال استریم از کلاینت به ادمین
    socket.on('stream', (data) => {
        if (adminSocket && socket.id === clientSocket?.id) {
            adminSocket.emit('stream', data);
        }
    });
    
    // دستورات از ادمین به کلاینت
    socket.on('command', (command) => {
        if (clientSocket && socket.id === adminSocket?.id) {
            clientSocket.emit('command', command);
        }
    });
    
    // دریافت تصاویر ضبط شده
    socket.on('captured-image', (data) => {
        if (socket.id === clientSocket?.id) {
            const timestamp = new Date().getTime();
            const filename = `capture-${timestamp}.jpg`;
            const imagePath = path.join(capturesDir, filename);
            
            // ذخیره تصویر
            const base64Data = data.image.replace(/^data:image\/jpeg;base64,/, '');
            fs.writeFileSync(imagePath, base64Data, 'base64');
            
            console.log(`📸 تصویر ذخیره شد: ${filename}`);
            
            // اطلاع به ادمین
            if (adminSocket) {
                adminSocket.emit('image-captured', { 
                    filename: filename,
                    timestamp: new Date().toLocaleString('fa-IR')
                });
            }
        }
    });
    
    socket.on('disconnect', () => {
        console.log('قطع اتصال:', socket.id);
        if (socket.id === adminSocket?.id) {
            adminSocket = null;
            console.log('❌ ادمین قطع شد');
        }
        if (socket.id === clientSocket?.id) {
            clientSocket = null;
            console.log('📴 کلاینت قطع شد');
        }
    });
});

server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('🚀 سرور راه‌اندازی شد!');
    console.log(`🌐 آدرس‌های قابل دسترسی:`);
    console.log(`📊 پنل کنترل: http://localhost:${PORT}/admin`);
    console.log(`📱 صفحه گوشی: http://localhost:${PORT}/client`);
    console.log('='.repeat(50));
    console.log('\n📝 دستورات:');
    console.log('1. پنل کنترل را روی کامپیوتر باز کنید');
    console.log('2. صفحه گوشی را روی موبایل باز کنید');
    console.log('3. روی کامپیوتر، دکمه "شروع استریم" را بزنید');
});