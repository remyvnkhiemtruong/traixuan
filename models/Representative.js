const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Representative = sequelize.define('Representative', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    className: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'class_name',
        set(value) {
            this.setDataValue('className', value.toUpperCase());
        }
    },
    representativeName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'representative_name'
    }
}, {
    tableName: 'representatives',
    timestamps: true,
    underscored: true
});

// Bank Account model (one-to-many relationship)
const BankAccount = sequelize.define('BankAccount', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    representativeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'representative_id',
        references: {
            model: 'representatives',
            key: 'id'
        }
    },
    bankName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'bank_name'
    },
    accountNumber: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'account_number'
    },
    accountHolder: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'account_holder'
    },
    isMain: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_main'
    }
}, {
    tableName: 'bank_accounts',
    timestamps: true,
    underscored: true
});

// Define relationships
Representative.hasMany(BankAccount, { 
    foreignKey: 'representativeId', 
    as: 'accounts',
    onDelete: 'CASCADE'
});
BankAccount.belongsTo(Representative, { 
    foreignKey: 'representativeId' 
});

module.exports = { Representative, BankAccount };
