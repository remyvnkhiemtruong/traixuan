require('dotenv').config();
const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

// Import database
const sequelize = require('./config/database');

// Import models
const ClassAccount = require('./models/ClassAccount');
const { Representative, BankAccount } = require('./models/Representative');
const Student = require('./models/Student');
const FoodItem = require('./models/FoodItem');

// Import middleware
const { checkLogin, checkAdmin } = require('./middleware/auth');

const app = express();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Chỉ cho phép upload hình ảnh (jpeg, jpg, png, gif, webp)'));
    }
});

// Database connection and sync
async function initDatabase() {
    try {
        await sequelize.authenticate();
        console.log('✅ PostgreSQL connected successfully');
        
        // Sync all models (create tables if not exist)
        await sequelize.sync({ alter: true });
        console.log('✅ Database tables synchronized');
    } catch (error) {
        console.error('❌ PostgreSQL connection error:', error);
        process.exit(1);
    }
}

initDatabase();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration (using memory store for PostgreSQL)
app.use(session({
    secret: process.env.SESSION_SECRET || 'vvk_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

// View engine setup
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');

// Global variables middleware
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.success = req.session.success;
    res.locals.error = req.session.error;
    delete req.session.success;
    delete req.session.error;
    next();
});

// ===================== AUTH ROUTES =====================

// Login page
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect(req.session.user.role === 'admin' ? '/admin' : '/');
    }
    res.render('login', { title: 'Đăng nhập - VVK Spring Fair' });
});

// Login handler
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            req.session.error = 'Vui lòng nhập đầy đủ thông tin';
            return res.redirect('/login');
        }

        const account = await ClassAccount.findOne({ 
            where: { username: username.toUpperCase() } 
        });
        
        if (!account) {
            req.session.error = 'Tài khoản không tồn tại';
            return res.redirect('/login');
        }

        const isMatch = await account.comparePassword(password);
        
        if (!isMatch) {
            req.session.error = 'Mật khẩu không chính xác';
            return res.redirect('/login');
        }

        req.session.user = {
            id: account.id,
            username: account.username,
            teacherName: account.teacherName,
            role: account.role
        };

        req.session.success = `Chào mừng ${account.username}!`;
        res.redirect(account.role === 'admin' ? '/admin' : '/');
    } catch (error) {
        console.error('Login error:', error);
        req.session.error = 'Đã có lỗi xảy ra, vui lòng thử lại';
        res.redirect('/login');
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('Logout error:', err);
        res.redirect('/login');
    });
});

// ===================== USER ROUTES =====================

