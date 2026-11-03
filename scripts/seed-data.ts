// Real UK EANs, each checked against Open Food Facts v3 before the build.
// Names/brands are hardcoded: the seed never calls OFF (rate limit).
// Held back from the seed for the live prefill demo:
//   5449000131805 Coca-Cola Zero Sugar, 5449000014535 Sprite, 7622300743536 Cadbury Dairy Milk.
// `expires` is days from London today; null = no date (qty 0 stores null).

export type SeedProduct = {
  barcode: string;
  name: string;
  brand: string | null;
  quantity: number;
  min: number;
  expires: number | null;
};

export const DEMO_PRODUCTS: SeedProduct[] = [
  // Expired
  { barcode: "5000181024043", name: "Cravendale Semi-Skimmed Milk 2L", brand: "Cravendale", quantity: 3, min: 4, expires: -2 },
  { barcode: "5000436589457", name: "Semi-Skimmed Milk 4 Pints", brand: "Tesco", quantity: 2, min: 0, expires: -1 },
  { barcode: "5000295144088", name: "Frijj Fudge Brownie Milkshake 471ml", brand: "Frijj", quantity: 4, min: 0, expires: -4 },
  { barcode: "5017764128128", name: "Kettle Sea Salt & Balsamic Vinegar 130g", brand: "Kettle", quantity: 5, min: 0, expires: -6 },
  // Expiring within 7 days
  { barcode: "5060042641406", name: "Tyrrells Sea Salt & Cider Vinegar 150g", brand: "Tyrrells", quantity: 6, min: 0, expires: 1 },
  { barcode: "7393714515506", name: "Kopparberg Strawberry & Lime 500ml", brand: "Kopparberg", quantity: 9, min: 6, expires: 2 },
  { barcode: "5000328376677", name: "Walkers Ready Salted 6 x 25g", brand: "Walkers", quantity: 8, min: 4, expires: 3 },
  { barcode: "5000328029146", name: "Doritos Chilli Heatwave 180g", brand: "Doritos", quantity: 7, min: 0, expires: 5 },
  { barcode: "5000159461122", name: "Snickers 50g", brand: "Snickers", quantity: 24, min: 12, expires: 7 },
  // Low stock (qty <= min)
  { barcode: "75041670", name: "Corona Extra 330ml", brand: "Corona", quantity: 2, min: 6, expires: 120 },
  { barcode: "9002490100070", name: "Red Bull Energy Drink 250ml", brand: "Red Bull", quantity: 3, min: 12, expires: 200 },
  { barcode: "5060337500401", name: "Monster Energy Ultra 500ml", brand: "Monster", quantity: 0, min: 6, expires: null },
  { barcode: "5014379012873", name: "Stella Artois 440ml", brand: "Stella Artois", quantity: 4, min: 8, expires: 150 },
  // Healthy
  { barcode: "8008440246004", name: "Asahi Super Dry 330ml", brand: "Asahi", quantity: 24, min: 6, expires: 180 },
  { barcode: "5056025440432", name: "BrewDog Punk IPA 330ml", brand: "BrewDog", quantity: 18, min: 6, expires: 95 },
  { barcode: "5010038485880", name: "Carling Original Lager 440ml", brand: "Carling", quantity: 32, min: 8, expires: 160 },
  { barcode: "5016878012156", name: "Adnams Ghost Ship 500ml", brand: "Adnams", quantity: 12, min: 4, expires: 140 },
  { barcode: "8008440210456", name: "Peroni Nastro Azzurro 330ml", brand: "Peroni", quantity: 20, min: 6, expires: 210 },
  { barcode: "5035766048411", name: "Strongbow Dark Fruit 440ml", brand: "Strongbow", quantity: 16, min: 6, expires: 175 },
  { barcode: "5020628001178", name: "Thatchers Gold 500ml", brand: "Thatchers", quantity: 10, min: 4, expires: 190 },
  { barcode: "5060108450324", name: "Fever-Tree Indian Tonic Water 500ml", brand: "Fever-Tree", quantity: 8, min: 3, expires: 300 },
  { barcode: "5449000133373", name: "Schweppes Indian Tonic Water 1L", brand: "Schweppes", quantity: 6, min: 2, expires: 240 },
  { barcode: "5449000054227", name: "Coca-Cola Original Taste 1.75L", brand: "Coca-Cola", quantity: 10, min: 4, expires: 150 },
  { barcode: "5053990127726", name: "Pringles Original 165g", brand: "Pringles", quantity: 9, min: 3, expires: 110 },
  { barcode: "5000159407236", name: "Mars Bar 51g", brand: "Mars", quantity: 30, min: 12, expires: 90 },
];

// Corner Cellar: only exists for the isolation tests.
export const CELLAR_PRODUCTS: SeedProduct[] = [
  { barcode: "75041670", name: "Corona Extra 330ml", brand: "Corona", quantity: 12, min: 6, expires: 100 },
  { barcode: "5449000011527", name: "Fanta Orange 330ml", brand: "Fanta", quantity: 6, min: 0, expires: 60 },
  { barcode: "5010038492017", name: "Staropramen 330ml", brand: "Staropramen", quantity: 1, min: 4, expires: -3 },
];
