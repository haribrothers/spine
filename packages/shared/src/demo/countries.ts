import type { CountryPack, Place } from "./scenario.ts";
import type { DemoCountry } from "./types.ts";

/**
 * US-ONB-18, US-ONB-19, US-ONB-21 (D-192) — who a demo business deals with
 * in each country, what things cost there and which tax applies. Every
 * business and person is made up; phone numbers use the ranges set aside
 * for fiction where a country has them, and the UPI ID's handle belongs to
 * no bank, so its QR code pays no one.
 */

const place = (line1: string, city: string, state: string, postalCode: string, country: string, stateCode?: string): Place => ({ line1, city, state, postalCode, country, ...(stateCode ? { stateCode } : {}) });

const US: CountryPack = {
  country: "US",
  taxCountry: "other",
  currency: { code: "USD", locale: "en-US" },
  financialYearStart: { month: 1, day: 1 },
  scale: 1,
  business: { place: place("1200 Congress Ave, Suite 300", "Austin", "TX", "78701", "US"), phone: "+1-555-0100" },
  customers: {
    anchor: { name: "Lakeshore Properties Inc.", isCompany: true, person: { name: "Rachel Moore", title: "Facilities Director" }, place: place("400 Lavaca St", "Austin", "TX", "78701", "US"), phone: "+1-555-0121" },
    regional: { name: "Pinecrest Retail Group", isCompany: true, person: { name: "Kevin Walsh", title: "Store Development Manager" }, place: place("1600 Glenarm Pl", "Denver", "CO", "80202", "US"), phone: "+1-555-0122" },
    consumer: { name: "Emily Carter", isCompany: false, person: { name: "Emily Carter", title: "Homeowner" }, place: place("2107 Bluebonnet Ln", "Austin", "TX", "78704", "US"), phone: "+1-555-0123" },
    consumer_far: { name: "Daniel Brooks", isCompany: false, person: { name: "Daniel Brooks", title: "Homeowner" }, place: place("4410 E Camelback Rd", "Phoenix", "AZ", "85018", "US"), phone: "+1-555-0124" },
    institution: { name: "St. Anne's Medical Center", isCompany: true, person: { name: "Dr. Laura Chen", title: "Operations Manager" }, place: place("900 E 30th St", "Austin", "TX", "78705", "US"), phone: "+1-555-0125" },
    sez: { name: "Harbor Logistics LLC", isCompany: true, person: { name: "Marco Diaz", title: "Site Manager" }, place: place("7700 Navigation Blvd", "Houston", "TX", "77011", "US"), phone: "+1-555-0126" },
    overseas: { name: "Maple Leaf Hospitality Ltd.", isCompany: true, person: { name: "Sophie Tremblay", title: "Projects Lead" }, place: place("200 Bay St", "Toronto", "ON", "M5J 2J2", "CA"), phone: "+1-555-0127" },
  },
  vendors: {
    supplier: { person: "Greg Foster", place: place("6100 Airport Blvd", "Austin", "TX", "78752", "US"), phone: "+1-555-0221" },
    supplier_far: { person: "Jenna Ortiz", place: place("1450 Industrial Blvd", "Dallas", "TX", "75207", "US"), phone: "+1-555-0222" },
    local: { person: "Luis Romero", place: place("88 Riverside Dr", "Austin", "TX", "78741", "US"), phone: "+1-555-0223" },
    services: { person: "Chris Dalton", place: place("410 Ben White Blvd", "Austin", "TX", "78704", "US"), phone: "+1-555-0224" },
  },
  legalSuffix: " Inc.",
  tax: {
    standard: { intra: { rate: "Sales Tax" } },
    reduced: { intra: { rate: "Sales Tax" } },
    zero: { intra: null, supplyClass: "zero_rated" },
    exempt: { intra: null, supplyClass: "exempt" },
    export: { intra: null, supplyClass: "non_taxable" },
  },
  ownTaxRates: [{ name: "Sales Tax", rate: 8.25, useDefaultRate: true }],
};

