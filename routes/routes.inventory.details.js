import express from "express";
import db from "../models/index.js";

const router = express.Router();

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
  region_desc:        't02.region_desc',
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
        SELECT DISTINCT sap_mapping_code
        FROM vw_invoice_productmap
        WHERE billing_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND billing_date <= CURRENT_DATE
        ${filterSQL}
    ),
    stock AS (
        SELECT ibl_item_code, SUM(stock_qty) AS stock_qty_MTD,distributor_item_description
        FROM vw_primary_secondary_stock
        WHERE dated >= DATE_TRUNC('month', CURRENT_DATE)
        AND dated <= CURRENT_DATE
        GROUP BY ibl_item_code,distributor_item_description
    )
    SELECT
        s.distributor_item_description,
        COALESCE(s.stock_qty_MTD, 0) AS stock_qty_MTD
    FROM products p
    LEFT JOIN stock s ON s.ibl_item_code::text = p.sap_mapping_code::text;
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
          SELECT ibl_item_code, SUM(stock_qty) AS TotalInvQty , distributor_item_description
          FROM vw_primary_secondary_stock
          WHERE dated >= DATE_TRUNC('month', CURRENT_DATE)
          AND dated <= CURRENT_DATE
          GROUP BY ibl_item_code , distributor_item_description
      ),
      sales AS (
          SELECT sap_mapping_code,
          SUM(sold_qty) AS RD_CMU
          FROM vw_invoice_productmap t02
          WHERE billing_date >= DATE_TRUNC('month', CURRENT_DATE)
          AND billing_date <= CURRENT_DATE   
          ${filterSQL}
          GROUP BY sap_mapping_code
      ),
      targets AS (
          SELECT material_code, SUM(target_qty) AS TrgUnit
          FROM vw_tscl_sap_targets
          WHERE target_date = DATE_TRUNC('month', CURRENT_DATE)::date
          GROUP BY material_code
      )
      SELECT
          st.distributor_item_description,
          COALESCE(st.TotalInvQty, 0) - (COALESCE(t.TrgUnit, 0) - COALESCE(s.RD_CMU, 0)) AS ReqInv
      FROM sales s
      LEFT JOIN stock st ON st.ibl_item_code::text = s.sap_mapping_code::text
      LEFT JOIN targets t ON t.material_code::text = s.sap_mapping_code::text;
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

router.get("/vs-target", async (req, res) => {
  try {
    const { filterSQL, replacements } = buildFilterSQL(req.query);

    const sql = `
      WITH stock AS (
          SELECT ibl_item_code,
          SUM(stock_qty)   AS TotalInvQty,
          SUM(stock_value) AS TotalInvVal
          FROM vw_primary_secondary_stock
          WHERE dated >= DATE_TRUNC('month', CURRENT_DATE)
          AND dated <= CURRENT_DATE
          GROUP BY ibl_item_code
      ),
      targets AS (
          SELECT material_code,
          SUM(target_qty)   AS TrgUnit,
          SUM(target_value) AS TrgVal
          FROM vw_tscl_sap_targets
          WHERE target_date = DATE_TRUNC('month', CURRENT_DATE)::date
          GROUP BY material_code
      ),
      sales AS (
          SELECT sap_code, "AD", "BU_Desc", "Team_Desc", sap_item_dessc,
          SUM(gross_amount) AS RD_CMS_TP,
          SUM(sold_qty)     AS RD_CMU
          FROM vw_invoice_productmap
          WHERE billing_date >= DATE_TRUNC('month', CURRENT_DATE)
          AND billing_date <= CURRENT_DATE
          GROUP BY sap_code, "AD", "BU_Desc", "Team_Desc", sap_item_dessc
      )
      SELECT
          s."AD",
          s."BU_Desc",
          s."Team_Desc",
          s.sap_item_dessc,
          COALESCE(st.TotalInvQty, 0)                                                                         AS TotalInvQty,
          COALESCE(st.TotalInvVal, 0)                                                                         AS TotalInvVal,
          COALESCE(s.RD_CMS_TP, 0)                                                                            AS RD_CMS_TP,
          COALESCE(s.RD_CMU, 0)                                                                               AS RD_CMU,
          COALESCE(t.TrgUnit, 0)                                                                              AS TrgUnit,
          COALESCE(t.TrgVal, 0)                                                                               AS TrgVal,
          ROUND(COALESCE(st.TotalInvQty, 0)::numeric / NULLIF(t.TrgUnit, 0)::numeric * EXTRACT(DAY FROM DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'), 1) AS Cover_Days,
          ROUND(COALESCE(st.TotalInvQty, 0)::numeric / NULLIF(t.TrgUnit, 0)::numeric, 2)                     AS Cover_Months
      FROM sales s
      LEFT JOIN stock st   ON st.ibl_item_code::text  = s.sap_code::text
      LEFT JOIN targets t  ON t.material_code::text   = s.sap_code::text
      ORDER BY s."AD", s."BU_Desc", s."Team_Desc", s.sap_item_dessc;
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

router.get("/branch-wise", async (req, res) => {
  try {
    const { filterSQL, replacements } = buildFilterSQL(req.query);
    const sql = `
     WITH stock AS (
    SELECT ibl_item_code, distributor_desc,
    SUM(stock_qty)   AS TotalInvQty,
    SUM(stock_value) AS TotalInvVal
    FROM vw_primary_secondary_stock
    WHERE dated >= DATE_TRUNC('month', CURRENT_DATE)
    AND dated <= CURRENT_DATE
    GROUP BY ibl_item_code, distributor_desc
),
sales AS (
    SELECT sap_code, "AD", "BU_Desc", "Team_Desc", sap_item_dessc
    FROM vw_invoice_productmap
    WHERE billing_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND billing_date <= CURRENT_DATE
    GROUP BY sap_code, "AD", "BU_Desc", "Team_Desc", sap_item_dessc
)
SELECT
    s."AD",
    s."BU_Desc",
    s."Team_Desc",
    s.sap_item_dessc,
    st.distributor_desc,
    COALESCE(st.TotalInvQty, 0) AS TotalInvQty,
    COALESCE(st.TotalInvVal, 0) AS TotalInvVal
FROM sales s
LEFT JOIN stock st ON st.ibl_item_code::text = s.sap_code::text
ORDER BY s."AD", s."BU_Desc", s."Team_Desc", s.sap_item_dessc, st.distributor_desc;
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
