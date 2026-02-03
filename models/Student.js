const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Student = sequelize.define('Student', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    fullName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'full_name'
    },
    className: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'class_name',
        set(value) {
            this.setDataValue('className', value.toUpperCase());
        }
    },
    dob: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    cccdNumber: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'cccd_number'
    },
    phoneNumber: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'phone_number'
    },
    cccdFront: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'cccd_front'
    },
    cccdBack: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'cccd_back'
    },
    registeredBy: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'registered_by',
        set(value) {
            this.setDataValue('registeredBy', value.toUpperCase());
        }
    }
}, {
    tableName: 'students',
    timestamps: true,
    underscored: true
});

module.exports = Student;
