import express from "express";
import db from "../models/index.js";

const router = express.Router();

const ALLOWED_GROUP_BY = {
  ad:               'ad',
  bu_desc:          'bu_desc',
  team_desc:        'team_desc',
  ctg:              'ctg',
  grp_brand:        'grp_brand',
  item_description: 'item_description',
};

const ALLOWED_FILTERS = {
  AD:                 'ad',
  Team_Desc:          'team_desc',
  BU_Desc:            'bu_desc',
  Ctg:                'ctg',
  grp_brand:          'grp_brand',
  branch_description: 'branch_description',
  channel:            'channel',
  data_flag:          'data_flag',
  prod_nm:            'item_description',
};

router.get("/", async (req, res) => {
  try {
    const { groupBy = "ctg", ...filters } = req.query;

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
      .join(",\n          ");

    const groupByClause = groupByKeys
      .map((k) => ALLOWED_GROUP_BY[k])
      .join(", ");

    const filterClauses = [];
    const replacements = {};
    for (const [key, value] of Object.entries(filters)) {
      if (ALLOWED_FILTERS[key] && value) {
        filterClauses.push(`AND ${ALLOWED_FILTERS[key]} = :${key}`);
        replacements[key] = value;
      }
    }
    const filterSQL = filterClauses.length > 0 ? filterClauses.join("\n          ") : "";

    const sql = `
      WITH targets AS (
        SELECT material_code,
               SUM(target_value) AS TrgVal
        FROM vw_tscl_sap_targets
        WHERE target_date = DATE_TRUNC('month', CURRENT_DATE)::date
        GROUP BY material_code
      ),
      sales AS (
        SELECT sap_code,
               ${selectCols},
               SUM(efp * sold_qty) AS RD_CMS_EFP
        FROM vw_invoice_productmap
        WHERE billing_date >= DATE_TRUNC('month', CURRENT_DATE)
          AND billing_date <= CURRENT_DATE
          AND ad IS NOT NULL
          AND ad <> ''
          ${filterSQL}
        GROUP BY sap_code, ${groupByClause}
      )
      SELECT
        ${groupByClause},
        SUM(s.RD_CMS_EFP)                                                                              AS RD_CMS_EFP,
        SUM(COALESCE(t.TrgVal, 0))                                                                     AS TrgVal,
        ROUND(SUM(s.RD_CMS_EFP)::numeric / NULLIF(SUM(COALESCE(t.TrgVal, 0))::numeric, 0) * 100, 1)   AS "SalAch%"
      FROM sales s
      LEFT JOIN targets t ON t.material_code::text = s.sap_code::text
      GROUP BY ${groupByClause}
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

router.get("/total", async (req, res) => {
  try {
    const { ...filters } = req.query;

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
      WITH targets AS (
        SELECT material_code,
               SUM(target_qty)   AS TrgUnit,
               SUM(target_value) AS TrgVal
        FROM vw_tscl_sap_targets
        WHERE target_date = DATE_TRUNC('month', CURRENT_DATE)::date
        GROUP BY material_code
      ),
      sales AS (
        SELECT sap_code,
               SUM(sold_qty)       AS RD_CMU,
               SUM(efp * sold_qty) AS RD_CMS_EFP
        FROM vw_invoice_productmap
        WHERE billing_date >= DATE_TRUNC('month', CURRENT_DATE)
          AND billing_date <= CURRENT_DATE
          AND ad IS NOT NULL
          AND ad <> ''
          ${filterSQL}
        GROUP BY sap_code
      )
      SELECT
        SUM(s.RD_CMU)                                                                                AS "Sales Unit",
        SUM(t.TrgUnit)                                                                               AS "Target Unit",
        ROUND(SUM(s.RD_CMU)::numeric / NULLIF(SUM(t.TrgUnit)::numeric, 0) * 100, 1)                AS "Unit Ach%",
        SUM(s.RD_CMS_EFP)                                                                            AS "Sales EFP",
        SUM(t.TrgVal)                                                                                AS "Target",
        ROUND(SUM(s.RD_CMS_EFP)::numeric / NULLIF(SUM(t.TrgVal)::numeric, 0) * 100, 1)             AS "Sales Ach%"
      FROM sales s
      LEFT JOIN targets t ON t.material_code::text = s.sap_code::text
    `;

    const results = await db.sequelize.query(sql, {
      replacements,
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
