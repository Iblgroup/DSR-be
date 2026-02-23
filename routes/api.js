import express from 'express';
import perDaySalesAvg from './routes.day.sales.avg.js';
import productInventory from './routes.inventory.details.js';
import mtdSalesDetail from './routes.mtd.sales.detail.js';
import perDaySales from './routes.per.day.sales.js';
import productRouter from './routes.product.js';
import salesAcievemnt from './routes.sales.achievements.js';
import salesBranchWise from './routes.sales.branch.wise.js';
import salesGrowthNational from './routes.sales.growth.national.js';
import salesSummary from './routes.sales.summary.js';


const router = express.Router();

//Mount routers
router.use('/product-data', productRouter);
router.use('/daily-sales-avg', perDaySalesAvg);
router.use('/mtd-sales-detail', mtdSalesDetail);
router.use('/sales-summary', salesSummary);
router.use('/per-day-sales', perDaySales);
router.use('/sales-growth-national', salesGrowthNational);
router.use('/product-inventory', productInventory);
router.use('/sales-branch-wise', salesBranchWise);
router.use('/sales-achievements', salesAcievemnt);

export default router;
