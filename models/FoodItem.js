const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FoodItem = sequelize.define('FoodItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    price: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 0
        }
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    className: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'class_name',
        set(value) {
            this.setDataValue('className', value.toUpperCase());
        }
    }
}, {
    tableName: 'food_items',
    timestamps: true,
    underscored: true
});

module.exports = FoodItem;
