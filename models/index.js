import { Sequelize } from 'sequelize';
import sequelize from '../config/database.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = {};

// Function to dynamically load all model files
const loadModels = async () => {
  const modelsPath = __dirname;
  const modelFiles = fs.readdirSync(modelsPath)
    .filter(file => 
      file !== 'index.js' && 
      file !== 'init-models.js' &&
      file.endsWith('.js')
    );

  for (const file of modelFiles) {
    try {
      const filePath = path.join(modelsPath, file);
      const module = await import(`file://${filePath}`);
      const ModelClass = module.default;
      const model = ModelClass.init(sequelize, Sequelize.DataTypes);
      db[model.name] = model;
      console.log(`✓ Loaded model: ${model.name}`);
    } catch (err) {
      console.error(`✗ Error loading model ${file}:`, err.message);
    }
  }

  // Setup associations if they exist
  Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
      db[modelName].associate(db);
    }
  });
};

// Load all models
await loadModels();

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;