const IN: CountryPack = {
  country: "IN",
  taxCountry: "IN",
  currency: { code: "INR", locale: "en-IN" },
  financialYearStart: { month: 4, day: 1 },
  scale: 1,
  business: { place: place("3rd Floor, 42 Residency Road", "Bengaluru", "Karnataka", "560025", "IN", "29"), phone: "+91 80 4555 0100", pan: "AAKCT4821M" },
  customers: {
    anchor: { name: "Halcyon Tech Parks Pvt Ltd", isCompany: true, person: { name: "Ramesh Iyer", title: "Head of Facilities" }, place: place("Outer Ring Road, Marathahalli", "Bengaluru", "Karnataka", "560037", "IN", "29"), phone: "+91 80 4555 0121", gstTreatment: "registered", pan: "AABCH7342K" },
    regional: { name: "Sahyadri Retail Pvt Ltd", isCompany: true, person: { name: "Neha Kulkarni", title: "Purchase Manager" }, place: place("Baner Road", "Pune", "Maharashtra", "411045", "IN", "27"), phone: "+91 20 4555 0122", gstTreatment: "registered", pan: "AAECS5521L" },
    consumer: { name: "Ananya Rao", isCompany: false, person: { name: "Ananya Rao", title: "Homeowner" }, place: place("18, 4th Cross, Indiranagar", "Bengaluru", "Karnataka", "560038", "IN", "29"), phone: "+91 80 4555 0123", gstTreatment: "consumer" },
    consumer_far: { name: "Karthik Subramanian", isCompany: false, person: { name: "Karthik Subramanian", title: "Homeowner" }, place: place("14 Lake View Layout", "Hosur", "Tamil Nadu", "635109", "IN", "33"), phone: "+91 4344 555 124", gstTreatment: "consumer" },
    institution: { name: "Lakshmi Multispeciality Hospital", isCompany: true, person: { name: "Dr. Meera Nair", title: "Administrator" }, place: place("Jayanagar 4th Block", "Bengaluru", "Karnataka", "560011", "IN", "29"), phone: "+91 80 4555 0125", gstTreatment: "registered", pan: "AAACL6610Q" },
    sez: { name: "Nimbus Data Systems Pvt Ltd (SEZ Unit)", isCompany: true, person: { name: "Arjun Menon", title: "Admin Manager" }, place: place("Electronic City Phase 1", "Bengaluru", "Karnataka", "560100", "IN", "29"), phone: "+91 80 4555 0126", gstTreatment: "sez", pan: "AAFCN2208P" },
    overseas: { name: "Al Noor Hospitality LLC", isCompany: true, person: { name: "Yusuf Rahman", title: "Projects Director" }, place: place("Office 1802, Marina Plaza", "Dubai", "Dubai", "", "AE"), phone: "+971 4 555 0127", gstTreatment: "overseas" },
  },
  vendors: {
    supplier: { person: "Suresh Gowda", place: place("Peenya Industrial Area", "Bengaluru", "Karnataka", "560058", "IN", "29"), phone: "+91 80 4555 0221", gstTreatment: "registered", pan: "AAGCA1185D" },
    supplier_far: { person: "Vijay Raghavan", place: place("Ambattur Industrial Estate", "Chennai", "Tamil Nadu", "600058", "IN", "33"), phone: "+91 44 4555 0222", gstTreatment: "registered", pan: "AAHCC4410E" },
    local: { person: "Ravi Kumar", place: place("Basavanagudi", "Bengaluru", "Karnataka", "560004", "IN", "29"), phone: "+91 80 4555 0223", gstTreatment: "unregistered" },
    services: { person: "Prakash Shetty", place: place("HSR Layout", "Bengaluru", "Karnataka", "560102", "IN", "29"), phone: "+91 80 4555 0224", gstTreatment: "registered", pan: "AAJCS3301F" },
  },
  legalSuffix: " Pvt Ltd",
  upiId: "demo.business@example",
};

