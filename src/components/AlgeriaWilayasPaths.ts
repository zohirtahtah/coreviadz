/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WilayaPathData {
  code: string;
  name: string;
  nameAr: string;
  region: 'north_west' | 'north_center' | 'north_east' | 'high_plains_west' | 'high_plains_east' | 'sahara_north' | 'sahara_south';
  points: string; // SVG Points structure "x1,y1 x2,y2 x3,y3 ..."
  center: { x: number; y: number };
}

// 600x550 coordinate space matching the real geographic layout of the Algerian provinces (Wilayas)
export const algeriaWilayasPaths: WilayaPathData[] = [
  // ==================== NORTH COAST WEST ====================
  {
    code: "46",
    name: "Aïn Témouchent",
    nameAr: "عين تموشنت",
    region: "north_west",
    points: "115,100 135,102 135,115 110,115",
    center: { x: 122, y: 108 }
  },
  {
    code: "13",
    name: "Tlemcen",
    nameAr: "تلمسان",
    region: "north_west",
    points: "90,110 115,100 110,115 115,135 90,135",
    center: { x: 105, y: 122 }
  },
  {
    code: "68",
    name: "Maghnia",
    nameAr: "مغنية",
    region: "north_west",
    points: "70,115 90,110 90,135 70,135",
    center: { x: 80, y: 125 }
  },
  {
    code: "31",
    name: "Oran",
    nameAr: "وهران",
    region: "north_west",
    points: "135,102 165,100 165,115 135,115",
    center: { x: 150, y: 107 }
  },
  {
    code: "27",
    name: "Mostaganem",
    nameAr: "مستغانم",
    region: "north_west",
    points: "165,100 195,95 195,110 165,115",
    center: { x: 180, y: 105 }
  },
  {
    code: "29",
    name: "Mascara",
    nameAr: "معسكر",
    region: "high_plains_west",
    points: "135,115 165,115 175,135 145,140 135,130",
    center: { x: 152, y: 125 }
  },
  {
    code: "22",
    name: "Sidi Bel Abbès",
    nameAr: "سيدي بلعباس",
    region: "high_plains_west",
    points: "115,135 145,140 150,165 115,160",
    center: { x: 130, y: 148 }
  },
  {
    code: "20",
    name: "Saïda",
    nameAr: "سعيدة",
    region: "high_plains_west",
    points: "145,140 175,135 180,165 150,165",
    center: { x: 162, y: 150 }
  },
  {
    code: "48",
    name: "Relizane",
    nameAr: "غليزان",
    region: "high_plains_west",
    points: "165,115 195,110 205,130 175,135",
    center: { x: 185, y: 122 }
  },

  // ==================== NORTH COAST CENTER ====================
  {
    code: "02",
    name: "Chlef",
    nameAr: "الشلف",
    region: "north_center",
    points: "195,95 225,90 225,115 195,110",
    center: { x: 210, y: 102 }
  },
  {
    code: "42",
    name: "Tipaza",
    nameAr: "تيبازة",
    region: "north_center",
    points: "225,90 255,85 255,100 225,100",
    center: { x: 240, y: 92 }
  },
  {
    code: "16",
    name: "Alger",
    nameAr: "الجزائر العاصمة",
    region: "north_center",
    points: "255,85 275,85 275,100 255,100",
    center: { x: 265, y: 92 }
  },
  {
    code: "35",
    name: "Boumerdès",
    nameAr: "بومرداس",
    region: "north_center",
    points: "275,85 295,88 295,100 275,100",
    center: { x: 285, y: 92 }
  },
  {
    code: "15",
    name: "Tizi Ouzou",
    nameAr: "تيزي وزو",
    region: "north_center",
    points: "295,88 325,92 325,110 295,105",
    center: { x: 310, y: 98 }
  },
  {
    code: "09",
    name: "Blida",
    nameAr: "البليدة",
    region: "north_center",
    points: "240,100 275,100 275,115 240,115",
    center: { x: 258, y: 108 }
  },
  {
    code: "44",
    name: "Aïn Defla",
    nameAr: "عين الدفلى",
    region: "north_center",
    points: "210,112 240,110 240,130 210,130",
    center: { x: 225, y: 120 }
  },
  {
    code: "26",
    name: "Médiah",
    nameAr: "المدية",
    region: "north_center",
    points: "240,115 275,115 285,140 240,140",
    center: { x: 260, y: 128 }
  },
  {
    code: "10",
    name: "Bouira",
    nameAr: "البويرة",
    region: "north_center",
    points: "275,100 305,100 305,120 275,115",
    center: { x: 290, y: 108 }
  },
  {
    code: "64",
    name: "Ksar El Boukhari",
    nameAr: "قصر البخاري",
    region: "high_plains_west",
    points: "240,140 285,140 285,160 240,165",
    center: { x: 262, y: 152 }
  },

  // ==================== NORTH COAST EAST ====================
  {
    code: "06",
    name: "Béjaïa",
    nameAr: "بجاية",
    region: "north_east",
    points: "325,92 355,95 355,115 325,110",
    center: { x: 340, y: 102 }
  },
  {
    code: "18",
    name: "Jijel",
    nameAr: "جيجل",
    region: "north_east",
    points: "355,95 385,98 385,115 355,115",
    center: { x: 370, y: 106 }
  },
  {
    code: "21",
    name: "Skikda",
    nameAr: "سكيكدة",
    region: "north_east",
    points: "385,98 420,100 420,118 385,115",
    center: { x: 402, y: 109 }
  },
  {
    code: "23",
    name: "Annaba",
    nameAr: "عنابة",
    region: "north_east",
    points: "420,100 440,100 440,115 420,115",
    center: { x: 430, y: 108 }
  },
  {
    code: "36",
    name: "El Tarf",
    nameAr: "الطارف",
    region: "north_east",
    points: "440,100 465,102 465,120 440,115",
    center: { x: 452, y: 110 }
  },

  // ==================== HIGH PLAINS WEST & CENTER ====================
  {
    code: "38",
    name: "Tissemsilt",
    nameAr: "تسمسيلت",
    region: "high_plains_west",
    points: "195,110 225,115 225,135 195,135",
    center: { x: 210, y: 122 }
  },
  {
    code: "14",
    name: "Tiaret",
    nameAr: "تيارت",
    region: "high_plains_west",
    points: "175,135 205,130 215,160 180,165",
    center: { x: 195, y: 148 }
  },
  {
    code: "66",
    name: "Frenda",
    nameAr: "فرندة",
    region: "high_plains_west",
    points: "150,165 180,165 215,160 210,185 180,185",
    center: { x: 180, y: 175 }
  },
  {
    code: "65",
    name: "Aïn Oussera",
    nameAr: "عين وسارة",
    region: "high_plains_west",
    points: "215,160 250,165 265,185 210,185",
    center: { x: 235, y: 172 }
  },
  {
    code: "17",
    name: "Djelfa",
    nameAr: "الجلفة",
    region: "sahara_north",
    points: "240,185 300,180 300,230 240,240",
    center: { x: 270, y: 210 }
  },
  {
    code: "61",
    name: "Mesâad",
    nameAr: "مسعد",
    region: "sahara_north",
    points: "240,240 305,230 305,275 235,275",
    center: { x: 270, y: 255 }
  },
  {
    code: "28",
    name: "M'Sila",
    nameAr: "المسيلة",
    region: "high_plains_east",
    points: "285,140 335,135 340,165 285,170",
    center: { x: 310, y: 152 }
  },
  {
    code: "60",
    name: "Boussaâda",
    nameAr: "بوسعادة",
    region: "high_plains_east",
    points: "285,170 340,165 350,195 300,195",
    center: { x: 318, y: 182 }
  },

  // ==================== HIGH PLAINS EAST ====================
  {
    code: "34",
    name: "Bordj Bou Arréridj",
    nameAr: "برج بوعريريج",
    region: "high_plains_east",
    points: "305,115 330,115 335,135 305,135",
    center: { x: 318, y: 125 }
  },
  {
    code: "19",
    name: "Sétif",
    nameAr: "سطيف",
    region: "high_plains_east",
    points: "330,115 365,115 370,135 335,135",
    center: { x: 348, y: 125 }
  },
  {
    code: "62",
    name: "El Eulma",
    nameAr: "العلمة",
    region: "high_plains_east",
    points: "365,115 385,115 390,135 370,135",
    center: { x: 378, y: 125 }
  },
  {
    code: "43",
    name: "Mila",
    nameAr: "ميلة",
    region: "high_plains_east",
    points: "385,115 405,115 410,135 390,135",
    center: { x: 398, y: 125 }
  },
  {
    code: "25",
    name: "Constantine",
    nameAr: "قسنطينة",
    region: "high_plains_east",
    points: "405,115 425,115 430,130 410,135",
    center: { x: 418, y: 125 }
  },
  {
    code: "24",
    name: "Guelma",
    nameAr: "قالمة",
    region: "high_plains_east",
    points: "425,115 445,115 450,130 430,130",
    center: { x: 438, y: 122 }
  },
  {
    code: "41",
    name: "Souk Ahras",
    nameAr: "سوق أهراس",
    region: "high_plains_east",
    points: "445,115 465,115 470,135 450,130",
    center: { x: 458, y: 122 }
  },
  {
    code: "67",
    name: "Sédrata",
    nameAr: "سدراتة",
    region: "high_plains_east",
    points: "435,130 470,135 475,150 440,150",
    center: { x: 455, y: 140 }
  },
  {
    code: "04",
    name: "Oum El Bouaghi",
    nameAr: "أم البواقي",
    region: "high_plains_east",
    points: "405,135 440,130 440,150 405,155",
    center: { x: 422, y: 142 }
  },
  {
    code: "05",
    name: "Batna",
    nameAr: "باتنة",
    region: "high_plains_east",
    points: "355,145 405,155 405,185 355,175",
    center: { x: 380, y: 165 }
  },
  {
    code: "59",
    name: "Barika",
    nameAr: "بريكة",
    region: "high_plains_east",
    points: "335,145 355,145 355,175 330,175",
    center: { x: 345, y: 160 }
  },
  {
    code: "40",
    name: "Khenchela",
    nameAr: "خنشلة",
    region: "high_plains_east",
    points: "405,155 445,150 445,180 405,185",
    center: { x: 425, y: 168 }
  },
  {
    code: "12",
    name: "Tébessa",
    nameAr: "تبسة",
    region: "high_plains_east",
    points: "445,135 480,135 480,185 445,180",
    center: { x: 462, y: 158 }
  },

  // ==================== SAHARA NORTH ====================
  {
    code: "07",
    name: "Biskra",
    nameAr: "بسكرة",
    region: "sahara_north",
    points: "330,175 405,185 415,220 345,210",
    center: { x: 375, y: 198 }
  },
  {
    code: "51",
    name: "Ouled Djellal",
    nameAr: "أولاد جلال",
    region: "sahara_north",
    points: "300,195 345,210 345,245 300,230",
    center: { x: 322, y: 220 }
  },
  {
    code: "57",
    name: "El M'Ghair",
    nameAr: "المغير",
    region: "sahara_north",
    points: "345,210 415,220 405,255 345,245",
    center: { x: 378, y: 232 }
  },
  {
    code: "39",
    name: "El Oued",
    nameAr: "الوادي",
    region: "sahara_north",
    points: "415,185 480,185 480,240 405,255",
    center: { x: 445, y: 212 }
  },
  {
    code: "55",
    name: "Touggourt",
    nameAr: "تقرت",
    region: "sahara_north",
    points: "405,240 480,240 475,285 405,285",
    center: { x: 440, y: 262 }
  },
  {
    code: "32",
    name: "El Bayadh",
    nameAr: "البيض",
    region: "sahara_north",
    points: "150,185 210,185 200,240 145,240",
    center: { x: 175, y: 212 }
  },
  {
    code: "69",
    name: "El Abiodh Sidi Cheikh",
    nameAr: "الأبيض سيد الشيخ",
    region: "sahara_north",
    points: "145,240 200,240 190,295 135,295",
    center: { x: 168, y: 268 }
  },
  {
    code: "45",
    name: "Naâma",
    nameAr: "النعامة",
    region: "sahara_north",
    points: "115,160 150,165 150,210 110,210",
    center: { x: 130, y: 185 }
  },
  {
    code: "03",
    name: "Laghouat",
    nameAr: "الأغواط",
    region: "sahara_north",
    points: "210,185 240,185 235,240 200,240",
    center: { x: 222, y: 212 }
  },
  {
    code: "63",
    name: "Aflou",
    nameAr: "أفلو",
    region: "sahara_north",
    points: "200,240 235,240 235,295 190,295",
    center: { x: 215, y: 268 }
  },
  {
    code: "47",
    name: "Ghardaïa",
    nameAr: "غرداية",
    region: "sahara_north",
    points: "235,275 305,275 300,335 230,335",
    center: { x: 268, y: 305 }
  },
  {
    code: "58",
    name: "El Meniaa",
    nameAr: "المنيعة",
    region: "sahara_north",
    points: "230,335 300,335 285,410 215,410",
    center: { x: 258, y: 372 }
  },
  {
    code: "30",
    name: "Ouargla",
    nameAr: "ورقلة",
    region: "sahara_north",
    points: "305,275 405,285 390,395 285,410",
    center: { x: 345, y: 340 }
  },

  // ==================== SAHARA SOUTH / DEEP DESERT ====================
  {
    code: "33",
    name: "Illizi",
    nameAr: "إليزي",
    region: "sahara_south",
    points: "390,285 480,285 480,420 390,420",
    center: { x: 435, y: 352 }
  },
  {
    code: "56",
    name: "Djanet",
    nameAr: "جانت",
    region: "sahara_south",
    points: "390,420 480,420 480,520 390,520",
    center: { x: 435, y: 470 }
  },
  {
    code: "53",
    name: "In Salah",
    nameAr: "عين صالح",
    region: "sahara_south",
    points: "215,410 285,410 285,475 215,475",
    center: { x: 250, y: 442 }
  },
  {
    code: "11",
    name: "Tamanrasset",
    nameAr: "تمنراست",
    region: "sahara_south",
    points: "285,410 390,420 390,520 285,520",
    center: { x: 338, y: 465 }
  },
  {
    code: "54",
    name: "In Guezzam",
    nameAr: "عين قزام",
    region: "sahara_south",
    points: "285,520 390,520 350,545 285,545",
    center: { x: 328, y: 532 }
  },
  {
    code: "49",
    name: "Timimoun",
    nameAr: "تيميمون",
    region: "sahara_south",
    points: "135,295 190,295 215,410 145,410",
    center: { x: 172, y: 352 }
  },
  {
    code: "01",
    name: "Adrar",
    nameAr: "أدرار",
    region: "sahara_south",
    points: "145,410 215,410 215,475 145,475",
    center: { x: 180, y: 442 }
  },
  {
    code: "50",
    name: "Bordj Baji Mokhtar",
    nameAr: "برج باجي مختار",
    region: "sahara_south",
    points: "145,475 215,475 285,545 145,545",
    center: { x: 198, y: 510 }
  },
  {
    code: "08",
    name: "Béchar",
    nameAr: "بشار",
    region: "sahara_south",
    points: "75,210 115,210 135,295 75,295",
    center: { x: 100, y: 252 }
  },
  {
    code: "52",
    name: "Béni Abbès",
    nameAr: "بني عباس",
    region: "sahara_south",
    points: "75,295 135,295 145,410 75,410",
    center: { x: 108, y: 352 }
  },
  {
    code: "37",
    name: "Tindouf",
    nameAr: "تندوف",
    region: "sahara_south",
    points: "25,350 75,350 75,410 25,410",
    center: { x: 50, y: 380 }
  }
];
