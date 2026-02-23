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
  region_desc:        't02.region_desc',
};

router.get("/", async (req, res) => {
  try {
    const { groupBy = "Ctg", displayMode = "absolute", ...filters } = req.query;

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

    // Metric columns: EFP mode (displayMode=percentage) or TP mode (displayMode=absolute, default)
    const isEfp = displayMode === "EFP";
    const metricCols = isEfp
      ? `
        SUM(CASE
            WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
            AND  billing_date <= CURRENT_DATE
            THEN "EFP_Cur" * sold_qty ELSE 0
        END) AS CMV,
        SUM(CASE
            WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
            AND  billing_date <= (CURRENT_DATE - INTERVAL '1 month')
            THEN "EFP" * sold_qty ELSE 0
        END) AS PMV,
        ROUND(
            (
                SUM(CASE
                    WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
                    AND  billing_date <= CURRENT_DATE
                    THEN "EFP_Cur" * sold_qty ELSE 0
                END)::numeric
                -
                SUM(CASE
                    WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                    AND  billing_date <= (CURRENT_DATE - INTERVAL '1 month')
                    THEN "EFP" * sold_qty ELSE 0
                END)::numeric
            )
            /
            NULLIF(
                SUM(CASE
                    WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                    AND  billing_date <= (CURRENT_DATE - INTERVAL '1 month')
                    THEN "EFP" * sold_qty ELSE 0
                END)::numeric
            , 0)
            * 100
        , 1) AS "S_Grw%"`
      : `
        SUM(CASE
            WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
            AND  billing_date <= CURRENT_DATE
            THEN gross_amount ELSE 0
        END) AS CMV,
        SUM(CASE
            WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
            AND  billing_date <  DATE_TRUNC('month', CURRENT_DATE)
            THEN gross_amount ELSE 0
        END) AS PMV,
        ROUND(
            (
                SUM(CASE
                    WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
                    AND  billing_date <= CURRENT_DATE
                    THEN gross_amount ELSE 0
                END)::numeric
                -
                SUM(CASE
                    WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                    AND  billing_date <  DATE_TRUNC('month', CURRENT_DATE)
                    THEN gross_amount ELSE 0
                END)::numeric
            )
            /
            NULLIF(
                SUM(CASE
                    WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                    AND  billing_date <  DATE_TRUNC('month', CURRENT_DATE)
                    THEN gross_amount ELSE 0
                END)::numeric
            , 0)
            * 100
        , 1) AS "S_Grw%"`;

    const sql = `
      SELECT
        ${selectCols},
        ${metricCols}
      FROM vw_invoice_productmap t01
      INNER JOIN public.product_region t02 ON t01.branch_id = t02.org_id::text
      WHERE
          billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
          AND billing_date <= CURRENT_DATE
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
      SELECT
          SUM(CASE
              WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
              AND  billing_date <= CURRENT_DATE
              THEN sold_qty ELSE 0
          END) AS RD_CMU,
          SUM(CASE
              WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
              AND  billing_date <= (CURRENT_DATE - INTERVAL '1 month')
              THEN sold_qty ELSE 0
          END) AS RD_LMU,
          ROUND(
              (
                  SUM(CASE
                      WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
                      AND  billing_date <= CURRENT_DATE
                      THEN sold_qty ELSE 0
                  END)::numeric
                  -
                  SUM(CASE
                      WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND  billing_date <= (CURRENT_DATE - INTERVAL '1 month')
                      THEN sold_qty ELSE 0
                  END)::numeric
              )
              /
              NULLIF(
                  SUM(CASE
                      WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND  billing_date <= (CURRENT_DATE - INTERVAL '1 month')
                      THEN sold_qty ELSE 0
                  END)::numeric
              , 0)
              * 100
          , 1) AS "RD_Unit_Grw%",
          SUM(CASE
              WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
              AND  billing_date <= CURRENT_DATE
              THEN gross_amount ELSE 0
          END) AS RD_CMS_TP,
          SUM(CASE
              WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
              AND  billing_date <= (CURRENT_DATE - INTERVAL '1 month')
              THEN gross_amount ELSE 0
          END) AS RD_LMS_TP,
          ROUND(
              (
                  SUM(CASE
                      WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
                      AND  billing_date <= CURRENT_DATE
                      THEN gross_amount ELSE 0
                  END)::numeric
                  -
                  SUM(CASE
                      WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND  billing_date <= (CURRENT_DATE - INTERVAL '1 month')
                      THEN gross_amount ELSE 0
                  END)::numeric
              )
              /
              NULLIF(
                  SUM(CASE
                      WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND  billing_date <= (CURRENT_DATE - INTERVAL '1 month')
                      THEN gross_amount ELSE 0
                  END)::numeric
              , 0)
              * 100
          , 1) AS "RD_TP_Val%",
          SUM(CASE
              WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
              AND  billing_date <= CURRENT_DATE
              THEN "EFP_Cur" * sold_qty ELSE 0
          END) AS RD_CMS_EFP,
          SUM(CASE
              WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
              AND  billing_date <= (CURRENT_DATE - INTERVAL '1 month')
              THEN "EFP" * sold_qty ELSE 0
          END) AS RD_LMS_EFP,
          ROUND(
              (
                  SUM(CASE
                      WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
                      AND  billing_date <= CURRENT_DATE
                      THEN "EFP_Cur" * sold_qty ELSE 0
                  END)::numeric
                  -
                  SUM(CASE
                      WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND  billing_date <= (CURRENT_DATE - INTERVAL '1 month')
                      THEN "EFP" * sold_qty ELSE 0
                  END)::numeric
              )
              /
              NULLIF(
                  SUM(CASE
                      WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND  billing_date <= (CURRENT_DATE - INTERVAL '1 month')
                      THEN "EFP" * sold_qty ELSE 0
                  END)::numeric
              , 0)
              * 100
          , 1) AS "RD_EFP_Val%"
      FROM vw_invoice_productmap t01
      INNER JOIN public.product_region t02 ON t01.branch_id = t02.org_id::text
      WHERE
          billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
          AND billing_date <= CURRENT_DATE
          ${filterSQL};
    `;
    const results = await db.sequelize.query(sql, {
      replacements,
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