const GB: CountryPack = {
  country: "GB",
  taxCountry: "GB",
  currency: { code: "GBP", locale: "en-GB" },
  financialYearStart: { month: 4, day: 1 },
  scale: 0.8,
  business: { place: place("14 Clerkenwell Road", "London", "Greater London", "EC1M 5PA", "GB"), phone: "+44 20 7946 0100" },
  customers: {
    anchor: { name: "Thameside Developments Ltd", isCompany: true, person: { name: "Hannah Price", title: "Development Manager" }, place: place("25 Wharf Street", "London", "Greater London", "SE8 3QA", "GB"), phone: "+44 20 7946 0121" },
    regional: { name: "Pennine Retail Group Ltd", isCompany: true, person: { name: "Tom Fletcher", title: "Estates Manager" }, place: place("70 Deansgate", "Manchester", "Greater Manchester", "M3 2FW", "GB"), phone: "+44 161 496 0122" },
    consumer: { name: "Olivia Bennett", isCompany: false, person: { name: "Olivia Bennett", title: "Homeowner" }, place: place("9 Albion Grove", "London", "Greater London", "N16 8RE", "GB"), phone: "+44 20 7946 0123" },
    consumer_far: { name: "James Whitaker", isCompany: false, person: { name: "James Whitaker", title: "Homeowner" }, place: place("31 Otley Road", "Leeds", "West Yorkshire", "LS6 3AA", "GB"), phone: "+44 113 496 0124" },
    institution: { name: "St Bride's Academy Trust", isCompany: true, person: { name: "Fiona Grant", title: "Business Manager" }, place: place("Bride Lane", "London", "Greater London", "EC4Y 8DT", "GB"), phone: "+44 20 7946 0125" },
    sez: { name: "Kingsway Logistics Ltd", isCompany: true, person: { name: "Raj Patel", title: "Operations Lead" }, place: place("Unit 4, Tyburn Road", "Birmingham", "West Midlands", "B24 8NB", "GB"), phone: "+44 121 496 0126" },
    overseas: { name: "Nordhavn Design ApS", isCompany: true, person: { name: "Mette Larsen", title: "Partner" }, place: place("Århusgade 88", "Copenhagen", "Capital Region", "2100", "DK"), phone: "+45 3555 0127" },
  },
  vendors: {
    supplier: { person: "Gareth Hughes", place: place("Unit 12, Lea Bridge Industrial Estate", "London", "Greater London", "E10 7QN", "GB"), phone: "+44 20 7946 0221" },
    supplier_far: { person: "Shona MacLeod", place: place("40 Hydepark Street", "Glasgow", "Glasgow City", "G3 8BW", "GB"), phone: "+44 141 496 0222" },
    local: { person: "Danny Walsh", place: place("5 Mare Street", "London", "Greater London", "E8 4RP", "GB"), phone: "+44 20 7946 0223" },
    services: { person: "Priya Sharma", place: place("110 Old Kent Road", "London", "Greater London", "SE1 5TY", "GB"), phone: "+44 20 7946 0224" },
  },
  legalSuffix: " Ltd",
  tax: {
    standard: { intra: { rate: "VAT 20%" } },
    reduced: { intra: { rate: "VAT 5%" } },
    zero: { intra: { rate: "VAT 0%" } },
    exempt: { intra: { rate: "Exempt" } },
    // Services to a business abroad are outside the scope of UK VAT.
    export: { intra: null, supplyClass: "non_taxable" },
  },
  expenseTax: { rate: { rate: "VAT 20%" }, percent: 20 },
};

