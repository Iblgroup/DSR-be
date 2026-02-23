import express from "express";
import db from "../models/index.js";

const router = express.Router();

const ALLOWED_GROUP_BY = {
  Ctg: '"Ctg"',
  AD: '"AD"',
  Team_Desc: '"Team_Desc"',
  BU_Desc: '"BU_Desc"',
  grp_brand: 'grp_brand',
  branch_description: 'branch_description',
  channel: 'channel',
  data_flag: 'data_flag',
  prod_nm: 'prod_nm',
};

const ALLOWED_FILTERS = {
  AD:                 't01."AD"',
  Team_Desc:          't01."Team_Desc"',
  BU_Desc:            't01."BU_Desc"',
  Ctg:                't01."Ctg"',
  grp_brand:          't01.grp_brand',
  branch_description: 't01.branch_description',
  channel:            't01.channel',
  data_flag:          't01.data_flag',
  prod_nm:            't01.prod_nm',
};

router.get("/detail", async (req, res) => {
  try {
    const { groupBy = "Ctg", ...filters } = req.query;

    const groupByKeys = groupBy.split(",").map((k) => k.trim());

    const invalidKeys = groupByKeys.filter((k) => !ALLOWED_GROUP_BY[k]);
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid groupBy value(s): ${invalidKeys.join(", ")}. Allowed: ${Object.keys(ALLOWED_GROUP_BY).join(", ")}`,
      });
    }

    const selectCols = groupByKeys
      .map((k) => `${ALLOWED_GROUP_BY[k]} AS "${k}"`)
      .join(",\n        ");

    // Build GROUP BY clause
    const groupByClause = groupByKeys
      .map((k) => ALLOWED_GROUP_BY[k])
      .join(", ");

    // Build dynamic filter clauses from query params
    const filterClauses = [];
    const replacements = {};
    for (const [key, value] of Object.entries(filters)) {
      if (ALLOWED_FILTERS[key] && value) {
        filterClauses.push(`AND ${ALLOWED_FILTERS[key]} = :${key}`);
        replacements[key] = value;
      }
    }
    const filterSQL = filterClauses.length > 0 ? filterClauses.join("\n") : "";

    const sql = `
      WITH stock AS (
    SELECT ibl_item_code, distributor_desc,
    SUM(stock_qty) AS TotalInvQty
    FROM vw_primary_secondary_stock
    WHERE dated >= DATE_TRUNC('month', CURRENT_DATE)
    AND dated <= CURRENT_DATE
    GROUP BY ibl_item_code, distributor_desc
),
sales AS (
    SELECT sap_code,
    SUM(CASE WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND billing_date <= CURRENT_DATE THEN gross_amount ELSE 0 END) AS RD_CMS_TP,
    SUM(CASE WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND billing_date <= (CURRENT_DATE - INTERVAL '1 month') THEN gross_amount ELSE 0 END) AS RD_LMS_TP
    FROM vw_invoice_productmap
    WHERE billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    AND billing_date <= CURRENT_DATE
    GROUP BY sap_code
)
SELECT
    st.distributor_desc,
    SUM(COALESCE(s.RD_CMS_TP, 0))                                                                                                                                  AS RD_CMS_TP,
    SUM(COALESCE(s.RD_LMS_TP, 0))                                                                                                                                  AS RD_LMS_TP
--    ROUND((SUM(COALESCE(s.RD_CMS_TP, 0))::numeric - SUM(COALESCE(s.RD_LMS_TP, 0))::numeric) / NULLIF(SUM(COALESCE(s.RD_LMS_TP, 0))::numeric, 0) * 100, 1)        AS "RD_TP_Val%"
FROM stock st
LEFT JOIN sales s ON s.sap_code::text = st.ibl_item_code::text
GROUP BY st.distributor_desc
ORDER BY st.distributor_desc;
    `;

    const results = await db.sequelize.query(sql, {
      type: db.sequelize.QueryTypes.SELECT,
      replacements,
    });

    res.json({ success: true, groupBy: groupByKeys, count: results.length, data: results });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching data",
      error: error.message,
    });
  }
});

router.get("/growth", async (req, res) => {
  try {
    const sql = `
WITH stock AS (
    SELECT ibl_item_code, distributor_desc,
    SUM(stock_qty) AS TotalInvQty
    FROM vw_primary_secondary_stock
    WHERE dated >= DATE_TRUNC('month', CURRENT_DATE)
    AND dated <= CURRENT_DATE
    GROUP BY ibl_item_code, distributor_desc
),
sales AS (
    SELECT sap_code,
    SUM(CASE WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND billing_date <= CURRENT_DATE THEN gross_amount ELSE 0 END) AS RD_CMS_TP,
    SUM(CASE WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND billing_date <= (CURRENT_DATE - INTERVAL '1 month') THEN gross_amount ELSE 0 END) AS RD_LMS_TP
    FROM vw_invoice_productmap
    WHERE billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    AND billing_date <= CURRENT_DATE
    GROUP BY sap_code
)
SELECT
    st.distributor_desc,
--    SUM(COALESCE(s.RD_CMS_TP, 0)) AS RD_CMS_TP,
--    SUM(COALESCE(s.RD_LMS_TP, 0)) AS RD_LMS_TP,
    ROUND((SUM(COALESCE(s.RD_CMS_TP, 0))::numeric - SUM(COALESCE(s.RD_LMS_TP, 0))::numeric) / NULLIF(SUM(COALESCE(s.RD_LMS_TP, 0))::numeric, 0) * 100, 1) AS "RD_TP_Val%"
FROM stock st
LEFT JOIN sales s ON s.sap_code::text = st.ibl_item_code::text
GROUP BY st.distributor_desc
ORDER BY st.distributor_desc;
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
