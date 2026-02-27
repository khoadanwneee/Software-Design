import * as productService from '../services/product.service.js';

export const getHome = async (req, res) => {
  try {
    const [topEnding, topBids, topPrice] = await Promise.all([
      productService.getTopEnding(),
      productService.getTopBids(),
      productService.getTopPrice()
    ]);
    res.render('home', { 
      topEndingProducts: topEnding, 
      topBidsProducts: topBids, 
      topPriceProducts: topPrice 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
};
