import express from "express";
import db from "../models/index.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const sql = `
        select * from mv_datasets_filter;
    `;
    const results = await db.sequelize.query(sql, {
      type: db.sequelize.QueryTypes.SELECT,
    });
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
