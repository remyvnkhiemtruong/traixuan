const { Sequelize } = require('sequelize');

// PostgreSQL connection
const sequelize = new Sequelize(
    process.env.DB_NAME || 'vvk_spring_fair',
    process.env.DB_USER || 'vvk',
    process.env.DB_PASSWORD || 'vvk2026',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

module.exports = sequelize;
