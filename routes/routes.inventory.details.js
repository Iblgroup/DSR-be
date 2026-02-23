import express from "express";
import db from "../models/index.js";

const router = express.Router();

const ALLOWED_FILTERS = {
  AD:                 '"AD"',
  BU_Desc:            '"BU_Desc"',
  Team_Desc:          '"Team_Desc"',
  grp_brand:          'grp_brand',
  prod_nm:            'prod_nm',
  data_flag:          'data_flag',
  channel:            'channel',
  branch_description: 'branch_description',
};

function buildFilterSQL(query) {
  const clauses = [];
  const replacements = {};
  for (const [key, value] of Object.entries(query)) {
    if (ALLOWED_FILTERS[key] && value) {
      clauses.push(`AND t02.${ALLOWED_FILTERS[key]} = :${key}`);
      replacements[key] = value;
    }
  }
  return { filterSQL: clauses.join("\n    "), replacements };
}

router.get("/available", async (req, res) => {
  try {
    const { filterSQL, replacements } = buildFilterSQL(req.query);

    const sql = `
      WITH products AS (
          SELECT DISTINCT sap_mapping_code, prod_nm
          FROM vw_invoice_productmap
          WHERE billing_date >= DATE_TRUNC('month', CURRENT_DATE)
          AND billing_date <= CURRENT_DATE
          ${filterSQL}
      ),
      stock AS (
          SELECT ibl_item_code, SUM(stock_qty) AS stock_qty_MTD
          FROM vw_primary_secondary_stock
          WHERE dated >= DATE_TRUNC('month', CURRENT_DATE)
          AND dated <= CURRENT_DATE
          GROUP BY ibl_item_code
      )
      SELECT
          p.prod_nm,
          COALESCE(s.stock_qty_MTD, 0) AS stock_qty_MTD
      FROM products p
      LEFT JOIN stock s ON s.ibl_item_code::text = p.sap_mapping_code::text
      ORDER BY p.prod_nm;
    `;

    const results = await db.sequelize.query(sql, {
      replacements,
      type: db.sequelize.QueryTypes.SELECT,
    });
    console.log(`Fetched ${results.length} records from vw_primary_secondary_stock (available)`);
    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error("Error fetching available inventory:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching data",
      error: error.message,
    });
  }
});

router.get("/required", async (req, res) => {
  try {
    const { filterSQL, replacements } = buildFilterSQL(req.query);

    const sql = `
WITH stock AS (
    SELECT ibl_item_code, SUM(stock_qty) AS TotalInvQty
    FROM vw_primary_secondary_stock
    WHERE dated >= DATE_TRUNC('month', CURRENT_DATE)
    AND dated <= CURRENT_DATE
    GROUP BY ibl_item_code
),
sales AS (
    SELECT sap_mapping_code, prod_nm,
    SUM(sold_qty) AS RD_CMU
    FROM vw_invoice_productmap t02
    WHERE billing_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND billing_date <= CURRENT_DATE
    ${filterSQL}
    GROUP BY sap_mapping_code, prod_nm
),
targets AS (
    SELECT material_code, SUM(target_qty) AS TrgUnit
    FROM vw_tscl_sap_targets
    WHERE target_date = DATE_TRUNC('month', CURRENT_DATE)::date
    GROUP BY material_code
)
SELECT
    s.prod_nm,
    COALESCE(st.TotalInvQty, 0) - (COALESCE(t.TrgUnit, 0) - COALESCE(s.RD_CMU, 0)) AS ReqInv
FROM sales s
LEFT JOIN stock st ON st.ibl_item_code::text = s.sap_mapping_code::text
LEFT JOIN targets t ON t.material_code::text = s.sap_mapping_code::text
ORDER BY s.prod_nm;
    `;
    const results = await db.sequelize.query(sql, {
      replacements,
      type: db.sequelize.QueryTypes.SELECT,
    });
    console.log(`Fetched ${results.length} records from vw_invoice_productmap (required)`);
    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error("Error fetching required inventory:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching data",
      error: error.message,
    });
  }
});

export default router;
