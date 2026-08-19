// Creates the admin account, default settings and a starter set of demo deals.
// Run with:  npm run seed     (keeps existing deals)
//            npm run reset    (wipes deals and re-adds the demo set)
require('dotenv').config();
const { initSchema, get, run, transaction } = require('../src/config/db');
const { slugify } = require('../src/utils/slug');
const { ensureAdmin, ensureDefaultSettings } = require('../src/utils/bootstrap');

const RESET = process.argv.includes('--reset');

// Demo rows so the site is not empty on first run. Replace them with your own links —
// the images are free placeholders, so paste the real product image URL when you add a
// deal in the admin panel.
const DEMO_DEALS = [
  {
    title: 'boAt Airdopes 141 Wireless Earbuds',
    description:
      '42H playtime, ENx noise cancellation, Beast Mode for gaming. A perennial best-seller under 1500.',
    store: 'amazon',
    affiliate_url: 'https://www.amazon.in/dp/B09N3ZNHTY',
    category: 'Audio',
    brand: 'boAt',
    price: 1099,
    mrp: 2990,
    rating: 4.1,
    is_featured: 1,
  },
  {
    title: 'Redmi 13C 5G (6GB / 128GB)',
    description:
      '5G phone with a 50MP camera and 90Hz display — the usual entry point for budget 5G buyers.',
    store: 'flipkart',
    affiliate_url: 'https://www.flipkart.com/redmi-13c-5g-startrail-black-128-gb/p/itm123456789',
    category: 'Mobiles',
    brand: 'Redmi',
    price: 10499,
    mrp: 15999,
    rating: 4.3,
    is_featured: 1,
  },
  {
    title: 'Cotton Anarkali Kurta Set',
    description:
      'Printed cotton kurta with palazzo and dupatta. Meesho pricing on ethnic wear is hard to beat.',
    store: 'meesho',
    affiliate_url: 'https://www.meesho.com/cotton-anarkali-kurta-set/p/abc123',
    category: 'Fashion',
    brand: 'Anouk',
    price: 549,
    mrp: 1499,
    rating: 3.9,
    is_featured: 1,
  },
  {
    title: 'Noise ColorFit Pro 5 Smartwatch',
    description: '1.85 inch AMOLED, Bluetooth calling, 7-day battery. Good gifting price point.',
    store: 'amazon',
    affiliate_url: 'https://www.amazon.in/dp/B0CHX2F5QT',
    category: 'Wearables',
    brand: 'Noise',
    price: 3499,
    mrp: 6999,
    rating: 4.0,
  },
  {
    title: 'Prestige Iris 750W Mixer Grinder',
    description:
      '750W motor, 3 stainless steel jars, 2-year warranty. Steady seller during sale events.',
    store: 'flipkart',
    affiliate_url: 'https://www.flipkart.com/prestige-iris-750-w-mixer-grinder/p/itm987654321',
    category: 'Home & Kitchen',
    brand: 'Prestige',
    price: 2799,
    mrp: 4295,
    rating: 4.2,
  },
  {
    title: 'Men Regular Fit Cotton Casual Shirt (Pack of 2)',
    description:
      'Cotton shirts in a two-pack. Fast-moving Meesho fashion listing with strong reorder rates.',
    store: 'meesho',
    affiliate_url: 'https://www.meesho.com/men-cotton-casual-shirt/p/def456',
    category: 'Fashion',
    brand: 'Generic',
    price: 699,
    mrp: 1999,
    rating: 3.8,
  },
  {
    title: 'HP 15s Ryzen 5 Laptop (16GB / 512GB SSD)',
    description:
      'Ryzen 5 7520U, 16GB RAM, 512GB SSD, Windows 11 — a solid student / work-from-home pick.',
    store: 'amazon',
    affiliate_url: 'https://www.amazon.in/dp/B0C9GYNJK1',
    category: 'Laptops',
    brand: 'HP',
    price: 42990,
    mrp: 58999,
    rating: 4.2,
  },
  {
    title: 'Mi 108cm (43 inch) Full HD Smart LED TV',
    description:
      'Android TV, Dolby Audio, 3 HDMI ports. Price drops sharply during Big Billion Days.',
    store: 'flipkart',
    affiliate_url:
      'https://www.flipkart.com/mi-108-cm-43-inch-full-hd-led-smart-android-tv/p/itm555555555',
    category: 'Televisions',
    brand: 'Mi',
    price: 22999,
    mrp: 39999,
    rating: 4.4,
  },
  {
    title: 'Stainless Steel Insulated Water Bottle 1L',
    description:
      'Keeps water hot or cold for 24 hours. Cheap repeat-purchase item, great for click volume.',
    store: 'meesho',
    affiliate_url: 'https://www.meesho.com/steel-insulated-water-bottle/p/ghi789',
    category: 'Home & Kitchen',
    brand: 'Milton',
    price: 449,
    mrp: 999,
    rating: 4.0,
  },
  {
    title: 'Samsung 8kg Fully Automatic Front Load Washing Machine',
    description:
      'Eco Bubble tech, hygiene steam, 5-star rating. Big-ticket item — highest commission per sale.',
    store: 'amazon',
    affiliate_url: 'https://www.amazon.in/dp/B0BQZ5N6JN',
    category: 'Appliances',
    brand: 'Samsung',
    price: 31490,
    mrp: 43900,
    rating: 4.3,
  },
  {
    title: 'Puma Unisex Running Shoes',
    description:
      'Mesh upper, SoftFoam+ insole. Footwear converts well once the discount crosses 50%.',
    store: 'flipkart',
    affiliate_url: 'https://www.flipkart.com/puma-unisex-running-shoes/p/itm777777777',
    category: 'Footwear',
    brand: 'Puma',
    price: 1799,
    mrp: 3999,
    rating: 4.1,
    coupon_code: 'SPORT200',
  },
  {
    title: 'Wooden Wall Shelf Set of 3',
    description: 'Floating shelves for living room decor — a strong repeat category on Meesho.',
    store: 'meesho',
    affiliate_url: 'https://www.meesho.com/wooden-wall-shelf-set-of-3/p/jkl012',
    category: 'Home Decor',
    brand: 'Generic',
    price: 399,
    mrp: 1299,
    rating: 3.7,
  },
];

function seedDeals() {
  if (RESET) {
    run('DELETE FROM clicks');
    run('DELETE FROM deals');
    console.log('Existing deals cleared (--reset)');
  }

  const { n } = get('SELECT COUNT(*) AS n FROM deals');
  if (n > 0) {
    console.log(`${n} deals already present — skipping demo deals`);
    return;
  }

  transaction(() => {
    DEMO_DEALS.forEach((d) => {
      const slug = slugify(d.title);
      run(
        `INSERT INTO deals
           (title, slug, description, store, affiliate_url, image_url, category, brand,
            price, mrp, rating, coupon_code, is_featured, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        d.title,
        slug,
        d.description,
        d.store,
        d.affiliate_url,
        `https://picsum.photos/seed/${slug}/600/600`,
        d.category,
        d.brand,
        d.price,
        d.mrp ?? null,
        d.rating ?? null,
        d.coupon_code ?? null,
        d.is_featured ?? 0
      );
    });
  });

  console.log(`${DEMO_DEALS.length} demo deals added`);
}

try {
  initSchema();
  ensureAdmin();
  ensureDefaultSettings();
  seedDeals();
  console.log('\nSeed complete. Start the API with: npm run dev');
} catch (err) {
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
}
