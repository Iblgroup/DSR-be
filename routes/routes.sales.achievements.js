import express from "express";
import db from "../models/index.js";

const router = express.Router();

const ALLOWED_GROUP_BY = {
  AD:        't01."AD"',
  BU_Desc:   't01."BU_Desc"',
  Team_Desc: 't01."Team_Desc"',
  grp_brand: 't01.grp_brand',
  prod_nm:   't01.prod_nm',
  Ctg:       't01."Ctg"',
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

router.get("/", async (req, res) => {
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
    const filterSQL = filterClauses.length > 0 ? filterClauses.join("\n") : "";

    const sql = `
      SELECT
        ${selectCols},
        SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN t01."EFP_Cur" * t01.sold_qty ELSE 0 END) AS RD_CMS_EFP,
        SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN t03.target_value ELSE 0 END) AS TrgVal,
        ROUND(
          SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN t01."EFP_Cur" * t01.sold_qty ELSE 0 END)::numeric
          / NULLIF(
            SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN t03.target_value ELSE 0 END)::numeric
          , 0) * 100
        , 1) AS "SalAch%"
      FROM vw_invoice_productmap t01
      LEFT JOIN vw_tscl_sap_targets t03
          ON t01.sap_code::text = t03.material_code::text
          AND t03.target_date = DATE_TRUNC('month', t01.billing_date::timestamp with time zone)::date
      WHERE t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE)
          AND t01.billing_date <= CURRENT_DATE
          ${filterSQL}
      GROUP BY ${groupByClause}
      ORDER BY ${groupByClause};
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
      SELECT
        SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN t01.sold_qty ELSE 0 END) AS salesunit,
        SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN t03.target_qty ELSE 0 END) AS TrgUnit,
        ROUND(
          SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN t01.sold_qty ELSE 0 END)::numeric
          / NULLIF(
            SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN t03.target_qty ELSE 0 END)::numeric
          , 0) * 100
        , 1) AS "UnitAch%",
        SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN t01."EFP_Cur" * t01.sold_qty ELSE 0 END) AS sales_EFP,
        SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN t03.target_value ELSE 0 END) AS Target,
        ROUND(
          SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN t01."EFP_Cur" * t01.sold_qty ELSE 0 END)::numeric
          / NULLIF(
            SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN t03.target_value ELSE 0 END)::numeric
          , 0) * 100
        , 1) AS "SalAch%"
      FROM vw_invoice_productmap t01
      LEFT JOIN vw_tscl_sap_targets t03
          ON t01.sap_code::text = t03.material_code::text
          AND t03.target_date = DATE_TRUNC('month', t01.billing_date::timestamp with time zone)::date
      WHERE t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE)
          AND t01.billing_date <= CURRENT_DATE
          ${filterSQL}
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
