import express from "express";
import db from "../models/index.js";

const router = express.Router();

const ALLOWED_FILTERS = {
  AD:                 'ad',
  Team_Desc:          'team_desc',
  BU_Desc:            'bu_desc',
  Ctg:                'ctg',
  grp_brand:          'grp_brand',
  branch_description: 'branch_description',
  channel:            'channel',
  data_flag:          'data_flag',
  prod_nm:            'prod_nm',
};

router.get("/", async (req, res) => {
  try {
    const { displayMode = "TP", ...filters } = req.query;

    const filterClauses = [];
    const replacements = {};
    for (const [key, value] of Object.entries(filters)) {
      if (ALLOWED_FILTERS[key] && value) {
        filterClauses.push(`AND ${ALLOWED_FILTERS[key]} = :${key}`);
        replacements[key] = value;
      }
    }
    const filterSQL = filterClauses.length > 0 ? filterClauses.join("\n          ") : "";

    const isEfp = displayMode === "EFP";

    const metricCols = isEfp
      ? `SUM(gross_amount)       AS CMV`
      : `SUM(gross_amount)       AS CMV,
          SUM(efp * sold_qty)    AS RD_CMS_EFP,
          SUM(sold_qty)          AS RD_CMU`;

    const sql = `
      SELECT
          billing_date,
          ${metricCols}
      FROM vw_invoice_productmap
      WHERE billing_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND billing_date <= CURRENT_DATE
        ${filterSQL}
      GROUP BY billing_date
      ORDER BY billing_date
    `;

    const results = await db.sequelize.query(sql, {
      replacements,
      type: db.sequelize.QueryTypes.SELECT,
    });

    console.log(`Fetched ${results.length} records from vw_invoice_productmap`);
    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error("Error fetching per day sales:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching data",
      error: error.message,
    });
  }
});

export default router;
