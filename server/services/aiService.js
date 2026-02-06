const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize the Gemini model
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

/**
 * Extract search intent using AI
 * Converts user query into structured search parameters
 */
async function extractSearchIntent(query) {
  try {
    const prompt = `
    Analyze this product search query and extract structured information:
    Query: "${query}"
    
    Return ONLY a valid JSON object (no markdown, no extra text) with these fields:
    {
      "keywords": ["list", "of", "search", "terms"],
      "category": "category name or null",
      "priceContext": "low/medium/high/budget/premium or null",
      "condition": "new/used/refurbished or null",
      "intent": "brief description of what user wants"
    }
    
    Example response format:
    {"keywords":["cheap","phone"],"category":"Electronics","priceContext":"budget","condition":null,"intent":"Looking for affordable smartphones"}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse the JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from AI');
    }
    
    const parsedIntent = JSON.parse(jsonMatch[0]);
    return parsedIntent;
  } catch (error) {
    console.error('Error extracting search intent:', error);
    // Return basic search params if AI fails
    return {
      keywords: query.split(' '),
      category: null,
      priceContext: null,
      condition: null,
      intent: query
    };
  }
}

/**
 * Suggest optimal price for a product
 * Uses market data and product info to recommend price
 */
async function suggestPrice(productInfo, similarProducts) {
  try {
    console.log('\n🔄 suggestPrice() called');
    console.log('Product:', productInfo);
    console.log('Similar Products Count:', similarProducts.length);
    
    const prompt = `
    Analyze this product and suggest an optimal selling price based on market data.
    
    Product Information:
    - Title: "${productInfo.title}"
    - Category: "${productInfo.category}"
    - Condition: "${productInfo.condition}"
    - Description: "${productInfo.description}"
    
    Similar Products Sold Recently:
    ${similarProducts.map((p, i) => `${i + 1}. "${p.title}" - Price: ₹${p.price}, Condition: ${p.condition}, Sold: ${p.sold}`).join('\n')}
    
    Return ONLY a valid JSON object (no markdown, no extra text) with:
    {
      "suggestedPrice": <number>,
      "minPrice": <number>,
      "maxPrice": <number>,
      "reasoning": "brief explanation",
      "confidence": "high/medium/low"
    }
    
    Example:
    {"suggestedPrice":45000,"minPrice":42000,"maxPrice":48000,"reasoning":"Based on 3 recently sold items with similar condition","confidence":"high"}
    `;

    console.log('📤 Sending to Gemini API...');
    const result = await model.generateContent(prompt);
    console.log('✅ Gemini responded');
    
    const responseText = result.response.text();
    console.log('Response text:', responseText);
    
    // Parse the JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from AI: ' + responseText);
    }
    
    const priceSuggestion = JSON.parse(jsonMatch[0]);
    console.log('✅ Parsed suggestion:', priceSuggestion);
    return priceSuggestion;
  } catch (error) {
    console.error('❌ Error in suggestPrice:', error.message);
    console.error('Full error:', error);
    // Return default if AI fails
    if (similarProducts.length > 0) {
      const avgPrice = Math.round(
        similarProducts.reduce((sum, p) => sum + p.price, 0) / similarProducts.length
      );
      return {
        suggestedPrice: avgPrice,
        minPrice: Math.round(avgPrice * 0.9),
        maxPrice: Math.round(avgPrice * 1.1),
        reasoning: 'Based on average of similar products (AI call failed)',
        confidence: 'medium'
      };
    }
    return null;
  }
}

/**
 * Enhance product description using AI
 * Improves title and description for better discoverability
 */
async function enhanceProductDetails(title, description) {
  try {
    const prompt = `
    Improve this product listing for better discoverability:
    Title: "${title}"
    Description: "${description}"
    
    Return ONLY a valid JSON object (no markdown) with:
    {
      "improvedTitle": "better title",
      "improvedDescription": "enhanced description",
      "suggestedKeywords": ["keyword1", "keyword2"]
    }
    
    Keep it concise and SEO-friendly.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from AI');
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error enhancing product details:', error);
    return {
      improvedTitle: title,
      improvedDescription: description,
      suggestedKeywords: title.split(' ')
    };
  }
}

module.exports = {
  extractSearchIntent,
  suggestPrice,
  enhanceProductDetails
};
