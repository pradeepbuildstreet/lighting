// Validate product data from Excel

exports.validateProduct = (data, compulsoryColumns) => {
  const errors = [];

  // Check compulsory fields
  compulsoryColumns.forEach(col => {
    if (!data[col] || data[col] === "" || data[col] === null) {
      errors.push(`Compulsory field missing: ${col}`);
    }
  });

  // Validate specific formats
  if (data.price) {
    const price = parseFloat(data.price);
    if (price <= 0) {
      errors.push("Price must be positive");
    }
  }

  if (data.wattage) {
    const wattage = parseFloat(data.wattage);
    if (wattage <= 0) {
      errors.push("Wattage must be positive");
    }
  }

  if (data.lumens) {
    const lumens = parseInt(data.lumens);
    if (lumens <= 0) {
      errors.push("Lumens must be positive");
    }
  }

  // Valid color temperatures for lighting (Kelvin)
  const validColorTemps = [2700, 3000, 3500, 4000, 5000, 6000, 6500];
  if (data.color_temperature) {
    const temp = parseInt(data.color_temperature);
    if (!validColorTemps.includes(temp)) {
      errors.push(`Invalid color temperature. Use: ${validColorTemps.join(", ")}K`);
    }
  }

  // Validate SKU format (optional but recommended)
  if (data.sku) {
    const skuPattern = /^[A-Z0-9-]{5,50}$/;
    if (!skuPattern.test(data.sku.toUpperCase())) {
      errors.push("SKU should be 5-50 characters, alphanumeric with hyphens (e.g., DL-001)");
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