const AU: CountryPack = {
  country: "AU",
  taxCountry: "AU",
  currency: { code: "AUD", locale: "en-AU" },
  financialYearStart: { month: 7, day: 1 },
  scale: 1.5,
  business: { place: place("Level 5, 120 Collins Street", "Melbourne", "VIC", "3000", "AU"), phone: "+61 3 5550 0100" },
  customers: {
    anchor: { name: "Yarra Bend Properties Pty Ltd", isCompany: true, person: { name: "Sarah Mitchell", title: "Property Manager" }, place: place("88 Swan Street", "Richmond", "VIC", "3121", "AU"), phone: "+61 3 5550 0121" },
    regional: { name: "Coral Coast Retail Pty Ltd", isCompany: true, person: { name: "Josh Turner", title: "Store Fit-out Manager" }, place: place("45 Eagle Street", "Brisbane", "QLD", "4000", "AU"), phone: "+61 7 5550 0122" },
    consumer: { name: "Chloe Nguyen", isCompany: false, person: { name: "Chloe Nguyen", title: "Homeowner" }, place: place("17 Rathdowne Street", "Carlton", "VIC", "3053", "AU"), phone: "+61 3 5550 0123" },
    consumer_far: { name: "Liam O'Connor", isCompany: false, person: { name: "Liam O'Connor", title: "Homeowner" }, place: place("6 Glebe Point Road", "Glebe", "NSW", "2037", "AU"), phone: "+61 2 5550 0124" },
    institution: { name: "Eastbrook Medical Centre", isCompany: true, person: { name: "Dr. Priya Raman", title: "Practice Manager" }, place: place("230 Burwood Highway", "Burwood", "VIC", "3125", "AU"), phone: "+61 3 5550 0125" },
    sez: { name: "Southern Freight Co. Pty Ltd", isCompany: true, person: { name: "Matt Kelly", title: "Depot Manager" }, place: place("12 Corio Quay Road", "Geelong", "VIC", "3215", "AU"), phone: "+61 3 5550 0126" },
    overseas: { name: "Kiwi Harbour Ventures Ltd", isCompany: true, person: { name: "Aroha Parata", title: "Director" }, place: place("10 Customs Street", "Auckland", "Auckland", "1010", "NZ"), phone: "+64 9 555 0127" },
  },
  vendors: {
    supplier: { person: "Dave Wilson", place: place("21 Dandenong Road", "Clayton", "VIC", "3168", "AU"), phone: "+61 3 5550 0221" },
    supplier_far: { person: "Emma Clarke", place: place("8 Parramatta Road", "Granville", "NSW", "2142", "AU"), phone: "+61 2 5550 0222" },
    local: { person: "Nick Papadopoulos", place: place("3 Sydney Road", "Brunswick", "VIC", "3056", "AU"), phone: "+61 3 5550 0223" },
    services: { person: "Tara Singh", place: place("55 Plummer Street", "Port Melbourne", "VIC", "3207", "AU"), phone: "+61 3 5550 0224" },
  },
  legalSuffix: " Pty Ltd",
  tax: {
    standard: { intra: { rate: "GST 10%" } },
    reduced: { intra: { rate: "GST 10%" } },
    zero: { intra: { rate: "GST-free" } },
    exempt: { intra: { rate: "Exempt" } },
    export: { intra: { rate: "GST-free" } },
  },
  expenseTax: { rate: { rate: "GST 10%" }, percent: 10 },
};

const NZ: CountryPack = {
  country: "NZ",
  taxCountry: "NZ",
  currency: { code: "NZD", locale: "en-NZ" },
  financialYearStart: { month: 4, day: 1 },
  scale: 1.65,
  business: { place: place("Level 3, 45 Queen Street", "Auckland", "Auckland", "1010", "NZ"), phone: "+64 9 555 0100" },
  customers: {
    anchor: { name: "Waitematā Properties Ltd", isCompany: true, person: { name: "Grace Henare", title: "Asset Manager" }, place: place("150 Quay Street", "Auckland", "Auckland", "1010", "NZ"), phone: "+64 9 555 0121" },
    regional: { name: "Southern Alps Retail Ltd", isCompany: true, person: { name: "Sam Robertson", title: "Store Development Lead" }, place: place("90 Cashel Street", "Christchurch", "Canterbury", "8011", "NZ"), phone: "+64 3 555 0122" },
    consumer: { name: "Aroha Williams", isCompany: false, person: { name: "Aroha Williams", title: "Homeowner" }, place: place("22 Ponsonby Road", "Auckland", "Auckland", "1011", "NZ"), phone: "+64 9 555 0123" },
    consumer_far: { name: "Ben Thompson", isCompany: false, person: { name: "Ben Thompson", title: "Homeowner" }, place: place("7 Oriental Parade", "Wellington", "Wellington", "6011", "NZ"), phone: "+64 4 555 0124" },
    institution: { name: "Ponsonby Medical Centre", isCompany: true, person: { name: "Dr. Hannah Lee", title: "Practice Manager" }, place: place("150 Jervois Road", "Auckland", "Auckland", "1011", "NZ"), phone: "+64 9 555 0125" },
    sez: { name: "Harbourline Logistics Ltd", isCompany: true, person: { name: "Tama Ngata", title: "Operations Manager" }, place: place("20 Hewletts Road", "Tauranga", "Bay of Plenty", "3116", "NZ"), phone: "+64 7 555 0126" },
    overseas: { name: "Bondi Studio Pty Ltd", isCompany: true, person: { name: "Jess Morgan", title: "Founder" }, place: place("82 Campbell Parade", "Bondi Beach", "NSW", "2026", "AU"), phone: "+61 2 5550 0127" },
  },
  vendors: {
    supplier: { person: "Mike Anderson", place: place("33 Great South Road", "Penrose", "Auckland", "1061", "NZ"), phone: "+64 9 555 0221" },
    supplier_far: { person: "Kate Murray", place: place("14 Hutt Road", "Wellington", "Wellington", "6035", "NZ"), phone: "+64 4 555 0222" },
    local: { person: "Rangi Tipene", place: place("6 Dominion Road", "Auckland", "Auckland", "1024", "NZ"), phone: "+64 9 555 0223" },
    services: { person: "Leah Fraser", place: place("40 Rosebank Road", "Avondale", "Auckland", "1026", "NZ"), phone: "+64 9 555 0224" },
  },
  legalSuffix: " Ltd",
  tax: {
    standard: { intra: { rate: "GST 15%" } },
    reduced: { intra: { rate: "GST 15%" } },
    zero: { intra: { rate: "GST 0%" } },
    exempt: { intra: { rate: "Exempt" } },
    export: { intra: { rate: "GST 0%" } },
  },
  expenseTax: { rate: { rate: "GST 15%" }, percent: 15 },
};

