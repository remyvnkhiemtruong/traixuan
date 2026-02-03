const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const ClassAccount = sequelize.define('ClassAccount', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        set(value) {
            this.setDataValue('username', value.toUpperCase());
        }
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    teacherName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'teacher_name'
    },
    role: {
        type: DataTypes.ENUM('user', 'admin'),
        defaultValue: 'user'
    }
}, {
    tableName: 'class_accounts',
    timestamps: true,
    underscored: true,
    hooks: {
        beforeCreate: async (account) => {
            if (account.password) {
                const salt = await bcrypt.genSalt(10);
                account.password = await bcrypt.hash(account.password, salt);
            }
        },
        beforeUpdate: async (account) => {
            if (account.changed('password')) {
                const salt = await bcrypt.genSalt(10);
                account.password = await bcrypt.hash(account.password, salt);
            }
        }
    }
});

// Instance method to compare password
ClassAccount.prototype.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = ClassAccount;
