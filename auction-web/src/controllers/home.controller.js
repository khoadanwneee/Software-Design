import * as productModel from '../models/product.model.js';

export const getHome = async (req, res) => {
  try {
    const [topEnding, topBids, topPrice] = await Promise.all([
      productModel.findTopEnding(),
      productModel.findTopBids(),
      productModel.findTopPrice()
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