const AE: CountryPack = {
  country: "AE",
  taxCountry: "AE",
  currency: { code: "AED", locale: "en-AE" },
  financialYearStart: { month: 1, day: 1 },
  scale: 3.67,
  business: { place: place("Office 1204, Bay Square Building 9, Business Bay", "Dubai", "Dubai", "", "AE"), phone: "+971 4 555 0100" },
  customers: {
    anchor: { name: "Al Waha Properties LLC", isCompany: true, person: { name: "Khalid Al Mansoori", title: "Facilities Manager" }, place: place("Tower B, Al Barsha 1", "Dubai", "Dubai", "", "AE"), phone: "+971 4 555 0121" },
    regional: { name: "Corniche Retail LLC", isCompany: true, person: { name: "Rania Haddad", title: "Store Projects Manager" }, place: place("Corniche Road West", "Abu Dhabi", "Abu Dhabi", "", "AE"), phone: "+971 2 555 0122" },
    consumer: { name: "Fatima Al Hashimi", isCompany: false, person: { name: "Fatima Al Hashimi", title: "Homeowner" }, place: place("Villa 14, Street 21, Al Safa 2", "Dubai", "Dubai", "", "AE"), phone: "+971 4 555 0123" },
    consumer_far: { name: "Omar Khalid", isCompany: false, person: { name: "Omar Khalid", title: "Homeowner" }, place: place("Al Majaz 3", "Sharjah", "Sharjah", "", "AE"), phone: "+971 6 555 0124" },
    institution: { name: "Jumeirah Family Clinic", isCompany: true, person: { name: "Dr. Sana Qureshi", title: "Clinic Manager" }, place: place("Jumeirah Beach Road", "Dubai", "Dubai", "", "AE"), phone: "+971 4 555 0125" },
    sez: { name: "Jebel Ali Freight FZE", isCompany: true, person: { name: "Vikram Pillai", title: "Warehouse Manager" }, place: place("Plot S30210, Jebel Ali Free Zone", "Dubai", "Dubai", "", "AE"), phone: "+971 4 555 0126" },
    overseas: { name: "Thames Hospitality Ltd", isCompany: true, person: { name: "Oliver Grant", title: "Development Director" }, place: place("1 Southwark Bridge Road", "London", "Greater London", "SE1 9HL", "GB"), phone: "+44 20 7946 0127" },
  },
  vendors: {
    supplier: { person: "Anil Varghese", place: place("Warehouse 7, Al Quoz Industrial Area 3", "Dubai", "Dubai", "", "AE"), phone: "+971 4 555 0221" },
    supplier_far: { person: "Hassan Saleh", place: place("Mussafah Industrial Area M-12", "Abu Dhabi", "Abu Dhabi", "", "AE"), phone: "+971 2 555 0222" },
    local: { person: "Joseph Mathew", place: place("Al Karama", "Dubai", "Dubai", "", "AE"), phone: "+971 4 555 0223" },
    services: { person: "Leila Nasser", place: place("Dubai Investments Park 1", "Dubai", "Dubai", "", "AE"), phone: "+971 4 555 0224" },
  },
  legalSuffix: " LLC",
  tax: {
    standard: { intra: { rate: "VAT 5%" } },
    reduced: { intra: { rate: "VAT 5%" } },
    zero: { intra: { rate: "VAT 0%" } },
    exempt: { intra: { rate: "Exempt" } },
    export: { intra: { rate: "VAT 0%" } },
  },
  expenseTax: { rate: { rate: "VAT 5%" }, percent: 5 },
};