// Dashboard
app.get('/', checkLogin, async (req, res) => {
    try {
        const representative = await Representative.findOne({ 
            where: { className: req.session.user.username },
            include: [{ model: BankAccount, as: 'accounts' }]
        });
        const students = await Student.findAll({ 
            where: { registeredBy: req.session.user.username },
            order: [['createdAt', 'DESC']]
        });
        const foodItems = await FoodItem.findAll({ 
            where: { className: req.session.user.username },
            order: [['createdAt', 'DESC']]
        });
        
        res.render('dashboard', {
            title: 'Trang chủ - THPT Võ Văn Kiệt',
            representative,
            students,
            foodItems
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        req.session.error = 'Đã có lỗi xảy ra';
        res.redirect('/login');
    }
});

// Register Representative - GET
app.get('/register-rep', checkLogin, async (req, res) => {
    try {
        const representative = await Representative.findOne({ 
            where: { className: req.session.user.username },
            include: [{ model: BankAccount, as: 'accounts' }]
        });
        res.render('register-rep', {
            title: 'Đăng ký ngân hàng - VVK Spring Fair',
            representative
        });
    } catch (error) {
        console.error('Register rep GET error:', error);
        req.session.error = 'Đã có lỗi xảy ra';
        res.redirect('/');
    }
});

// Register Representative - POST
app.post('/register-rep', checkLogin, async (req, res) => {
    try {
        const { representativeName, bankNames, accountNumbers, accountHolders, isMainAccount } = req.body;

        if (!representativeName) {
            req.session.error = 'Vui lòng nhập tên đại diện';
            return res.redirect('/register-rep');
        }

        // Build accounts array
        const accountsData = [];
        const bankNamesArr = Array.isArray(bankNames) ? bankNames : [bankNames];
        const accountNumbersArr = Array.isArray(accountNumbers) ? accountNumbers : [accountNumbers];
        const accountHoldersArr = Array.isArray(accountHolders) ? accountHolders : [accountHolders];
        const mainIndex = parseInt(isMainAccount) || 0;

        for (let i = 0; i < bankNamesArr.length; i++) {
            if (bankNamesArr[i] && accountNumbersArr[i] && accountHoldersArr[i]) {
                accountsData.push({
                    bankName: bankNamesArr[i],
                    accountNumber: accountNumbersArr[i],
                    accountHolder: accountHoldersArr[i],
                    isMain: i === mainIndex
                });
            }
        }

        if (accountsData.length === 0) {
            req.session.error = 'Vui lòng nhập ít nhất một tài khoản ngân hàng';
            return res.redirect('/register-rep');
        }

        // Find or create representative
        let representative = await Representative.findOne({
            where: { className: req.session.user.username }
        });

        if (representative) {
            // Update existing
            await representative.update({ representativeName });
            // Delete old bank accounts
            await BankAccount.destroy({ where: { representativeId: representative.id } });
        } else {
            // Create new
            representative = await Representative.create({
                className: req.session.user.username,
                representativeName
            });
        }

        // Create bank accounts
        for (const acc of accountsData) {
            await BankAccount.create({
                ...acc,
                representativeId: representative.id
            });
        }

        req.session.success = 'Đăng ký thông tin ngân hàng thành công!';
        res.redirect('/');
    } catch (error) {
        console.error('Register rep POST error:', error);
        req.session.error = 'Đã có lỗi xảy ra, vui lòng thử lại';
        res.redirect('/register-rep');
    }
});

// Register Student - GET
app.get('/register-student', checkLogin, async (req, res) => {
    try {
        const students = await Student.findAll({ 
            where: { registeredBy: req.session.user.username },
            order: [['createdAt', 'DESC']]
        });
        res.render('register-student', {
            title: 'Đăng ký sinh viên - VVK Spring Fair',
            students
        });
    } catch (error) {
        console.error('Register student GET error:', error);
        req.session.error = 'Đã có lỗi xảy ra';
        res.redirect('/');
    }
});

// Register Student - POST (multiple images)
const studentUpload = upload.fields([
    { name: 'cccdFront', maxCount: 1 },
    { name: 'cccdBack', maxCount: 1 }
]);

app.post('/register-student', checkLogin, studentUpload, async (req, res) => {
    try {
        const { fullName, dob, cccdNumber, phoneNumber } = req.body;

        if (!fullName || !dob || !cccdNumber || !phoneNumber) {
            req.session.error = 'Vui lòng nhập đầy đủ thông tin';
            return res.redirect('/register-student');
        }

        // Images are optional
        const cccdFront = req.files && req.files.cccdFront ? '/uploads/' + req.files.cccdFront[0].filename : null;
        const cccdBack = req.files && req.files.cccdBack ? '/uploads/' + req.files.cccdBack[0].filename : null;

        await Student.create({
            fullName,
            className: req.session.user.username,
            dob: new Date(dob),
            cccdNumber,
            phoneNumber,
            cccdFront,
            cccdBack,
            registeredBy: req.session.user.username
        });

        req.session.success = 'Đăng ký học sinh thành công!';
        res.redirect('/register-student');
    } catch (error) {
        console.error('Register student POST error:', error);
        req.session.error = 'Đã có lỗi xảy ra, vui lòng thử lại';
        res.redirect('/register-student');
    }
});

// Delete Student
app.post('/delete-student/:id', checkLogin, async (req, res) => {
    try {
        const student = await Student.findOne({
            where: {
                id: req.params.id,
                registeredBy: req.session.user.username
            }
        });

        if (!student) {
            req.session.error = 'Không tìm thấy học sinh';
            return res.redirect('/register-student');
        }

        // Delete the image files
        if (student.cccdFront) {
            const frontPath = path.join(__dirname, 'public', student.cccdFront);
            if (fs.existsSync(frontPath)) {
                fs.unlinkSync(frontPath);
            }
        }
        if (student.cccdBack) {
            const backPath = path.join(__dirname, 'public', student.cccdBack);
            if (fs.existsSync(backPath)) {
                fs.unlinkSync(backPath);
            }
        }

        await student.destroy();
        req.session.success = 'Đã xóa học sinh thành công';
        res.redirect('/register-student');
    } catch (error) {
        console.error('Delete student error:', error);
        req.session.error = 'Đã có lỗi xảy ra';
        res.redirect('/register-student');
    }
});

// ===================== FOOD MENU ROUTES =====================

// Register Food Menu - GET
app.get('/register-food', checkLogin, async (req, res) => {
    try {
        const foodItems = await FoodItem.findAll({ 
            where: { className: req.session.user.username },
            order: [['createdAt', 'DESC']]
        });
        res.render('register-food', {
            title: 'Đăng ký món ăn - THPT Võ Văn Kiệt',
            foodItems
        });
    } catch (error) {
        console.error('Register food GET error:', error);
        req.session.error = 'Đã có lỗi xảy ra';
        res.redirect('/');
    }
});

// Register Food Menu - POST
app.post('/register-food', checkLogin, async (req, res) => {
    try {
        const { name, price, description } = req.body;

        if (!name || !price) {
            req.session.error = 'Vui lòng nhập tên món và giá bán';
            return res.redirect('/register-food');
        }

        const priceNum = parseInt(price.replace(/[,.\s]/g, ''));
        if (isNaN(priceNum) || priceNum < 0) {
            req.session.error = 'Giá bán không hợp lệ';
            return res.redirect('/register-food');
        }

        await FoodItem.create({
            name,
            price: priceNum,
            description: description || null,
            className: req.session.user.username
        });

        req.session.success = 'Đã thêm món ăn thành công!';
        res.redirect('/register-food');
    } catch (error) {
        console.error('Register food POST error:', error);
        req.session.error = 'Đã có lỗi xảy ra, vui lòng thử lại';
        res.redirect('/register-food');
    }
});

// Delete Food Item
app.post('/delete-food/:id', checkLogin, async (req, res) => {
    try {
        const foodItem = await FoodItem.findOne({
            where: {
                id: req.params.id,
                className: req.session.user.username
            }
        });

        if (!foodItem) {
            req.session.error = 'Không tìm thấy món ăn';
            return res.redirect('/register-food');
        }

        await foodItem.destroy();
        req.session.success = 'Đã xóa món ăn thành công';
        res.redirect('/register-food');
    } catch (error) {
        console.error('Delete food error:', error);
        req.session.error = 'Đã có lỗi xảy ra';
        res.redirect('/register-food');
    }
});

// ===================== ADMIN ROUTES =====================

// Admin Dashboard
app.get('/admin', checkAdmin, async (req, res) => {
    try {
        // Get all class accounts except admin
        const classes = await ClassAccount.findAll({ 
            where: { role: 'user' },
            order: [['username', 'ASC']]
        });
        
        // Get all representatives with bank accounts
        const representatives = await Representative.findAll({
            include: [{ model: BankAccount, as: 'accounts' }],
            order: [['className', 'ASC']]
        });
        
        // Get all students
        const students = await Student.findAll({
            order: [['className', 'ASC'], ['fullName', 'ASC']]
        });

        // Create a map for easy lookup
        const repMap = {};
        representatives.forEach(rep => {
            repMap[rep.className] = rep;
        });

        res.render('admin', {
            title: 'Admin Dashboard - VVK Spring Fair',
            classes,
            representatives,
            students,
            repMap
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        req.session.error = 'Đã có lỗi xảy ra';
        res.redirect('/');
    }
});

// Admin - Delete Representative (class financial info)
app.post('/admin/delete-rep/:className', checkAdmin, async (req, res) => {
    try {
        const { className } = req.params;
        
        const representative = await Representative.findOne({
            where: { className: className.toUpperCase() }
        });

        if (!representative) {
            req.session.error = `Không tìm thấy thông tin tài chính của lớp ${className}`;
            return res.redirect('/admin');
        }

        // Delete bank accounts first (cascade should handle this, but explicit is safer)
        await BankAccount.destroy({ where: { representativeId: representative.id } });
        
        // Delete representative
        await representative.destroy();
        
        req.session.success = `Đã xóa thông tin tài chính của lớp ${className}`;
        res.redirect('/admin');
    } catch (error) {
        console.error('Admin delete rep error:', error);
        req.session.error = 'Đã có lỗi xảy ra khi xóa thông tin';
        res.redirect('/admin');
    }
});

// Admin - Delete Student
app.post('/admin/delete-student/:id', checkAdmin, async (req, res) => {
    try {
        const student = await Student.findByPk(req.params.id);

        if (!student) {
            req.session.error = 'Không tìm thấy học sinh';
            return res.redirect('/admin');
        }

        // Delete the image files
        if (student.cccdFront) {
            const frontPath = path.join(__dirname, 'public', student.cccdFront);
            if (fs.existsSync(frontPath)) {
                fs.unlinkSync(frontPath);
            }
        }
        if (student.cccdBack) {
            const backPath = path.join(__dirname, 'public', student.cccdBack);
            if (fs.existsSync(backPath)) {
                fs.unlinkSync(backPath);
            }
        }

        const studentName = student.fullName;
        await student.destroy();
        
        req.session.success = `Đã xóa học sinh ${studentName}`;
        res.redirect('/admin');
    } catch (error) {
        console.error('Admin delete student error:', error);
        req.session.error = 'Đã có lỗi xảy ra khi xóa học sinh';
        res.redirect('/admin');
    }
});

// ===================== EXCEL EXPORT ROUTES =====================

// Export Representatives to Excel
app.get('/admin/export/representatives', checkAdmin, async (req, res) => {
    try {
        const classes = await ClassAccount.findAll({ 
            where: { role: 'user' },
            order: [['username', 'ASC']]
        });
        
        const representatives = await Representative.findAll({
            include: [{ model: BankAccount, as: 'accounts' }],
            order: [['className', 'ASC']]
        });

        const repMap = {};
        representatives.forEach(rep => {
            repMap[rep.className] = rep;
        });

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'THPT Võ Văn Kiệt';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Danh sách đại diện lớp');

        // Header styling
        worksheet.columns = [
            { header: 'STT', key: 'stt', width: 6 },
            { header: 'Lớp', key: 'class', width: 10 },
            { header: 'GVCN', key: 'teacher', width: 25 },
            { header: 'Tên đại diện', key: 'rep', width: 25 },
            { header: 'Ngân hàng', key: 'bank', width: 20 },
            { header: 'Số tài khoản', key: 'accountNum', width: 20 },
            { header: 'Chủ tài khoản', key: 'accountHolder', width: 25 },
            { header: 'Trạng thái', key: 'status', width: 15 }
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Add data
        let stt = 1;
        classes.forEach(cls => {
            const rep = repMap[cls.username];
            if (rep && rep.accounts && rep.accounts.length > 0) {
                const mainAcc = rep.accounts.find(a => a.isMain) || rep.accounts[0];
                worksheet.addRow({
                    stt: stt++,
                    class: cls.username,
                    teacher: cls.teacherName,
                    rep: rep.representativeName,
                    bank: mainAcc.bankName,
                    accountNum: mainAcc.accountNumber,
                    accountHolder: mainAcc.accountHolder,
                    status: 'Đã đăng ký'
                });
            } else {
                worksheet.addRow({
                    stt: stt++,
                    class: cls.username,
                    teacher: cls.teacherName,
                    rep: '-',
                    bank: '-',
                    accountNum: '-',
                    accountHolder: '-',
                    status: 'Chưa đăng ký'
                });
            }
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=DanhSachDaiDien_${new Date().toISOString().split('T')[0]}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export representatives error:', error);
        req.session.error = 'Đã có lỗi xảy ra khi xuất file Excel';
        res.redirect('/admin');
    }
});

// Export Students to Excel
app.get('/admin/export/students', checkAdmin, async (req, res) => {
    try {
        const students = await Student.findAll({
            order: [['className', 'ASC'], ['fullName', 'ASC']]
        });

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'THPT Võ Văn Kiệt';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Danh sách học sinh mở TK');

        // Header styling
        worksheet.columns = [
            { header: 'STT', key: 'stt', width: 6 },
            { header: 'Họ và tên', key: 'fullName', width: 30 },
            { header: 'Lớp', key: 'class', width: 10 },
            { header: 'Ngày sinh', key: 'dob', width: 15 },
            { header: 'Số CCCD', key: 'cccd', width: 18 },
            { header: 'Số điện thoại', key: 'phone', width: 15 },
            { header: 'Ngày đăng ký', key: 'createdAt', width: 15 }
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Add data
        students.forEach((student, index) => {
            worksheet.addRow({
                stt: index + 1,
                fullName: student.fullName,
                class: student.className,
                dob: new Date(student.dob).toLocaleDateString('vi-VN'),
                cccd: student.cccdNumber,
                phone: student.phoneNumber,
                createdAt: new Date(student.createdAt).toLocaleDateString('vi-VN')
            });
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=DanhSachHocSinhMoTK_${new Date().toISOString().split('T')[0]}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export students error:', error);
        req.session.error = 'Đã có lỗi xảy ra khi xuất file Excel';
        res.redirect('/admin');
    }
});

// Admin - Class Detail View
app.get('/admin/class/:className', checkAdmin, async (req, res) => {
    try {
        const { className } = req.params;
        const upperClassName = className.toUpperCase();

        const classAccount = await ClassAccount.findOne({
            where: { username: upperClassName }
        });

        if (!classAccount) {
            req.session.error = 'Không tìm thấy lớp học';
            return res.redirect('/admin');
        }

        const representative = await Representative.findOne({
            where: { className: upperClassName },
            include: [{ model: BankAccount, as: 'accounts' }]
        });

        const students = await Student.findAll({
            where: { className: upperClassName },
            order: [['fullName', 'ASC']]
        });

        const foodItems = await FoodItem.findAll({
            where: { className: upperClassName },
            order: [['createdAt', 'DESC']]
        });

        res.render('admin-class-detail', {
            title: `Chi tiết lớp ${upperClassName} - THPT Võ Văn Kiệt`,
            classAccount,
            representative,
            students,
            foodItems
        });
    } catch (error) {
        console.error('Admin class detail error:', error);
        req.session.error = 'Đã có lỗi xảy ra';
        res.redirect('/admin');
    }
});

// Admin - Delete Food Item
app.post('/admin/delete-food/:id', checkAdmin, async (req, res) => {
    try {
        const foodItem = await FoodItem.findByPk(req.params.id);

        if (!foodItem) {
            req.session.error = 'Không tìm thấy món ăn';
            return res.redirect('/admin');
        }

        const className = foodItem.className;
        await foodItem.destroy();
        
        req.session.success = 'Đã xóa món ăn thành công';
        // Check referer to decide where to redirect
        const referer = req.get('Referer');
        if (referer && referer.includes('/admin/class/')) {
            res.redirect(`/admin/class/${className}`);
        } else {
            res.redirect('/admin');
        }
    } catch (error) {
        console.error('Admin delete food error:', error);
        req.session.error = 'Đã có lỗi xảy ra';
        res.redirect('/admin');
    }
});

// Admin - Export Class Data (Generic)
app.get('/admin/export/class/:className/:type', checkAdmin, async (req, res) => {
    try {
        const { className, type } = req.params;
        const upperClassName = className.toUpperCase();
        
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'THPT Võ Văn Kiệt';
        workbook.created = new Date();
        
        if (type === 'students') {
            const students = await Student.findAll({
                where: { className: upperClassName },
                order: [['fullName', 'ASC']]
            });
            
            const worksheet = workbook.addWorksheet(`Học sinh lớp ${upperClassName}`);
            worksheet.columns = [
                { header: 'STT', key: 'stt', width: 6 },
                { header: 'Họ và tên', key: 'fullName', width: 25 },
                { header: 'Ngày sinh', key: 'dob', width: 15 },
                { header: 'Số CCCD', key: 'cccdNumber', width: 20 },
                { header: 'Số điện thoại', key: 'phoneNumber', width: 15 },
                { header: 'Trạng thái ảnh', key: 'images', width: 20 }
            ];
            
            worksheet.getRow(1).font = { bold: true };
            
            students.forEach((student, index) => {
                worksheet.addRow({
                    stt: index + 1,
                    fullName: student.fullName,
                    dob: new Date(student.dob).toLocaleDateString('vi-VN'),
                    cccdNumber: student.cccdNumber,
                    phoneNumber: student.phoneNumber,
                    images: (student.cccdFront || student.cccdBack) ? 
                           `${(student.cccdFront ? 1 : 0) + (student.cccdBack ? 1 : 0)} ảnh` : 'Chưa có'
                });
            });
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=DS_HocSinh_${upperClassName}.xlsx`);
            
        } else if (type === 'food') {
            const foodItems = await FoodItem.findAll({
                where: { className: upperClassName },
                order: [['createdAt', 'DESC']]
            });
            
            const worksheet = workbook.addWorksheet(`Menu lớp ${upperClassName}`);
            worksheet.columns = [
                { header: 'STT', key: 'stt', width: 6 },
                { header: 'Tên món ăn', key: 'name', width: 25 },
                { header: 'Giá bán', key: 'price', width: 15 },
                { header: 'Mô tả', key: 'description', width: 35 }
            ];
            
            worksheet.getRow(1).font = { bold: true };
            
            foodItems.forEach((item, index) => {
                worksheet.addRow({
                    stt: index + 1,
                    name: item.name,
                    price: item.price,
                    description: item.description || ''
                });
            });
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=Menu_${upperClassName}.xlsx`);

        } else if (type === 'finance') {
             // Re-using logic or simplifying for single class finance (usually just one rep but good to contain)
            const representative = await Representative.findOne({
                where: { className: upperClassName },
                include: [{ model: BankAccount, as: 'accounts' }]
            });
            
            const worksheet = workbook.addWorksheet(`Tài chính lớp ${upperClassName}`);
             worksheet.columns = [
                { header: 'Thông tin', key: 'label', width: 20 },
                { header: 'Giá trị', key: 'value', width: 30 },
                { header: 'Chi tiết', key: 'detail', width: 30 }
            ];
            
            worksheet.getRow(1).font = { bold: true };
            
            if (representative) {
                worksheet.addRow({ label: 'Đại diện', value: representative.representativeName });
                if (representative.accounts) {
                    representative.accounts.forEach((acc, idx) => {
                         worksheet.addRow({ 
                            label: `Tài khoản ${idx + 1} (${acc.isMain ? 'Chính' : 'Phụ'})`, 
                            value: `${acc.bankName} - ${acc.accountNumber}`,
                            detail: `CTK: ${acc.accountHolder}`
                         });
                    });
                }
            } else {
                 worksheet.addRow({ label: 'Trạng thái', value: 'Chưa đăng ký' });
            }
             res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=TaiChinh_${upperClassName}.xlsx`);
        } else {
             req.session.error = 'Loại dữ liệu không hợp lệ';
            return res.redirect(`/admin/class/${upperClassName}`);
        }

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Export class data error:', error);
        req.session.error = 'Đã có lỗi xảy ra khi xuất dữ liệu';
        res.redirect('/admin');
    }
});

// ===================== ERROR HANDLING =====================

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Không tìm thấy trang',
        message: 'Trang bạn tìm kiếm không tồn tại'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).render('error', {
        title: 'Lỗi máy chủ',
        message: 'Đã có lỗi xảy ra, vui lòng thử lại sau'
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
