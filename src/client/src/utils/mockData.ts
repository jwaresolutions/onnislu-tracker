// Mock data for development mode
export const generateMockFloorPlans = (count: number = 20) => {
  const buildings = ['Fairview', 'Boren'];
  const wings = ['D', 'E'];
  const plans: any[] = [];
  
  for (let i = 0; i < count; i++) {
    const wing = wings[i % wings.length];
    const num = Math.floor(i / 2) + 1;
    const building = buildings[i % buildings.length];
    const basePrice = 2000 + Math.floor(Math.random() * 1500);
    const isAvailable = Math.random() > 0.3;
    
    plans.push({
      id: i + 1,
      name: `Plan ${wing}-${num}`,
      building_name: building,
      current_price: isAvailable ? basePrice : null,
      lowest_price: basePrice - Math.floor(Math.random() * 300),
      is_available: isAvailable,
      square_footage: 600 + Math.floor(Math.random() * 600),
      image_url: `/static/plan-images/t${i % 2 + 1}-plan_${wing.toLowerCase()}${num}.png`,
      bedrooms: Math.floor(Math.random() * 3) + 1,
      bathrooms: Math.floor(Math.random() * 2) + 1,
      has_den: Math.random() > 0.7,
    });
  }
  
  return plans;
};

export const generateMockHistory = (basePrice: number, days: number = 60) => {
  const history: { collection_date: string; price: number }[] = [];
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Generate realistic price fluctuations
    const variance = Math.sin(i / 10) * 100 + (Math.random() - 0.5) * 50;
    const price = Math.max(basePrice - 200, basePrice + variance);
    
    history.push({
      collection_date: date.toISOString(),
      price: Math.round(price),
    });
  }
  
  return history;
};

export const generateMockAvailability = () => {
  const wings = ['D', 'E'];
  const availableNow: { name: string; moveInDate?: string }[] = [];
  
  for (let i = 0; i < 8; i++) {
    const wing = wings[i % wings.length];
    const num = Math.floor(i / 2) + 1;
    availableNow.push({
      name: `Plan ${wing}-${num}`,
      moveInDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  
  return availableNow;
};

export const generateMockAvailableSoon = () => {
  return {
    headers: ['Unit', 'Bedrooms', 'Bathrooms', 'Sq Ft', 'Available Date', 'Price'],
    rows: [
      ['Plan D-5', '2', '2', '950', '2025-01-15', '$2,800'],
      ['Plan E-3', '1', '1', '750', '2025-01-20', '$2,400'],
      ['Plan D-7', '2', '2', '1000', '2025-02-01', '$3,100'],
      ['Plan E-6', '1', '1.5', '800', '2025-02-10', '$2,600'],
    ],
  };
};

export const generateMockStatus = () => {
  return {
    database: {
      connected: true,
      integrity: 'ok',
      stats: {
        buildings: 2,
        floor_plans: 45,
        price_records: 2847,
      },
    },
    scheduler: {
      nextCollection: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      lastCollection: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
  };
};

export const generateMockLatestPrices = () => {
  return {
    count: 38,
    lastUpdated: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  };
};

export const generateMockAlerts = () => {
  return [
    {
      id: 1,
      floor_plan_id: 3,
      floor_plan_name: 'Plan D-2',
      building_name: 'Fairview',
      alert_type: 'price_drop' as const,
      old_price: 2800,
      new_price: 2600,
      percentage_change: -7.14,
      is_dismissed: false,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 2,
      floor_plan_id: 7,
      floor_plan_name: 'Plan E-4',
      building_name: 'Boren',
      alert_type: 'price_drop' as const,
      old_price: 2400,
      new_price: 2250,
      percentage_change: -6.25,
      is_dismissed: false,
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 3,
      floor_plan_id: 12,
      floor_plan_name: 'Plan D-6',
      building_name: 'Fairview',
      alert_type: 'lowest_price' as const,
      old_price: 2900,
      new_price: 2700,
      percentage_change: -6.9,
      is_dismissed: false,
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
};

// Check if we're in development mode
export const isDevelopmentMode = () => {
  return import.meta.env.MODE === 'development' || import.meta.env.DEV;
};