const SA: CountryPack = {
  country: "SA",
  taxCountry: "SA",
  currency: { code: "SAR", locale: "en-SA" },
  financialYearStart: { month: 1, day: 1 },
  scale: 3.75,
  business: { place: place("King Fahd Road, Al Olaya", "Riyadh", "Riyadh", "12211", "SA"), phone: "+966 11 555 0100" },
  customers: {
    anchor: { name: "Al Noor Real Estate Co.", isCompany: true, person: { name: "Faisal Al Otaibi", title: "Projects Manager" }, place: place("Prince Mohammed bin Abdulaziz Road", "Riyadh", "Riyadh", "12241", "SA"), phone: "+966 11 555 0121" },
    regional: { name: "Red Sea Retail Co.", isCompany: true, person: { name: "Lina Bakr", title: "Store Development Manager" }, place: place("Tahlia Street", "Jeddah", "Makkah", "23431", "SA"), phone: "+966 12 555 0122" },
    consumer: { name: "Abdullah Al Harbi", isCompany: false, person: { name: "Abdullah Al Harbi", title: "Homeowner" }, place: place("Al Nakheel District", "Riyadh", "Riyadh", "12382", "SA"), phone: "+966 11 555 0123" },
    consumer_far: { name: "Noura Al Qahtani", isCompany: false, person: { name: "Noura Al Qahtani", title: "Homeowner" }, place: place("Al Faisaliyah District", "Dammam", "Eastern Province", "32272", "SA"), phone: "+966 13 555 0124" },
    institution: { name: "Al Malaz Medical Center", isCompany: true, person: { name: "Dr. Huda Al Saud", title: "Administrator" }, place: place("Salahuddin Road, Al Malaz", "Riyadh", "Riyadh", "12831", "SA"), phone: "+966 11 555 0125" },
    sez: { name: "Eastern Province Logistics Co.", isCompany: true, person: { name: "Imran Siddiqui", title: "Operations Manager" }, place: place("Second Industrial City", "Dammam", "Eastern Province", "34326", "SA"), phone: "+966 13 555 0126" },
    overseas: { name: "Gulf Bridge Trading LLC", isCompany: true, person: { name: "Ahmed Rashid", title: "Managing Director" }, place: place("Port Saeed, Deira", "Dubai", "Dubai", "", "AE"), phone: "+971 4 555 0127" },
  },
  vendors: {
    supplier: { person: "Majed Al Shehri", place: place("Second Industrial City", "Riyadh", "Riyadh", "14334", "SA"), phone: "+966 11 555 0221" },
    supplier_far: { person: "Tariq Hamdan", place: place("Industrial Area 3", "Jeddah", "Makkah", "22426", "SA"), phone: "+966 12 555 0222" },
    local: { person: "Ali Hassan", place: place("Al Batha", "Riyadh", "Riyadh", "12631", "SA"), phone: "+966 11 555 0223" },
    services: { person: "Sara Al Ghamdi", place: place("Al Sulay", "Riyadh", "Riyadh", "14322", "SA"), phone: "+966 11 555 0224" },
  },
  legalSuffix: " Co.",
  tax: {
    standard: { intra: { rate: "VAT 15%" } },
    reduced: { intra: { rate: "VAT 15%" } },
    zero: { intra: { rate: "VAT 0%" } },
    exempt: { intra: { rate: "Exempt" } },
    export: { intra: { rate: "VAT 0%" } },
  },
  expenseTax: { rate: { rate: "VAT 15%" }, percent: 15 },
};

export const COUNTRY_PACKS: Record<DemoCountry, CountryPack> = { US, IN, GB, AU, NZ, AE, SA };
