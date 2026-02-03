require('dotenv').config();
const sequelize = require('./config/database');
const ClassAccount = require('./models/ClassAccount');
const bcrypt = require('bcryptjs');

// Class data
const classData = [
    { username: '10A1', teacherName: 'Mạc Kim Khai' },
    { username: '10A2', teacherName: 'Lê Nguyễn Thế Bảo' },
    { username: '10A3', teacherName: 'Nguyễn Ngọc Diệp' },
    { username: '10A4', teacherName: 'Lê Hoàng Đương' },
    { username: '10A5', teacherName: 'Trần Thị Thảo Trình' },
    { username: '10A6', teacherName: 'Lê Thị Ngọc Trân' },
    { username: '10A7', teacherName: 'Trương Việt Triệu' },
    { username: '10C1', teacherName: 'Nguyễn Thị Tuyết Băng' },
    { username: '10C2', teacherName: 'Nguyễn Thị Thanh Vân' },
    { username: '10C3', teacherName: 'Nguyễn Thị Yến' },
    { username: '10C4', teacherName: 'Nguyễn Nhựt Anh' },
    { username: '10C5', teacherName: 'Trần Hồng Cẩm' },
    { username: '10C6', teacherName: 'Thạch Trinh' },
    { username: '10C7', teacherName: 'Trương Vũ Khang' },
    { username: '11A1', teacherName: 'Nguyễn Văn Dược' },
    { username: '11A2', teacherName: 'Trần Thị Thanh Thuý' },
    { username: '11A3', teacherName: 'Bùi Thị Hồng Gấm' },
    { username: '11A4', teacherName: 'Nguyễn Hoàng Oanh' },
    { username: '11A5', teacherName: 'Huỳnh Thị Cẩm Tiên' },
    { username: '11A6', teacherName: 'Danh Thị Ướng' },
    { username: '11A7', teacherName: 'Lương Thị Thuý Huỳnh' },
    { username: '11A8', teacherName: 'Lý Khánh Vinh' },
    { username: '11C1', teacherName: 'Phạm Thu Hiền' },
    { username: '11C2', teacherName: 'Nguyễn Công Du' },
    { username: '11C3', teacherName: 'Trần Sâm' },
    { username: '11C4', teacherName: 'Đặng Văn Vũ' },
    { username: '11C5', teacherName: 'Nguyễn Đồng Hết' },
    { username: '11C6', teacherName: 'Dương Diễm Phương' },
    { username: '11C7', teacherName: 'Trần Văn Vui' },
    { username: '11C8', teacherName: 'Lê Tấn Tài' },
    { username: '11C9', teacherName: 'Tô Hùng Hoài' },
    { username: '12A1', teacherName: 'Trần Lập Quốc' },
    { username: '12A2', teacherName: 'Quách Quang Trung' },
    { username: '12A3', teacherName: 'Ngô Văn Nghị' },
    { username: '12A4', teacherName: 'Huỳnh Thanh Tuấn' },
    { username: '12A5', teacherName: 'Lê Thị Tuyết Nhân' },
    { username: '12A6', teacherName: 'Huỳnh Nhất Thống' },
    { username: '12A7', teacherName: 'Lê Minh Huy' },
    { username: '12A8', teacherName: 'Võ Thị Cẩm Hường' },
    { username: '12C1', teacherName: 'Huỳnh Công Đại' },
    { username: '12C2', teacherName: 'Phan Thanh Thuỷ' },
    { username: '12C3', teacherName: 'Danh Nhựt Linh' },
    { username: '12C4', teacherName: 'Nguyễn Thị Thảo Trang' },
    { username: '12C5', teacherName: 'Ngô Thị Thanh Bích' },
    { username: '12C6', teacherName: 'Võ Thị Kim Loán' },
    { username: '12C7', teacherName: 'Lưu Quang Lam' },
    { username: '12C8', teacherName: 'Nguyễn Thị Kim Hằng' }
];

async function seedDatabase() {
    try {
        console.log('🔌 Connecting to PostgreSQL...');
        await sequelize.authenticate();
        console.log('✅ Connected to PostgreSQL');

        // Sync database (create tables)
        console.log('📦 Creating tables...');
        await sequelize.sync({ force: true }); // This will drop and recreate tables
        console.log('✅ Tables created');

        // Hash passwords
        const classPasswordHash = await bcrypt.hash('vvk2026', 10);
        const adminPasswordHash = await bcrypt.hash('admin_vvk_secret', 10);

        // Create admin account (bypass hook by using raw password hash)
        console.log('👤 Creating admin account...');
        await sequelize.query(`
            INSERT INTO class_accounts (username, password, teacher_name, role, created_at, updated_at)
            VALUES ('ADMIN', '${adminPasswordHash}', 'Administrator', 'admin', NOW(), NOW())
        `);
        console.log('   ✅ Admin account created: ADMIN / admin_vvk_secret');

        // Create class accounts
        console.log('📚 Creating class accounts...');
        for (const classInfo of classData) {
            await sequelize.query(`
                INSERT INTO class_accounts (username, password, teacher_name, role, created_at, updated_at)
                VALUES ('${classInfo.username}', '${classPasswordHash}', '${classInfo.teacherName}', 'user', NOW(), NOW())
            `);
            console.log(`   ✅ Created: ${classInfo.username} - ${classInfo.teacherName}`);
        }

        console.log('\n🎉 Database seeding completed successfully!');
        console.log(`   Total accounts created: ${classData.length + 1}`);
        console.log('\n📋 Login credentials:');
        console.log('   Admin: ADMIN / admin_vvk_secret');
        console.log('   Classes: [CLASS_NAME] / vvk2026 (e.g., 12A1 / vvk2026)');

    } catch (error) {
        console.error('❌ Seeding error:', error);
    } finally {
        await sequelize.close();
        console.log('\n🔌 PostgreSQL connection closed');
        process.exit(0);
    }
}

seedDatabase();
