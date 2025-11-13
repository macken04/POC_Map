/**
 * Sportive Prints - Enhanced Variant Selector
 * Handles variant selection for Size, Style, and Orientation
 */

class SportiveVariantSelector {
  constructor() {
    this.currentSelections = {
      size: null,
      style: null,
      orientation: null
    };

    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    // Check if we're on a sportive print product page
    if (!document.body.classList.contains('template-product')) {
      return;
    }

    // Initialize selectors
    this.setupSizeSelector();
    this.setupStyleSelector();
    this.setupOrientationSelector();

    // Set initial selections from URL or defaults
    this.setInitialSelections();

    // Listen for variant changes from standard Shopify variant picker
    this.watchStandardVariantPicker();
  }

  setupSizeSelector() {
    const sizeOptions = document.querySelectorAll('.sportive-size-option');
    sizeOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        const size = e.currentTarget.dataset.size;
        this.selectSize(size);
      });
    });
  }

  setupStyleSelector() {
    const styleSwatches = document.querySelectorAll('.sportive-style-swatch');
    styleSwatches.forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        const style = e.currentTarget.dataset.style;
        this.selectStyle(style);
      });
    });
  }

  setupOrientationSelector() {
    const orientationOptions = document.querySelectorAll('.sportive-orientation-option');
    orientationOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        const orientation = e.currentTarget.dataset.orientation;
        this.selectOrientation(orientation);
      });
    });
  }

  selectSize(size) {
    // Update UI
    document.querySelectorAll('.sportive-size-option').forEach(opt => {
      opt.classList.remove('selected');
    });
    document.querySelector(`[data-size="${size}"]`)?.classList.add('selected');

    // Update selection
    this.currentSelections.size = size;

    // Update Shopify variant
    this.updateShopifyVariant();
  }

  selectStyle(style) {
    // Update UI
    document.querySelectorAll('.sportive-style-swatch').forEach(swatch => {
      swatch.classList.remove('selected');
    });
    document.querySelector(`[data-style="${style}"]`)?.classList.add('selected');

    // Update selection
    this.currentSelections.style = style;

    // Update product image
    this.updateProductImage(style);

    // Update Shopify variant
    this.updateShopifyVariant();
  }

  selectOrientation(orientation) {
    // Update UI
    document.querySelectorAll('.sportive-orientation-option').forEach(opt => {
      opt.classList.remove('selected');
    });
    document.querySelector(`[data-orientation="${orientation}"]`)?.classList.add('selected');

    // Update selection
    this.currentSelections.orientation = orientation;

    // Update product image
    this.updateProductImage(null, orientation);

    // Update Shopify variant
    this.updateShopifyVariant();
  }

  updateShopifyVariant() {
    // Get all selections
    const { size, style, orientation } = this.currentSelections;

    // If all selections are made, find matching variant
    if (size && style && orientation) {
      const variantName = `${size} / ${style} / ${orientation}`;

      // Find variant option that matches
      const variantSelect = document.querySelector('select[name="id"]');
      if (variantSelect) {
        const options = Array.from(variantSelect.options);
        const matchingOption = options.find(opt =>
          opt.text.includes(size) &&
          opt.text.includes(style) &&
          opt.text.includes(orientation)
        );

        if (matchingOption) {
          variantSelect.value = matchingOption.value;
          // Trigger change event to update Shopify's internal state
          variantSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // Also check for radio button variant pickers
      const variantRadios = document.querySelectorAll('input[name="id"]');
      variantRadios.forEach(radio => {
        const label = document.querySelector(`label[for="${radio.id}"]`);
        if (label && label.textContent.includes(size) &&
            label.textContent.includes(style) &&
            label.textContent.includes(orientation)) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }
  }

  updateProductImage(style = null, orientation = null) {
    // Use current selections if not specified
    style = style || this.currentSelections.style;
    orientation = orientation || this.currentSelections.orientation;

    if (!style && !orientation) return;

    // Find image that matches style and orientation
    const productImages = document.querySelectorAll('.product__media img');
    productImages.forEach(img => {
      const alt = img.alt.toLowerCase();
      const matchesStyle = !style || alt.includes(style.toLowerCase());
      const matchesOrientation = !orientation || alt.includes(orientation.toLowerCase());

      if (matchesStyle && matchesOrientation) {
        // Click on the thumbnail or update main image
        const thumbnail = img.closest('.product__media-item');
        if (thumbnail) {
          thumbnail.click();
        }
      }
    });
  }

  setInitialSelections() {
    // Get current variant from URL or page
    const urlParams = new URLSearchParams(window.location.search);
    const variantId = urlParams.get('variant');

    if (variantId) {
      // Try to parse variant from selected option
      const selectedVariant = document.querySelector(`option[value="${variantId}"]`);
      if (selectedVariant) {
        this.parseVariantString(selectedVariant.text);
      }
    } else {
      // Select defaults
      const firstSize = document.querySelector('.sportive-size-option');
      const firstStyle = document.querySelector('.sportive-style-swatch');
      const firstOrientation = document.querySelector('.sportive-orientation-option');

      if (firstSize) this.selectSize(firstSize.dataset.size);
      if (firstStyle) this.selectStyle(firstStyle.dataset.style);
      if (firstOrientation) this.selectOrientation(firstOrientation.dataset.orientation);
    }
  }

  parseVariantString(variantString) {
    // Parse variant string like "A4 / Classic Blue / Portrait"
    const parts = variantString.split('/').map(s => s.trim());

    if (parts.length >= 3) {
      const [size, style, orientation] = parts;

      if (size) this.selectSize(size);
      if (style) this.selectStyle(style);
      if (orientation) this.selectOrientation(orientation);
    }
  }

  watchStandardVariantPicker() {
    // Listen to Shopify's variant picker changes
    const variantInputs = document.querySelectorAll('input[name="id"], select[name="id"]');
    variantInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const selectedOption = e.target.selectedOptions?.[0] ||
                              document.querySelector(`label[for="${e.target.id}"]`);

        if (selectedOption) {
          const text = selectedOption.textContent || selectedOption.text;
          this.parseVariantString(text);
        }
      });
    });
  }

  // Utility: Get current variant ID
  getCurrentVariantId() {
    const variantSelect = document.querySelector('select[name="id"]');
    if (variantSelect) {
      return variantSelect.value;
    }

    const checkedRadio = document.querySelector('input[name="id"]:checked');
    if (checkedRadio) {
      return checkedRadio.value;
    }

    return null;
  }

  // Utility: Get variant data
  getVariantData(variantId) {
    // Access Shopify's product JSON if available
    if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta) {
      const productData = window.ShopifyAnalytics.meta.product;
      if (productData && productData.variants) {
        return productData.variants.find(v => v.id == variantId);
      }
    }
    return null;
  }
}

// Initialize when script loads
if (typeof window !== 'undefined') {
  window.sportiveVariantSelector = new SportiveVariantSelector();
}

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SportiveVariantSelector;
}
