import express from "express";
import db from "../models/index.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const {
      startDate = "2026-02-01",
      endDate = "2026-02-28",
      page = 1,
      limit = 1000,
    } = req.query;

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const offset = (parsedPage - 1) * parsedLimit;

    const countSql = `
      select count(*) as total from vw_invoice_productmap
      where billing_date between :startDate and :endDate;
    `;
    const countResult = await db.sequelize.query(countSql, {
      replacements: { startDate, endDate },
      type: db.sequelize.QueryTypes.SELECT,
    });
    const total = parseInt(countResult[0].total);

    const sql = `
      select * from vw_invoice_productmap
      where billing_date between :startDate and :endDate
      limit :limit offset :offset;
    `;
    const results = await db.sequelize.query(sql, {
      replacements: { startDate, endDate, limit: parsedLimit, offset },
      type: db.sequelize.QueryTypes.SELECT,
    });

    res.json({
      success: true,
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit),
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching data",
      error: error.message,
    });
  }
});

export default router;
