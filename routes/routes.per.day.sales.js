import express from "express";
import db from "../models/index.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { startDate = "2025-07-01", endDate = "2025-11-30" } = req.query;

    const sql = `
      SELECT
          billing_date,
          SUM(gross_amount)  AS CMV
      FROM vw_invoice_productmap
      WHERE  
          billing_date >= DATE_TRUNC('month', CURRENT_DATE)
          AND billing_date <= CURRENT_DATE
      GROUP BY
          billing_date
      ORDER BY
          billing_date;
    `;

    const results = await db.sequelize.query(sql, {
      replacements: { startDate, endDate },
      type: db.sequelize.QueryTypes.SELECT,
    });
    console.log(`Fetched ${results.length} records from vw_invoice_productmap`);
    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching data",
      error: error.message,
    });
  }
});

export default router;

