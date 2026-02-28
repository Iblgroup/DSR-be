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
import rdSales from './routes.rd.sales.js';
import filters from './routes.filters.js';

const router = express.Router();

//Mount routers
router.use('/per-day-sales', perDaySales);
router.use('/sales-summary', salesSummary);
router.use('/sales-growth-national', salesGrowthNational);
router.use('/sales-branch-wise', salesBranchWise);
router.use('/sales-achievements', salesAcievemnt);
router.use('/rd-sales', rdSales);
router.use('/daily-sales-avg', perDaySalesAvg);
router.use('/product-inventory', productInventory);
router.use('/mtd-sales-detail', mtdSalesDetail);
router.use('/filters', filters);
router.use('/product-data', productRouter);

export default router;
