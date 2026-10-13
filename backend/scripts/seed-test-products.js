require('dotenv').config();

const mongoose = require('mongoose');
const Product = require('../src/models/Product');
const User = require('../src/models/User');

const testProducts = [
  {
    sku: 'TEST-FLOWER-001',
    name: 'Petal Symphony',
    description: 'A bright mixed bouquet arranged for celebrations and thoughtful gifts.',
    price: 1890,
    image: '/images/Petal Symphony.png',
    category: 'Signature Blooms',
    type: 'Roses',
    stock: 12,
  },
  {
    sku: 'TEST-FLOWER-002',
    name: 'Joya de Dia',
    description: 'A cheerful bouquet of warm seasonal flowers with a soft, colorful finish.',
    price: 1590,
    image: '/images/Joya de Día.png',
    category: 'Birthday Blooms',
    type: 'Tulips',
    stock: 8,
  },
  {
    sku: 'TEST-FLOWER-003',
    name: 'Blissful Radiance',
    description: 'A radiant hand-tied bouquet designed to make an everyday moment special.',
    price: 2190,
    image: '/images/Blissful Radiance.png',
    category: 'Valentine',
    type: 'Roses',
    stock: 6,
  },
  {
    sku: 'TEST-FLOWER-004',
    name: 'Aurora Bouquet',
    description: 'An elegant floral arrangement with a fresh, graceful palette.',
    price: 2490,
    image: '/images/Aurora Boquet.png',
    category: 'Wedding',
    type: 'Carnations',
    stock: 5,
  },
];

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/coffeeshop');
  const owner = await User.findOne().select('_id');

  if (!owner) {
    throw new Error('Create an account before seeding products so records have a valid createdBy owner.');
  }

  for (const product of testProducts) {
    await Product.findOneAndUpdate(
      { sku: product.sku },
      { $set: { ...product, isAddon: false, createdBy: owner._id, updatedBy: owner._id } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`Seeded ${testProducts.length} test products (TEST-FLOWER-*).`);
};

seed()
  .catch((error) => {
    console.error(`Unable to seed products: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });