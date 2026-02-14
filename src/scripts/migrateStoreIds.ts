import mongoose from 'mongoose';
import Store from '../modules/store/store.model';

const generateStoreId = (city: string, district: string, dealerCode: string): string => {
  const cityPrefix = (city || '').trim().substring(0, 3).toUpperCase();
  const districtPrefix = (district || '').trim().substring(0, 3).toUpperCase();
  const cleanDealerCode = (dealerCode || '').trim().toUpperCase();
  return `${cityPrefix}${districtPrefix}${cleanDealerCode}`;
};

async function migrateStoreIds() {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/elora';
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const stores = await Store.find({ storeId: { $exists: false } });
    console.log(`Found ${stores.length} stores without storeId`);

    let updated = 0;
    for (const store of stores) {
      if (store.location?.city && store.location?.district && store.dealerCode) {
        store.storeId = generateStoreId(store.location.city, store.location.district, store.dealerCode);
        await store.save();
        updated++;
        console.log(`Updated ${store.dealerCode} -> ${store.storeId}`);
      } else {
        console.log(`Skipped ${store.dealerCode} - missing city/district`);
      }
    }

    console.log(`\nMigration complete! Updated ${updated} stores.`);
    await mongoose.disconnect();
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateStoreIds();
