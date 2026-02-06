const express = require('express');
const router = express.Router();
const Product = require('../Models/product');
const { extractSearchIntent } = require('../services/aiService');

/**
 * AI-Powered Search Endpoint
 * POST /users/post/ai-search
 * Body: { query: "user search string" }
 */
router.post('/ai-search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || query.trim() === '') {
      return res.status(400).json({ 
        msg: 'error', 
        error: 'Search query is required' 
      });
    }

    console.log('🔍 AI Search Query:', query);

    // Use AI to extract search intent
    const searchIntent = await extractSearchIntent(query);
    console.log('🤖 Extracted Intent:', searchIntent);

    // Build MongoDB query based on AI extracted intent
    const mongoQuery = {
      $and: [
        {
          $or: [
            { title: { $regex: searchIntent.intent, $options: 'i' } },
            { description: { $regex: searchIntent.intent, $options: 'i' } },
            // Also search for individual keywords
            ...searchIntent.keywords.map(keyword => ({
              $or: [
                { title: { $regex: keyword, $options: 'i' } },
                { description: { $regex: keyword, $options: 'i' } }
              ]
            }))
          ]
        }
      ]
    };

    // Add category filter if AI detected it
    if (searchIntent.category) {
      mongoQuery.$and.push({
        category: { $regex: searchIntent.category, $options: 'i' }
      });
    }

    // Add price filter if AI detected price context
    if (searchIntent.priceContext) {
      const avgPrice = await Product.aggregate([
        { $group: { _id: null, avgPrice: { $avg: '$price' } } }
      ]);

      const average = avgPrice[0]?.avgPrice || 30000;

      if (searchIntent.priceContext === 'budget' || searchIntent.priceContext === 'low') {
        mongoQuery.$and.push({ price: { $lte: average * 0.7 } });
      } else if (searchIntent.priceContext === 'premium' || searchIntent.priceContext === 'high') {
        mongoQuery.$and.push({ price: { $gte: average * 1.3 } });
      }
    }

    console.log('📊 MongoDB Query:', JSON.stringify(mongoQuery, null, 2));

    // Execute search
    const products = await Product.find(mongoQuery).limit(20);

    res.status(200).json({
      msg: 'success',
      count: products.length,
      searchIntent: searchIntent,
      products: products
    });

  } catch (error) {
    console.error('❌ AI Search Error:', error.message);
    res.status(500).json({ 
      msg: 'error', 
      error: error.message 
    });
  }
});

module.exports = router;
