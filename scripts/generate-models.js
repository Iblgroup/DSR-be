import SequelizeAuto from 'sequelize-auto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const auto = new SequelizeAuto(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    directory: path.join(__dirname, '../models'),
    caseModel: 'p', // PascalCase for model names
    caseFile: 'c', // camelCase for file names
    caseProp: 'c', // camelCase for properties
    singularize: true,
    lang: 'esm', // Use ESM instead of es6 for proper ES6 module format
    useDefine: false,
    spaces: true,
    indentation: 2,
    additional: {
      timestamps: false
    }
  }
);

console.log('🔄 Starting model generation from database schema...');
console.log(`📦 Database: ${process.env.DB_NAME}`);
console.log(`📁 Output: ${path.join(__dirname, '../models')}\n`);

auto.run()
  .then(data => {
    console.log('✓ Models generated successfully!');
    console.log(`\n📊 Generated ${Object.keys(data.tables).length} models:`);
    Object.keys(data.tables).forEach(table => {
      console.log(`  - ${table}`);
    });
  })
  .catch(err => {
    console.error('✗ Error generating models:', err);
    process.exit(1);
  });
