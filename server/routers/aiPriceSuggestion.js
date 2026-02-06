const express = require('express');
const router = express.Router();
const Product = require('../Models/product');
const { suggestPrice, enhanceProductDetails } = require('../services/aiService');

/**
 * Get Price Suggestion
 * POST /users/post/ai-price-suggestion
 * Body: { title, category, condition, description }
 */
router.post('/ai-price-suggestion', async (req, res) => {
  try {
    const { title, category, condition, description } = req.body;

    console.log('\n🚀 AI Price Suggestion Request received');
    console.log('Body:', { title, category, condition, description });

    if (!title) {
      return res.status(400).json({ 
        msg: 'error', 
        error: 'Product title is required' 
      });
    }

    console.log('💰 Price Suggestion Request:', { title, category, condition });
    console.log('🔑 API Key available:', !!process.env.GEMINI_API_KEY);

    // Find similar products in the database
    const similarProducts = await Product.find({
      $or: [
        { title: { $regex: title.split(' ')[0], $options: 'i' } },
        { category: { $regex: category, $options: 'i' } }
      ],
      sold: true // Only consider sold products for accurate pricing
    })
      .select('title price condition sold')
      .limit(10)
      .lean();

    console.log(`📊 Found ${similarProducts.length} similar sold products`);

    // If we found similar products, get AI price suggestion
    let priceSuggestion = null;
    if (similarProducts.length > 0) {
      console.log('🤖 Calling suggestPrice with AI...');
      priceSuggestion = await suggestPrice(
        { title, category, condition, description },
        similarProducts
      );
      console.log('✅ AI Price Suggestion:', priceSuggestion);
    } else {
      console.log('⚠️ No similar products found, using category average...');
      // Fallback: Use average price from any products in category
      const allProducts = await Product.find({ category })
        .select('price')
        .lean();

      if (allProducts.length > 0) {
        const avgPrice = Math.round(
          allProducts.reduce((sum, p) => sum + p.price, 0) / allProducts.length
        );
        priceSuggestion = {
          suggestedPrice: avgPrice,
          minPrice: Math.round(avgPrice * 0.85),
          maxPrice: Math.round(avgPrice * 1.15),
          reasoning: 'Based on category average (limited similar products)',
          confidence: 'medium'
        };
      }
    }

    // Enhance product details
    console.log('✨ Calling enhanceProductDetails...');
    const enhancedDetails = await enhanceProductDetails(title, description);
    console.log('✨ Enhanced Details:', enhancedDetails);

    res.status(200).json({
      msg: 'success',
      priceSuggestion: priceSuggestion,
      enhancedDetails: enhancedDetails,
      similarProductsCount: similarProducts.length
    });

  } catch (error) {
    console.error('❌ Price Suggestion Error:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      msg: 'error', 
      error: error.message,
      details: error.stack
    });
  }
});

module.exports = router;
